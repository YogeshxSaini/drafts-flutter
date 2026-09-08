import { describe, it, expect, beforeEach } from 'vitest';
import { noteRepository } from './noteRepository';
import { noteQuery } from './noteQuery';
import { db } from './db';

async function clearAll() {
  await db.notes.clear();
  await db.tags.clear();
}

describe('noteQuery', () => {
  beforeEach(async () => {
    await clearAll();
  });

  it('searches title', async () => {
    await noteRepository.create({ title: 'Shopping list', content: '', tags: [] });
    await noteRepository.create({ title: 'Daily standup', content: '', tags: [] });
    const res = await noteQuery.list({ query: 'shopping' });
    expect(res).toHaveLength(1);
    expect(res[0].title).toBe('Shopping list');
  });

  it('searches content case-insensitively', async () => {
    await noteRepository.create({ title: 'a', content: 'Hello World', tags: [] });
    const res = await noteQuery.list({ query: 'world' });
    expect(res).toHaveLength(1);
  });

  it('searches tags', async () => {
    await noteRepository.create({ title: 'a', content: '', tags: ['productivity'] });
    await noteRepository.create({ title: 'b', content: '', tags: ['work'] });
    const res = await noteQuery.list({ query: 'productivity' });
    expect(res).toHaveLength(1);
  });

  it('requires all tokens to match', async () => {
    await noteRepository.create({ title: 'a', content: 'foo bar', tags: [] });
    await noteRepository.create({ title: 'a', content: 'foo', tags: [] });
    const res = await noteQuery.list({ query: 'foo bar' });
    expect(res).toHaveLength(1);
  });

  it('returns empty when nothing matches', async () => {
    await noteRepository.create({ title: 'a', content: 'b', tags: [] });
    const res = await noteQuery.list({ query: 'nope' });
    expect(res).toHaveLength(0);
  });

  it('filters by tag', async () => {
    await noteRepository.create({ title: 'a', content: '', tags: ['x'] });
    await noteRepository.create({ title: 'b', content: '', tags: ['y'] });
    const res = await noteQuery.list({ tags: ['x'] });
    expect(res).toHaveLength(1);
    expect(res[0].title).toBe('a');
  });

  it('excludes archived unless asked', async () => {
    const a = await noteRepository.create({ title: 'a', content: '', tags: [] });
    await noteRepository.archive(a.id, true);
    expect(await noteQuery.list({ includeArchived: false })).toHaveLength(0);
    expect(await noteQuery.list({ includeArchived: true })).toHaveLength(1);
  });

  it('excludes deleted unless asked', async () => {
    const a = await noteRepository.create({ title: 'a', content: '', tags: [] });
    await noteRepository.softDelete(a.id);
    expect(await noteQuery.list({ includeDeleted: false })).toHaveLength(0);
    expect(await noteQuery.list({ includeDeleted: true })).toHaveLength(1);
  });

  it('sorts by updated (descending) by default', async () => {
    const a = await noteRepository.create({ title: 'a', content: '', tags: [] });
    await new Promise((r) => setTimeout(r, 5));
    const b = await noteRepository.create({ title: 'b', content: '', tags: [] });
    const res = await noteQuery.list({});
    expect(res[0].id).toBe(b.id);
    expect(res[1].id).toBe(a.id);
  });

  it('sorts alphabetically', async () => {
    await noteRepository.create({ title: 'banana', content: '', tags: [] });
    await noteRepository.create({ title: 'apple', content: '', tags: [] });
    const res = await noteQuery.list({ sort: 'alpha' });
    expect(res[0].title).toBe('apple');
  });

  it('sorts pinned first', async () => {
    const a = await noteRepository.create({ title: 'a', content: '', tags: [] });
    const b = await noteRepository.create({ title: 'b', content: '', tags: [] });
    await noteRepository.pin(a.id, true);
    const res = await noteQuery.list({ sort: 'pinned' });
    expect(res[0].id).toBe(a.id);
    expect(res[1].id).toBe(b.id);
  });

  it('counts by view', async () => {
    const a = await noteRepository.create({ title: 'a', content: '', tags: [] });
    const b = await noteRepository.create({ title: 'b', content: '', tags: [] });
    await noteRepository.pin(b.id, true);
    await noteRepository.archive(a.id, true);
    const c = await noteRepository.create({ title: 'c', content: '', tags: [] });
    await noteRepository.softDelete(c.id);
    const counts = await noteQuery.countByView();
    expect(counts.inbox).toBe(1);
    expect(counts.archived).toBe(1);
    expect(counts.trash).toBe(1);
    expect(counts.pinned).toBe(1);
  });
});
