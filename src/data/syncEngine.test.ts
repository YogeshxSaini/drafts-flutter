import { describe, it, expect, beforeEach } from 'vitest';
import { db } from './db';
import { wrappedNoteRepository } from './wrappedNoteRepository';
import { SyncEngine } from '../sync/engine';
import { FakeRemote } from '../sync/fakeTransport';
import { setSyncState, syncStatus } from '../sync/status';
import { setSyncPending } from '../sync/status';

async function clearAll() {
  await db.notes.clear();
  await db.tags.clear();
  await db.outbox.clear();
  await db.meta.clear();
}

describe('sync engine', () => {
  beforeEach(async () => {
    await clearAll();
    setSyncState('idle');
    setSyncPending(0);
    syncStatus.setState({ state: 'idle', pendingCount: 0, lastSyncedAt: null, error: null });
  });

  it('pushes created notes to the FakeRemote and drains the outbox', async () => {
    const remote = new FakeRemote({ heartbeat: true });
    const engine = new SyncEngine({
      transport: remote,
      onRemoteChange: () => {}
    });
    engine.setUser('u1');

    const note = await wrappedNoteRepository.create({ title: 'hi', content: 'world', tags: ['draft'] });
    expect(await db.outbox.count()).toBeGreaterThan(0);

    await engine.syncNow();
    expect(await db.outbox.count()).toBe(0);

    const row = remote.__getRow(note.id);
    expect(row).toBeTruthy();
    expect(row?.note.title).toBe('hi');
    expect(row?.note.tags).toEqual(['draft']);
    expect(syncStatus.getState().state).toBe('idle');
    expect(syncStatus.getState().pendingCount).toBe(0);
  });

  it('pulls remote rows and applies them locally', async () => {
    const remote = new FakeRemote({ heartbeat: true });
    const engine = new SyncEngine({
      transport: remote,
      onRemoteChange: () => {}
    });
    engine.setUser('u1');

    const remoteRow = {
      id: 'n-remote-1',
      note: {
        id: 'n-remote-1',
        title: 'from another device',
        content: 'pulled in',
        tags: ['shared'],
        createdAt: 1000,
        updatedAt: 1000,
        isPinned: false,
        isArchived: false,
        isDeleted: false,
        deletedAt: null,
        fieldVersions: { title: 1, content: 1, tags: 1 }
      },
      fieldVersions: { title: 1, content: 1, tags: 1 },
      tombstone: false,
      updatedAt: 1000
    };
    remote.__injectRemoteRow(remoteRow);

    await engine.syncNow();

    const stored = await db.notes.get('n-remote-1');
    expect(stored).toBeTruthy();
    expect(stored?.title).toBe('from another device');
    expect(stored?.tags).toEqual(['shared']);
  });

  it('honors heartbeat failure and reports offline', async () => {
    const remote = new FakeRemote({ heartbeat: false });
    const engine = new SyncEngine({
      transport: remote,
      onRemoteChange: () => {}
    });
    engine.setUser('u1');

    await wrappedNoteRepository.create({ title: 'queued', content: '', tags: [] });
    const pendingBefore = await db.outbox.where('status').equals('pending').count();
    expect(pendingBefore).toBeGreaterThan(0);

    await engine.syncNow();

    expect(syncStatus.getState().state).toBe('offline');
    expect(await db.outbox.where('status').equals('pending').count()).toBe(pendingBefore);
  });

  it('soft-delete then perm-delete round-trips correctly', async () => {
    const remote = new FakeRemote({ heartbeat: true });
    const engine = new SyncEngine({
      transport: remote,
      onRemoteChange: () => {}
    });
    engine.setUser('u1');

    const note = await wrappedNoteRepository.create({ title: 'to delete', content: '', tags: [] });
    await wrappedNoteRepository.softDelete(note.id);
    await engine.syncNow();

    const afterSoft = remote.__getRow(note.id);
    expect(afterSoft?.note.isDeleted).toBe(true);
    expect(afterSoft?.tombstone).toBe(false);

    await wrappedNoteRepository.permanentDelete(note.id);
    await engine.syncNow();

    const afterPerm = remote.__getRow(note.id);
    expect(afterPerm?.tombstone).toBe(true);
    expect(await db.notes.get(note.id)).toBeUndefined();
  });
});
