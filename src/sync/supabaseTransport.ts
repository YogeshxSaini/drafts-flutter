import type { OutboxOp } from './outbox';
import type { RemoteRow, SyncTransport, PushResult } from './transport';
import type { Note, FieldVersions } from '../domain/types';

export interface SupabaseTransportConfig {
  url: string;
  anonKey: string;
  userId: string;
}

interface SupabaseLike {
  from: (table: string) => {
    upsert: (rows: unknown[], opts?: unknown) => Promise<{ error: { message: string } | null }>;
    select: (cols?: string) => {
      gt: (col: string, val: number) => {
        order: (col: string, opts: { ascending: boolean }) => {
          limit: (n: number) => Promise<{ data: ServerRow[] | null; error: { message: string } | null }>;
        };
      };
    };
    delete: () => { eq: (col: string, val: string) => Promise<{ error: { message: string } | null }> };
  };
  channel: (name: string) => {
    on: (kind: 'postgres_changes', opts: unknown, cb: (payload: { new: ServerRow; old: ServerRow }) => void) => unknown;
    subscribe: () => unknown;
  };
  removeChannel: (ch: unknown) => void;
}

interface ServerRow {
  id: string;
  user_id: string;
  title: string;
  content: string;
  tags: string[];
  is_pinned: boolean;
  is_archived: boolean;
  is_deleted: boolean;
  deleted_at: number | null;
  created_at: number;
  updated_at: number;
  field_versions: FieldVersions;
  version: number;
  tombstone: boolean;
}

function toServerRow(op: OutboxOp, opId: string, userId: string): Record<string, unknown> | null {
  const base = { id: opId, user_id: userId, created_at: op.clientTimestamp };
  switch (op.kind) {
    case 'create':
      return {
        ...base,
        id: op.noteId,
        title: '',
        content: '',
        tags: [],
        is_pinned: false,
        is_archived: false,
        is_deleted: false,
        deleted_at: null,
        created_at: op.clientTimestamp,
        updated_at: op.clientTimestamp,
        field_versions: op.fieldVersions,
        version: 0,
        tombstone: false
      };
    case 'update':
      return {
        id: op.noteId,
        user_id: userId,
        updated_at: op.clientTimestamp,
        field_versions: op.fieldVersions,
        version: 0,
        ...op.fields
      };
    case 'softDelete':
      return {
        id: op.noteId,
        user_id: userId,
        is_deleted: true,
        deleted_at: op.deletedAt,
        updated_at: op.clientTimestamp,
        field_versions: op.fieldVersions,
        version: 0
      };
    case 'restore':
      return {
        id: op.noteId,
        user_id: userId,
        is_deleted: false,
        deleted_at: null,
        updated_at: op.clientTimestamp,
        field_versions: op.fieldVersions,
        version: 0
      };
    case 'permDelete':
      return {
        id: op.noteId,
        user_id: userId,
        updated_at: op.clientTimestamp,
        field_versions: op.fieldVersions,
        version: 0,
        tombstone: true
      };
    case 'renameTag':
    case 'deleteTag':
      return null;
  }
}

function serverToRemoteRow(row: ServerRow): RemoteRow {
  const note: Note = {
    id: row.id,
    title: row.title,
    content: row.content,
    tags: row.tags,
    isPinned: row.is_pinned,
    isArchived: row.is_archived,
    isDeleted: row.is_deleted,
    deletedAt: row.deleted_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    fieldVersions: row.field_versions
  };
  return {
    id: row.id,
    note,
    fieldVersions: row.field_versions,
    tombstone: row.tombstone,
    updatedAt: row.updated_at
  };
}

export class SupabaseTransport implements SyncTransport {
  private client: SupabaseLike | null = null;
  private activeChannel: unknown = null;

  constructor(private config: SupabaseTransportConfig) {}

  private async getClient(): Promise<SupabaseLike> {
    if (this.client) return this.client;
    const mod = await import('@supabase/supabase-js');
    const create = (mod as { createClient: (url: string, key: string) => SupabaseLike }).createClient;
    this.client = create(this.config.url, this.config.anonKey);
    return this.client;
  }

  async push(op: OutboxOp, opId: string): Promise<PushResult> {
    try {
      const client = await this.getClient();
      if (op.kind === 'renameTag') {
        for (const aff of op.affected) {
          const { error } = await client
            .from('notes')
            .upsert([
              {
                id: aff.noteId,
                user_id: this.config.userId,
                updated_at: op.clientTimestamp,
                field_versions: aff.fieldVersions
              }
            ]);
          if (error) return { ok: false, error: error.message };
        }
        return { ok: true };
      }
      if (op.kind === 'deleteTag') {
        for (const aff of op.affected) {
          const { error } = await client
            .from('notes')
            .upsert([
              {
                id: aff.noteId,
                user_id: this.config.userId,
                updated_at: op.clientTimestamp,
                field_versions: aff.fieldVersions
              }
            ]);
          if (error) return { ok: false, error: error.message };
        }
        return { ok: true };
      }
      const serverRow = toServerRow(op, opId, this.config.userId);
      if (!serverRow) return { ok: true };
      const { error } = await client.from('notes').upsert([serverRow]);
      if (error) return { ok: false, error: error.message };
      return { ok: true };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  }

  async pullSince(cursor: number, limit = 100): Promise<{ rows: RemoteRow[]; nextCursor: number }> {
    const client = await this.getClient();
    const { data, error } = await client
      .from('notes')
      .select('*')
      .gt('updated_at', cursor)
      .order('updated_at', { ascending: true })
      .limit(limit);
    if (error) throw new Error(error.message);
    const rows = (data ?? []).map(serverToRemoteRow);
    const nextCursor = rows.length ? rows[rows.length - 1].updatedAt : cursor;
    return { rows, nextCursor };
  }

  subscribe(onChange: (row: RemoteRow) => void): () => void {
    let cancelled = false;
    (async () => {
      try {
        const client = await this.getClient();
        if (cancelled) return;
        const channel = client
          .channel('inkwell-notes')
          .on(
            'postgres_changes',
            { event: '*', schema: 'public', table: 'notes', filter: `user_id=eq.${this.config.userId}` },
            (payload) => {
              const row = (payload.new ?? payload.old) as ServerRow;
              onChange(serverToRemoteRow(row));
            }
          )
          .subscribe();
        this.activeChannel = channel;
      } catch (err) {
        console.error('Supabase subscribe failed', err);
      }
    })();
    return () => {
      cancelled = true;
      if (this.activeChannel) {
        void this.getClient().then((c) => c.removeChannel(this.activeChannel));
        this.activeChannel = null;
      }
    };
  }

  async heartbeat(): Promise<boolean> {
    try {
      const client = await this.getClient();
      const probe = await client.from('notes').select('id').gt('id', '').order('id', { ascending: true }).limit(1);
      return !probe.error;
    } catch {
      return false;
    }
  }
}
