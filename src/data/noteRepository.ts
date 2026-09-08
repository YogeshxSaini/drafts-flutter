import type { NoteDraft, Note, ID } from '../domain/types';
import { db, type StoredTag } from './db';
import { generateId, now } from '../domain/utils';

function normalizeTag(name: string): string {
  return name.trim().replace(/^#+/, '').toLowerCase();
}

async function syncTagCounts(changedTags: string[]): Promise<void> {
  if (changedTags.length === 0) return;
  const unique = Array.from(new Set(changedTags.map(normalizeTag).filter(Boolean)));
  await db.transaction('rw', db.notes, db.tags, async () => {
    for (const name of unique) {
      const count = await db.notes
        .where('tags')
        .equals(name)
        .filter((n) => !n.isDeleted)
        .count();
      if (count === 0) {
        await db.tags.delete(name);
      } else {
        const existing = await db.tags.get(name);
        const next: StoredTag = {
          name,
          count,
          updatedAt: now()
        };
        if (!existing) {
          await db.tags.put(next);
        } else if (existing.count !== count) {
          await db.tags.put(next);
        }
      }
    }
  });
}

export const noteRepository = {
  async create(draft: NoteDraft = { title: '', content: '', tags: [] }): Promise<Note> {
    const t = now();
    const note: Note = {
      id: generateId(),
      title: draft.title,
      content: draft.content,
      tags: Array.from(new Set(draft.tags.map(normalizeTag).filter(Boolean))),
      createdAt: t,
      updatedAt: t,
      isPinned: false,
      isArchived: false,
      isDeleted: false,
      deletedAt: null
    };
    await db.notes.put(note);
    await syncTagCounts(note.tags);
    return note;
  },

  async get(id: ID): Promise<Note | undefined> {
    return db.notes.get(id);
  },

  async update(id: ID, patch: Partial<NoteDraft>): Promise<Note | undefined> {
    const existing = await db.notes.get(id);
    if (!existing) return undefined;
    const previousTags = existing.tags;
    const nextTags = patch.tags ? Array.from(new Set(patch.tags.map(normalizeTag).filter(Boolean))) : previousTags;
    const next: Note = {
      ...existing,
      ...patch,
      tags: nextTags,
      updatedAt: now()
    };
    await db.notes.put(next);
    const tagDelta = new Set<string>([...previousTags, ...nextTags]);
    await syncTagCounts(Array.from(tagDelta));
    return next;
  },

  async touchContent(id: ID, content: string, titleFromContent?: string): Promise<Note | undefined> {
    const existing = await db.notes.get(id);
    if (!existing) return undefined;
    const title = titleFromContent ?? (existing.title || content.split('\n')[0]?.slice(0, 80) || '');
    const next: Note = {
      ...existing,
      content,
      title,
      updatedAt: now()
    };
    await db.notes.put(next);
    return next;
  },

  async pin(id: ID, pinned: boolean): Promise<void> {
    await db.notes.update(id, { isPinned: pinned, updatedAt: now() });
  },

  async archive(id: ID, archived: boolean): Promise<void> {
    await db.notes.update(id, { isArchived: archived, updatedAt: now() });
  },

  async unarchive(id: ID): Promise<void> {
    await db.notes.update(id, { isArchived: false, updatedAt: now() });
  },

  async softDelete(id: ID): Promise<void> {
    await db.notes.update(id, { isDeleted: true, deletedAt: now(), updatedAt: now() });
  },

  async restore(id: ID): Promise<void> {
    const existing = await db.notes.get(id);
    if (!existing) return;
    await db.notes.update(id, { isDeleted: false, deletedAt: null, updatedAt: now() });
    await syncTagCounts(existing.tags);
  },

  async permanentDelete(id: ID): Promise<void> {
    const existing = await db.notes.get(id);
    if (!existing) return;
    await db.notes.delete(id);
    await syncTagCounts(existing.tags);
  },

  async emptyTrash(): Promise<number> {
    const ids = await db.notes.where('isDeleted').equals(1 as unknown as never).toArray()
      .catch(async () => {
        const all = await db.notes.toArray();
        return all.filter((n) => n.isDeleted);
      });
    let n = 0;
    for (const note of ids) {
      await noteRepository.permanentDelete(note.id);
      n++;
    }
    return n;
  },

  async listTags(): Promise<StoredTag[]> {
    return db.tags.orderBy('count').reverse().toArray();
  },

  async renameTag(from: string, to: string): Promise<number> {
    const oldName = normalizeTag(from);
    const newName = normalizeTag(to);
    if (!oldName || !newName || oldName === newName) return 0;
    const affected = await db.notes.where('tags').equals(oldName).toArray();
    await db.transaction('rw', db.notes, db.tags, async () => {
      for (const note of affected) {
        const nextTags = note.tags.map((t) => (t === oldName ? newName : t));
        const dedup = Array.from(new Set(nextTags));
        await db.notes.update(note.id, { tags: dedup, updatedAt: now() });
      }
      await db.tags.delete(oldName);
      const count = await db.notes
        .where('tags')
        .equals(newName)
        .filter((n) => !n.isDeleted)
        .count();
      if (count > 0) {
        await db.tags.put({ name: newName, count, updatedAt: now() });
      }
    });
    return affected.length;
  },

  async deleteTag(name: string): Promise<number> {
    const target = normalizeTag(name);
    if (!target) return 0;
    const affected = await db.notes.where('tags').equals(target).toArray();
    await db.transaction('rw', db.notes, db.tags, async () => {
      for (const note of affected) {
        const nextTags = note.tags.filter((t) => t !== target);
        await db.notes.update(note.id, { tags: nextTags, updatedAt: now() });
      }
      await db.tags.delete(target);
    });
    return affected.length;
  }
};
