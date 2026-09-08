import { db, type StoredTag } from './db';
import type { Note, NoteDraft, ID, NoteFieldKey, FieldVersions } from '../domain/types';
import { generateId, now } from '../domain/utils';
import { makeOutboxRow, type OutboxOp } from '../sync/outbox';
import { bumpFieldVersion } from '../sync/engine';

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
        const next: StoredTag = { name, count, updatedAt: now() };
        if (!existing) {
          await db.tags.put(next);
        } else if (existing.count !== count) {
          await db.tags.put(next);
        }
      }
    }
  });
}

function enqueue(op: OutboxOp) {
  const row = makeOutboxRow(op);
  void db.outbox.add(row);
}

export const wrappedNoteRepository = {
  async create(draft: NoteDraft = { title: '', content: '', tags: [] }): Promise<Note> {
    const t = now();
    const id = generateId();
    const fv: FieldVersions = { title: 1, content: 1, tags: 1 };
    const note: Note = {
      id,
      title: draft.title,
      content: draft.content,
      tags: Array.from(new Set(draft.tags.map(normalizeTag).filter(Boolean))),
      createdAt: t,
      updatedAt: t,
      isPinned: false,
      isArchived: false,
      isDeleted: false,
      deletedAt: null,
      fieldVersions: fv
    };
    await db.transaction('rw', db.notes, db.tags, db.outbox, async () => {
      await db.notes.put(note);
      enqueue({
        kind: 'create',
        noteId: id,
        clientTimestamp: t,
        fieldVersions: fv,
        fields: { title: note.title, content: note.content, tags: note.tags, createdAt: t }
      });
    });
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
    const t = now();
    const fv: FieldVersions = { ...(existing.fieldVersions ?? {}) };
    const changedFields: NoteFieldKey[] = [];
    if (patch.title !== undefined) {
      const { next } = bumpFieldVersion(fv, 'title');
      Object.assign(fv, next);
      changedFields.push('title');
    }
    if (patch.content !== undefined) {
      const { next } = bumpFieldVersion(fv, 'content');
      Object.assign(fv, next);
      changedFields.push('content');
    }
    if (patch.tags !== undefined) {
      const { next } = bumpFieldVersion(fv, 'tags');
      Object.assign(fv, next);
      changedFields.push('tags');
    }
    const next: Note = {
      ...existing,
      ...patch,
      tags: nextTags,
      updatedAt: t,
      fieldVersions: fv
    };
    const fieldsPayload: Partial<Record<NoteFieldKey, unknown>> = {};
    if (patch.title !== undefined) fieldsPayload.title = patch.title;
    if (patch.content !== undefined) fieldsPayload.content = patch.content;
    if (patch.tags !== undefined) fieldsPayload.tags = nextTags;
    await db.transaction('rw', db.notes, db.tags, db.outbox, async () => {
      await db.notes.put(next);
      enqueue({
        kind: 'update',
        noteId: id,
        clientTimestamp: t,
        fieldVersions: fv,
        changedFields,
        fields: fieldsPayload
      });
    });
    const tagDelta = new Set<string>([...previousTags, ...nextTags]);
    await syncTagCounts(Array.from(tagDelta));
    return next;
  },

  async touchContent(id: ID, content: string, titleFromContent?: string): Promise<Note | undefined> {
    const existing = await db.notes.get(id);
    if (!existing) return undefined;
    const title = titleFromContent ?? (existing.title || content.split('\n')[0]?.slice(0, 80) || '');
    const t = now();
    const fv: FieldVersions = { ...(existing.fieldVersions ?? {}) };
    const { next: fv1 } = bumpFieldVersion(fv, 'content');
    Object.assign(fv, fv1);
    if (title !== existing.title) {
      const { next: fv2 } = bumpFieldVersion(fv, 'title');
      Object.assign(fv, fv2);
    }
    const next: Note = { ...existing, content, title, updatedAt: t, fieldVersions: fv };
    await db.transaction('rw', db.notes, db.outbox, async () => {
      await db.notes.put(next);
      enqueue({
        kind: 'update',
        noteId: id,
        clientTimestamp: t,
        fieldVersions: fv,
        changedFields: ['content', 'title'],
        fields: { content, title }
      });
    });
    return next;
  },

  async pin(id: ID, pinned: boolean): Promise<void> {
    const t = now();
    const existing = await db.notes.get(id);
    if (!existing) return;
    const fv: FieldVersions = { ...(existing.fieldVersions ?? {}) };
    const { next } = bumpFieldVersion(fv, 'isPinned');
    Object.assign(fv, next);
    await db.transaction('rw', db.notes, db.outbox, async () => {
      await db.notes.update(id, { isPinned: pinned, updatedAt: t, fieldVersions: fv });
      enqueue({
        kind: 'update',
        noteId: id,
        clientTimestamp: t,
        fieldVersions: fv,
        changedFields: ['isPinned'],
        fields: { isPinned: pinned }
      });
    });
  },

  async archive(id: ID, archived: boolean): Promise<void> {
    const t = now();
    const existing = await db.notes.get(id);
    if (!existing) return;
    const fv: FieldVersions = { ...(existing.fieldVersions ?? {}) };
    const { next } = bumpFieldVersion(fv, 'isArchived');
    Object.assign(fv, next);
    await db.transaction('rw', db.notes, db.outbox, async () => {
      await db.notes.update(id, { isArchived: archived, updatedAt: t, fieldVersions: fv });
      enqueue({
        kind: 'update',
        noteId: id,
        clientTimestamp: t,
        fieldVersions: fv,
        changedFields: ['isArchived'],
        fields: { isArchived: archived }
      });
    });
  },

  async unarchive(id: ID): Promise<void> {
    return this.archive(id, false);
  },

  async softDelete(id: ID): Promise<void> {
    const t = now();
    const existing = await db.notes.get(id);
    if (!existing) return;
    const fv: FieldVersions = { ...(existing.fieldVersions ?? {}) };
    const { next: fv1 } = bumpFieldVersion(fv, 'isDeleted');
    Object.assign(fv, fv1);
    const { next: fv2 } = bumpFieldVersion(fv, 'deletedAt');
    Object.assign(fv, fv2);
    const deletedAt = t;
    await db.transaction('rw', db.notes, db.outbox, async () => {
      await db.notes.update(id, { isDeleted: true, deletedAt, updatedAt: t, fieldVersions: fv });
      enqueue({
        kind: 'softDelete',
        noteId: id,
        clientTimestamp: t,
        fieldVersions: fv,
        deletedAt
      });
    });
  },

  async restore(id: ID): Promise<void> {
    const existing = await db.notes.get(id);
    if (!existing) return;
    const t = now();
    const fv: FieldVersions = { ...(existing.fieldVersions ?? {}) };
    const { next: fv1 } = bumpFieldVersion(fv, 'isDeleted');
    Object.assign(fv, fv1);
    const { next: fv2 } = bumpFieldVersion(fv, 'deletedAt');
    Object.assign(fv, fv2);
    await db.transaction('rw', db.notes, db.outbox, async () => {
      await db.notes.update(id, { isDeleted: false, deletedAt: null, updatedAt: t, fieldVersions: fv });
      enqueue({
        kind: 'restore',
        noteId: id,
        clientTimestamp: t,
        fieldVersions: fv
      });
    });
    await syncTagCounts(existing.tags);
  },

  async permanentDelete(id: ID): Promise<void> {
    const existing = await db.notes.get(id);
    if (!existing) return;
    const t = now();
    const fv: FieldVersions = { ...(existing.fieldVersions ?? {}) };
    await db.transaction('rw', db.notes, db.outbox, async () => {
      await db.notes.delete(id);
      enqueue({
        kind: 'permDelete',
        noteId: id,
        clientTimestamp: t,
        fieldVersions: fv,
        tombstone: true
      });
    });
    await syncTagCounts(existing.tags);
  },

  async emptyTrash(): Promise<number> {
    const all = await db.notes.toArray();
    const trashed = all.filter((n) => n.isDeleted);
    let n = 0;
    for (const note of trashed) {
      await this.permanentDelete(note.id);
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
    const t = now();
    const affectedPayload: Array<{ noteId: ID; fieldVersions: FieldVersions }> = [];
    await db.transaction('rw', db.notes, db.tags, db.outbox, async () => {
      for (const note of affected) {
        const nextTags = note.tags.map((tag) => (tag === oldName ? newName : tag));
        const dedup = Array.from(new Set(nextTags));
        const fv: FieldVersions = { ...(note.fieldVersions ?? {}) };
        const { next: fv1 } = bumpFieldVersion(fv, 'tags');
        Object.assign(fv, fv1);
        await db.notes.update(note.id, { tags: dedup, updatedAt: t, fieldVersions: fv });
        affectedPayload.push({ noteId: note.id, fieldVersions: fv });
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
      enqueue({
        kind: 'renameTag',
        from: oldName,
        to: newName,
        affected: affectedPayload,
        clientTimestamp: t
      });
    });
    return affected.length;
  },

  async deleteTag(name: string): Promise<number> {
    const target = normalizeTag(name);
    if (!target) return 0;
    const affected = await db.notes.where('tags').equals(target).toArray();
    const t = now();
    const affectedPayload: Array<{ noteId: ID; fieldVersions: FieldVersions }> = [];
    await db.transaction('rw', db.notes, db.tags, db.outbox, async () => {
      for (const note of affected) {
        const nextTags = note.tags.filter((tag) => tag !== target);
        const fv: FieldVersions = { ...(note.fieldVersions ?? {}) };
        const { next: fv1 } = bumpFieldVersion(fv, 'tags');
        Object.assign(fv, fv1);
        await db.notes.update(note.id, { tags: nextTags, updatedAt: t, fieldVersions: fv });
        affectedPayload.push({ noteId: note.id, fieldVersions: fv });
      }
      await db.tags.delete(target);
      enqueue({
        kind: 'deleteTag',
        name: target,
        affected: affectedPayload,
        clientTimestamp: t
      });
    });
    return affected.length;
  }
};
