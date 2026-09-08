import type { Note, NoteFieldKey, FieldVersions } from '../domain/types';
import type { OutboxOp } from './outbox';

export interface RemoteRow {
  id: string;
  note: Note;
  fieldVersions: FieldVersions;
  tombstone: boolean;
  updatedAt: number;
}

export interface PushResult {
  ok: boolean;
  error?: string;
}

export interface SyncTransport {
  push(op: OutboxOp, opId: string): Promise<PushResult>;
  pullSince(cursor: number, limit?: number): Promise<{ rows: RemoteRow[]; nextCursor: number }>;
  subscribe(onChange: (row: RemoteRow) => void): () => void;
  heartbeat(): Promise<boolean>;
}

export type { NoteFieldKey, FieldVersions };
