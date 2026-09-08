import { db, type OutboxRow } from '../data/db';
import { now } from '../domain/utils';
import type { ID, NoteFieldKey, FieldVersions } from '../domain/types';

export type OpId = string;

export type OutboxOp =
  | {
      kind: 'create';
      noteId: ID;
      clientTimestamp: number;
      fieldVersions: FieldVersions;
      fields: { title: string; content: string; tags: string[]; createdAt: number };
    }
  | {
      kind: 'update';
      noteId: ID;
      clientTimestamp: number;
      fieldVersions: FieldVersions;
      changedFields: NoteFieldKey[];
      fields: Partial<Record<NoteFieldKey, unknown>>;
    }
  | { kind: 'softDelete'; noteId: ID; clientTimestamp: number; fieldVersions: FieldVersions; deletedAt: number }
  | { kind: 'restore'; noteId: ID; clientTimestamp: number; fieldVersions: FieldVersions }
  | { kind: 'permDelete'; noteId: ID; clientTimestamp: number; fieldVersions: FieldVersions; tombstone: true }
  | {
      kind: 'renameTag';
      from: string;
      to: string;
      affected: Array<{ noteId: ID; fieldVersions: FieldVersions }>;
      clientTimestamp: number;
    }
  | {
      kind: 'deleteTag';
      name: string;
      affected: Array<{ noteId: ID; fieldVersions: FieldVersions }>;
      clientTimestamp: number;
    };

export function newOpId(): OpId {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return 'op-' + Math.random().toString(36).slice(2, 10) + '-' + Date.now().toString(36);
}

export function makeOutboxRow(op: OutboxOp): OutboxRow {
  return {
    id: newOpId(),
    op: op as unknown,
    createdAt: now(),
    attempts: 0,
    lastError: null,
    status: 'pending'
  };
}

export async function enqueueOpInTx(op: OutboxOp, tx: { outbox: { add: (row: OutboxRow) => unknown } }): Promise<OpId> {
  const row = makeOutboxRow(op);
  await tx.outbox.add(row);
  return row.id;
}

export async function enqueueOp(op: OutboxOp): Promise<OpId> {
  const row = makeOutboxRow(op);
  await db.outbox.add(row);
  return row.id;
}
