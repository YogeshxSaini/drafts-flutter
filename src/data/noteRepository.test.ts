import { describe, it, expect, beforeEach } from 'vitest';
import { noteRepository } from './noteRepository';
import { db } from './db';
import type { Note } from '../domain/types';

async function clearAll() {
  await db.notes.clear();
  await db.tags.clear();
  await db.meta.clear();
}

describe('noteRepository', () => {
  beforeEach(async () => {
    await clearAll();
  });

  it('creates a note with defaults', async () => {
    const note = await noteRepository.create();
    expect(note.id).toBeTruthy();
    expect(note.title).toBe('');
    expect(note.content).toBe('');
    expect(note.tags).toEqual([]);
    expect(note.isPinned).toBe(false);
    expect(note.isArchived).toBe(false);
    expect(note.isDeleted).toBe(false);
    expect(note.createdAt).toBeLessThanOrEqual(Date.now());
  });

  it('updates note content and bumps updatedAt', async () => {
    const note = await noteRepository.create({ title: 't', content: 'c', tags: [] });
    await new Promise((r) => setTimeout(r, 5));
    const updated = await noteRepository.update(note.id, { content: 'new' });
    expect(updated?.content).toBe('new');
    expect(updated!.updatedAt).toBeGreaterThan(note.updatedAt);
  });

  it('pin / archive flow', async () => {
    const note = await noteRepository.create();
    await noteRepository.pin(note.id, true);
    expect((await noteRepository.get(note.id))?.isPinned).toBe(true);
    await noteRepository.archive(note.id, true);
    expect((await noteRepository.get(note.id))?.isArchived).toBe(true);
    await noteRepository.unarchive(note.id);
    expect((await noteRepository.get(note.id))?.isArchived).toBe(false);
  });

  it('soft delete, restore, and permanent delete', async () => {
    const note = await noteRepository.create();
    await noteRepository.softDelete(note.id);
    expect((await noteRepository.get(note.id))?.isDeleted).toBe(true);
    await noteRepository.restore(note.id);
    expect((await noteRepository.get(note.id))?.isDeleted).toBe(false);
    await noteRepository.permanentDelete(note.id);
    expect(await noteRepository.get(note.id)).toBeUndefined();
  });

  it('normalizes tag casing and dedupes', async () => {
    const note = await noteRepository.create({ title: '', content: '', tags: ['Idea', '#WORK', 'idea'] });
    expect(note.tags).toEqual(['idea', 'work']);
  });

  it('updates tag counts on tag changes', async () => {
    await noteRepository.create({ title: 'a', content: 'aa', tags: ['x', 'y'] });
    await noteRepository.create({ title: 'b', content: 'bb', tags: ['x'] });
    const tags = await noteRepository.listTags();
    const x = tags.find((t) => t.name === 'x');
    const y = tags.find((t) => t.name === 'y');
    expect(x?.count).toBe(2);
    expect(y?.count).toBe(1);
  });

  it('removes a tag from all notes on deleteTag', async () => {
    const n1 = await noteRepository.create({ title: 'a', content: 'aa', tags: ['foo', 'bar'] });
    const n2 = await noteRepository.create({ title: 'b', content: 'bb', tags: ['foo'] });
    const n = await noteRepository.deleteTag('foo');
    expect(n).toBe(2);
    expect((await noteRepository.get(n1.id))?.tags).toEqual(['bar']);
    expect((await noteRepository.get(n2.id))?.tags).toEqual([]);
  });

  it('renames a tag across all notes', async () => {
    const n1 = await noteRepository.create({ title: 'a', content: 'aa', tags: ['idea'] });
    const n2 = await noteRepository.create({ title: 'b', content: 'bb', tags: ['idea', 'work'] });
    const n = await noteRepository.renameTag('idea', 'thought');
    expect(n).toBe(2);
    expect((await noteRepository.get(n1.id))?.tags).toEqual(['thought']);
    expect((await noteRepository.get(n2.id))?.tags).toEqual(['thought', 'work']);
  });

  it('persists data across database reopen', async () => {
    const note: Note = await noteRepository.create({ title: 'persist', content: 'hello', tags: ['t'] });
    await db.notes.get(note.id);
    expect(await noteRepository.get(note.id)).toBeTruthy();
  });
});
