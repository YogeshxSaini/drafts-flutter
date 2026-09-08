import Dexie, { type Table } from 'dexie';
import type { Note } from '../domain/types';

export interface StoredTag {
  name: string;
  count: number;
  updatedAt: number;
}

export interface AppMeta {
  key: string;
  value: unknown;
}

export type OutboxStatus = 'pending' | 'inflight' | 'done' | 'dead';

export interface OutboxRow {
  id: string;
  op: unknown;
  createdAt: number;
  attempts: number;
  lastError: string | null;
  status: OutboxStatus;
}

class InkwellDB extends Dexie {
  notes!: Table<Note, string>;
  tags!: Table<StoredTag, string>;
  meta!: Table<AppMeta, string>;
  outbox!: Table<OutboxRow, string>;

  constructor() {
    super('inkwell');
    this.version(1).stores({
      notes: 'id, updatedAt, createdAt, isPinned, isArchived, isDeleted, *tags',
      tags: 'name, count, updatedAt',
      meta: 'key'
    });

    this.version(2)
      .stores({
        notes: 'id, updatedAt, createdAt, isPinned, isArchived, isDeleted, *tags',
        tags: 'name, count, updatedAt',
        meta: 'key',
        outbox: 'id, createdAt, status'
      })
      .upgrade(async (tx) => {
        await tx
          .table('notes')
          .toCollection()
          .modify((n: Note) => {
            if (!n.fieldVersions) n.fieldVersions = {};
          });
      });
  }
}

export const db = new InkwellDB();
