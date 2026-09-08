import type { OutboxOp } from './outbox';
import type { RemoteRow, SyncTransport, PushResult } from './transport';
import type { Note } from '../domain/types';

export interface FakeRemoteOptions {
  failPushTimes?: number;
  heartbeat?: boolean;
}

export class FakeRemote implements SyncTransport {
  private rows = new Map<string, RemoteRow>();
  private seenOpIds = new Set<string>();
  private subscribers = new Set<(row: RemoteRow) => void>();
  private pushAttempts = 0;
  private failPushTimes: number;
  private heartbeatValue: boolean;

  constructor(opts: FakeRemoteOptions = {}) {
    this.failPushTimes = opts.failPushTimes ?? 0;
    this.heartbeatValue = opts.heartbeat ?? true;
  }

  setHeartbeat(v: boolean) {
    this.heartbeatValue = v;
  }

  setFailPushTimes(n: number) {
    this.failPushTimes = n;
  }

  async push(op: OutboxOp, opId: string): Promise<PushResult> {
    this.pushAttempts += 1;
    if (this.pushAttempts <= this.failPushTimes) {
      return { ok: false, error: 'simulated failure' };
    }
    if (this.seenOpIds.has(opId)) {
      return { ok: true };
    }
    this.seenOpIds.add(opId);

    switch (op.kind) {
      case 'create': {
        const note: Note = {
          id: op.noteId,
          title: '',
          content: '',
          tags: [],
          createdAt: op.clientTimestamp,
          updatedAt: op.clientTimestamp,
          isPinned: false,
          isArchived: false,
          isDeleted: false,
          deletedAt: null,
          fieldVersions: op.fieldVersions
        };
        const row: RemoteRow = {
          id: op.noteId,
          note,
          fieldVersions: op.fieldVersions,
          tombstone: false,
          updatedAt: op.clientTimestamp
        };
        this.rows.set(op.noteId, row);
        this.emit(row);
        break;
      }
      case 'update': {
        const existing = this.rows.get(op.noteId);
        const next: Note = existing
          ? { ...existing.note, ...(op.fields as Partial<Note>), updatedAt: op.clientTimestamp }
          : ({
              id: op.noteId,
              title: '',
              content: '',
              tags: [],
              createdAt: op.clientTimestamp,
              updatedAt: op.clientTimestamp,
              isPinned: false,
              isArchived: false,
              isDeleted: false,
              deletedAt: null,
              ...(op.fields as Partial<Note>),
              fieldVersions: op.fieldVersions
            } as Note);
        const row: RemoteRow = {
          id: op.noteId,
          note: next,
          fieldVersions: op.fieldVersions,
          tombstone: false,
          updatedAt: op.clientTimestamp
        };
        this.rows.set(op.noteId, row);
        this.emit(row);
        break;
      }
      case 'softDelete': {
        const existing = this.rows.get(op.noteId);
        if (!existing) return { ok: true };
        const next: Note = { ...existing.note, isDeleted: true, deletedAt: op.deletedAt, updatedAt: op.clientTimestamp };
        const row: RemoteRow = {
          id: op.noteId,
          note: next,
          fieldVersions: op.fieldVersions,
          tombstone: false,
          updatedAt: op.clientTimestamp
        };
        this.rows.set(op.noteId, row);
        this.emit(row);
        break;
      }
      case 'restore': {
        const existing = this.rows.get(op.noteId);
        if (!existing) return { ok: true };
        const next: Note = { ...existing.note, isDeleted: false, deletedAt: null, updatedAt: op.clientTimestamp };
        const row: RemoteRow = {
          id: op.noteId,
          note: next,
          fieldVersions: op.fieldVersions,
          tombstone: false,
          updatedAt: op.clientTimestamp
        };
        this.rows.set(op.noteId, row);
        this.emit(row);
        break;
      }
      case 'permDelete': {
        const existing = this.rows.get(op.noteId);
        const row: RemoteRow = {
          id: op.noteId,
          note: existing?.note ?? {
            id: op.noteId,
            title: '',
            content: '',
            tags: [],
            createdAt: op.clientTimestamp,
            updatedAt: op.clientTimestamp,
            isPinned: false,
            isArchived: false,
            isDeleted: true,
            deletedAt: op.clientTimestamp,
            fieldVersions: op.fieldVersions
          },
          fieldVersions: op.fieldVersions,
          tombstone: true,
          updatedAt: op.clientTimestamp
        };
        this.rows.set(op.noteId, row);
        this.emit(row);
        break;
      }
      case 'renameTag': {
        for (const aff of op.affected) {
          const existing = this.rows.get(aff.noteId);
          if (!existing) continue;
          const nextTags = existing.note.tags.map((t) => (t === op.from ? op.to : t));
          const dedup = Array.from(new Set(nextTags));
          const next: Note = { ...existing.note, tags: dedup, updatedAt: op.clientTimestamp };
          this.rows.set(aff.noteId, {
            id: aff.noteId,
            note: next,
            fieldVersions: aff.fieldVersions,
            tombstone: false,
            updatedAt: op.clientTimestamp
          });
          this.emit(this.rows.get(aff.noteId)!);
        }
        break;
      }
      case 'deleteTag': {
        for (const aff of op.affected) {
          const existing = this.rows.get(aff.noteId);
          if (!existing) continue;
          const next: Note = { ...existing.note, tags: existing.note.tags.filter((t) => t !== op.name), updatedAt: op.clientTimestamp };
          this.rows.set(aff.noteId, {
            id: aff.noteId,
            note: next,
            fieldVersions: aff.fieldVersions,
            tombstone: false,
            updatedAt: op.clientTimestamp
          });
          this.emit(this.rows.get(aff.noteId)!);
        }
        break;
      }
    }
    return { ok: true };
  }

  async pullSince(cursor: number, limit = 100): Promise<{ rows: RemoteRow[]; nextCursor: number }> {
    const all = Array.from(this.rows.values()).filter((r) => r.updatedAt > cursor).sort((a, b) => a.updatedAt - b.updatedAt);
    const slice = all.slice(0, limit);
    const nextCursor = slice.length ? slice[slice.length - 1].updatedAt : cursor;
    return { rows: slice, nextCursor };
  }

  subscribe(onChange: (row: RemoteRow) => void): () => void {
    this.subscribers.add(onChange);
    return () => {
      this.subscribers.delete(onChange);
    };
  }

  async heartbeat(): Promise<boolean> {
    return this.heartbeatValue;
  }

  private emit(row: RemoteRow) {
    for (const s of this.subscribers) s(row);
  }

  // test helpers
  __injectRemoteRow(row: RemoteRow) {
    this.rows.set(row.id, row);
    this.emit(row);
  }
  __getRow(id: string): RemoteRow | undefined {
    return this.rows.get(id);
  }
  __seenOpIds(): Set<string> {
    return new Set(this.seenOpIds);
  }
  __reset() {
    this.rows.clear();
    this.seenOpIds.clear();
    this.pushAttempts = 0;
    this.failPushTimes = 0;
    this.subscribers.clear();
  }
}
