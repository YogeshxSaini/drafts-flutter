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

class InkwellDB extends Dexie {
  notes!: Table<Note, string>;
  tags!: Table<StoredTag, string>;
  meta!: Table<AppMeta, string>;

  constructor() {
    super('inkwell');
    this.version(1).stores({
      notes: 'id, updatedAt, createdAt, isPinned, isArchived, isDeleted, *tags',
      tags: 'name, count, updatedAt',
      meta: 'key'
    });
  }
}

export const db = new InkwellDB();
