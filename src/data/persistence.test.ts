import { describe, it, expect, beforeEach } from 'vitest';
import { noteRepository } from './noteRepository';
import { noteQuery } from './noteQuery';
import { db } from './db';

async function clearAll() {
  await db.notes.clear();
  await db.tags.clear();
}

/**
 * Simulates application restart by closing and re-opening the database connection.
 * Verifies the data layer is durable and that indexed lookup still works after a restart.
 */
async function simulateRestart() {
  db.close();
  await db.open();
}

describe('persistence', () => {
  beforeEach(async () => {
    await clearAll();
  });

  it('notes survive an application restart', async () => {
    const note = await noteRepository.create({ title: 'durable', content: 'hello', tags: ['keep'] });
    await simulateRestart();
    const got = await noteRepository.get(note.id);
    expect(got).toBeTruthy();
    expect(got?.title).toBe('durable');
    expect(got?.tags).toEqual(['keep']);
  });

  it('archive and trash states survive a restart', async () => {
    const a = await noteRepository.create({ title: 'a', content: 'aa', tags: [] });
    const b = await noteRepository.create({ title: 'b', content: 'bb', tags: [] });
    await noteRepository.archive(a.id, true);
    await noteRepository.softDelete(b.id);
    await simulateRestart();
    expect((await noteRepository.get(a.id))?.isArchived).toBe(true);
    expect((await noteRepository.get(b.id))?.isDeleted).toBe(true);
  });

  it('pinned ordering and tags survive a restart', async () => {
    const a = await noteRepository.create({ title: 'a', content: '', tags: ['x'] });
    const b = await noteRepository.create({ title: 'b', content: '', tags: ['y'] });
    await noteRepository.pin(b.id, true);
    await simulateRestart();
    const res = await noteQuery.list({ sort: 'pinned' });
    expect(res[0].id).toBe(b.id);
    expect(res[1].id).toBe(a.id);
  });
});
