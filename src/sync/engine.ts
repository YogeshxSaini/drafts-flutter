import { db, type OutboxRow } from '../data/db';
import type { Note, FieldVersions, NoteFieldKey } from '../domain/types';
import { mergeLocalAndRemote } from './merge';
import type { RemoteRow, SyncTransport, PushResult } from './transport';
import { setSyncState, setSyncPending, markSynced, setSyncError } from './status';
import type { OutboxOp } from './outbox';
import { now } from '../domain/utils';

const CURSOR_PREFIX = 'sync_cursor_';
const PUSH_BATCH = 50;
const MAX_ATTEMPTS = 10;
const BASE_BACKOFF_MS = 1000;
const MAX_BACKOFF_MS = 60_000;

function backoffMs(attempts: number): number {
  const exp = Math.min(MAX_BACKOFF_MS, BASE_BACKOFF_MS * 2 ** Math.max(0, attempts));
  return exp + Math.floor(Math.random() * 1000);
}

function cursorKey(userId: string): string {
  return CURSOR_PREFIX + userId;
}

export interface EngineOptions {
  transport: SyncTransport;
  onLocalChange?: () => void;
  onRemoteChange?: () => void;
  now?: () => number;
}

export class SyncEngine {
  private userId: string | null = null;
  private inFlight: Promise<void> | null = null;
  private listeners = new Set<() => void>();
  private unsubscribeTransport: (() => void) | null = null;
  private opts: EngineOptions;
  private _now: () => number;

  constructor(opts: EngineOptions) {
    this.opts = opts;
    this._now = opts.now ?? now;
  }

  setUser(userId: string | null) {
    if (this.userId === userId) return;
    this.userId = userId;
    if (this.unsubscribeTransport) {
      this.unsubscribeTransport();
      this.unsubscribeTransport = null;
    }
    if (userId) {
      this.unsubscribeTransport = this.opts.transport.subscribe(() => {
        void this.syncNow();
      });
    }
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify() {
    for (const l of this.listeners) l();
  }

  async start(): Promise<void> {
    await this.syncNow();
  }

  async stop(): Promise<void> {
    if (this.inFlight) {
      try {
        await this.inFlight;
      } catch {
        // ignored
      }
    }
    if (this.unsubscribeTransport) {
      this.unsubscribeTransport();
      this.unsubscribeTransport = null;
    }
    setSyncState('idle');
  }

  async syncNow(): Promise<void> {
    if (this.inFlight) {
      await this.inFlight;
      return;
    }
    this.inFlight = this.syncOnce().finally(() => {
      this.inFlight = null;
    });
    await this.inFlight;
  }

  private async syncOnce(): Promise<void> {
    if (!this.userId) {
      setSyncState('idle');
      return;
    }
    setSyncState('syncing');
    setSyncError(null);

    try {
      const online = this.opts.transport.heartbeat ? await this.opts.transport.heartbeat() : true;
      if (!online) {
        setSyncState('offline');
        return;
      }
    } catch {
      setSyncState('offline');
      return;
    }

    try {
      await this.pushBatch();
      await this.pullBatch();
      markSynced(this._now());
      const remaining = await db.outbox.where('status').equals('pending').count();
      setSyncPending(remaining);
      this.opts.onRemoteChange?.();
      this.notify();
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setSyncError(message);
    }
  }

  private async pushBatch(): Promise<void> {
    while (true) {
      const rows = (await db.outbox.where('status').equals('pending').sortBy('createdAt')).slice(0, PUSH_BATCH);
      if (rows.length === 0) return;
      let allOk = true;
      for (const row of rows) {
        const result = await this.pushOne(row);
        if (!result) allOk = false;
      }
      if (!allOk) return;
    }
  }

  private async pushOne(row: OutboxRow): Promise<boolean> {
    await db.outbox.update(row.id, { status: 'inflight' });
    const op = row.op as OutboxOp;
    let result: PushResult;
    try {
      result = await this.opts.transport.push(op, row.id);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      await this.markAttemptFailure(row, message);
      return false;
    }
    if (!result.ok) {
      await this.markAttemptFailure(row, result.error ?? 'push failed');
      return false;
    }
    await db.outbox.delete(row.id);
    return true;
  }

  private async markAttemptFailure(row: OutboxRow, error: string): Promise<void> {
    const attempts = (row.attempts ?? 0) + 1;
    const status: 'pending' | 'dead' = attempts >= MAX_ATTEMPTS ? 'dead' : 'pending';
    await db.outbox.update(row.id, { attempts, lastError: error, status });
    if (status === 'dead') {
      setSyncError(`Out of retries: ${error}`);
    } else {
      const delay = backoffMs(attempts);
      setTimeout(() => {
        void this.syncNow();
      }, delay);
    }
  }

  private async pullBatch(): Promise<void> {
    if (!this.userId) return;
    const cursor = await this.getCursor(this.userId);
    const { rows, nextCursor } = await this.opts.transport.pullSince(cursor);
    for (const remote of rows) {
      await this.applyRemote(remote);
    }
    if (nextCursor > cursor) {
      await this.setCursor(this.userId, nextCursor);
    }
  }

  private async applyRemote(remote: RemoteRow): Promise<void> {
    await db.transaction('rw', db.notes, db.outbox, async () => {
      const local = await db.notes.get(remote.id);
      const result = mergeLocalAndRemote(local, remote);
      if (result.next === null) {
        await db.notes.delete(remote.id);
        return;
      }
      const next: Note = result.next;
      const fv: FieldVersions = { ...(next.fieldVersions ?? {}), ...result.remoteFieldVersions };
      next.fieldVersions = fv;
      await db.notes.put(next);
    });
    this.opts.onLocalChange?.();
  }

  private async getCursor(userId: string): Promise<number> {
    const row = await db.meta.get(cursorKey(userId));
    if (!row) return 0;
    const v = (row as { value?: unknown }).value;
    return typeof v === 'number' ? v : 0;
  }

  private async setCursor(userId: string, cursor: number): Promise<void> {
    await db.meta.put({ key: cursorKey(userId), value: cursor });
  }
}

export function bumpFieldVersion(
  existing: FieldVersions | undefined,
  field: NoteFieldKey
): { next: FieldVersions; version: number } {
  const cur = existing?.[field] ?? 0;
  const v = cur + 1;
  return { next: { ...(existing ?? {}), [field]: v }, version: v };
}
