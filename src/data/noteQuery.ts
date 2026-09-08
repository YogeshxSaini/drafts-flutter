import { db } from './db';
import type { Note, NoteFilter, SortKey } from '../domain/types';

function compare(a: Note, b: Note, key: SortKey): number {
  switch (key) {
    case 'created':
      return b.createdAt - a.createdAt;
    case 'alpha':
      return a.title.localeCompare(b.title, undefined, { sensitivity: 'base' });
    case 'pinned':
      if (a.isPinned !== b.isPinned) return a.isPinned ? -1 : 1;
      return b.updatedAt - a.updatedAt;
    case 'updated':
    default:
      return b.updatedAt - a.updatedAt;
  }
}

function tokenize(q: string): string[] {
  return q
    .toLowerCase()
    .split(/\s+/)
    .map((t) => t.trim())
    .filter(Boolean);
}

function matches(note: Note, tokens: string[]): boolean {
  if (tokens.length === 0) return true;
  const haystack = (note.title + ' \n ' + note.content + ' \n ' + note.tags.map((t) => '#' + t).join(' ')).toLowerCase();
  return tokens.every((t) => haystack.includes(t));
}

export const noteQuery = {
  async list(filter: NoteFilter): Promise<Note[]> {
    const sort: SortKey = filter.sort ?? 'updated';
    const tokens = tokenize(filter.query ?? '');
    const wantedTags = (filter.tags ?? []).map((t) => t.toLowerCase());

    const includeArchived = !!filter.includeArchived;
    const includeDeleted = !!filter.includeDeleted;

    const all = await db.notes.toArray();
    const filtered = all
      .filter((n) => (includeDeleted ? n.isDeleted : !n.isDeleted))
      .filter((n) => (includeArchived ? true : !n.isArchived))
      .filter((n) => (wantedTags.length === 0 ? true : wantedTags.every((t) => n.tags.includes(t))))
      .filter((n) => matches(n, tokens));

    filtered.sort((a, b) => compare(a, b, sort));
    return filtered;
  },

  async countByView(): Promise<{ inbox: number; archived: number; trash: number; pinned: number; tags: number }> {
    const all = await db.notes.toArray();
    return {
      inbox: all.filter((n) => !n.isDeleted && !n.isArchived).length,
      archived: all.filter((n) => !n.isDeleted && n.isArchived).length,
      trash: all.filter((n) => n.isDeleted).length,
      pinned: all.filter((n) => !n.isDeleted && n.isPinned).length,
      tags: new Set(all.filter((n) => !n.isDeleted).flatMap((n) => n.tags)).size
    };
  }
};
