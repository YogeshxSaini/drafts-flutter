import { create } from '../state/createStore';

export type SyncState = 'idle' | 'syncing' | 'offline' | 'error';

export interface SyncStatus {
  state: SyncState;
  pendingCount: number;
  lastSyncedAt: number | null;
  error: string | null;
}

const initial: SyncStatus = {
  state: 'idle',
  pendingCount: 0,
  lastSyncedAt: null,
  error: null
};

export const syncStatus = create<SyncStatus>(() => initial);

export function setSyncState(state: SyncState) {
  syncStatus.setState({ state });
}

export function setSyncError(error: string | null) {
  if (error) {
    syncStatus.setState({ state: 'error', error });
  } else {
    syncStatus.setState({ error: null });
  }
}

export function setSyncPending(count: number) {
  syncStatus.setState({ pendingCount: count });
}

export function markSynced(ts: number) {
  syncStatus.setState({ state: 'idle', lastSyncedAt: ts, error: null });
}
