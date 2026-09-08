import { syncStatus } from '../sync/status';
import { engine } from '../sync';
import { formatRelativeTime } from '../domain/utils';

export function SyncStatusBar() {
  const state = syncStatus((s) => s.state);
  const pendingCount = syncStatus((s) => s.pendingCount);
  const lastSyncedAt = syncStatus((s) => s.lastSyncedAt);
  const error = syncStatus((s) => s.error);

  let label: string;
  if (state === 'syncing') label = 'Syncing…';
  else if (state === 'offline') label = `Offline — ${pendingCount} pending`;
  else if (state === 'error') label = `Sync error — ${error ?? 'unknown'}`;
  else if (lastSyncedAt) label = `Synced ${formatRelativeTime(lastSyncedAt)}`;
  else label = 'Not synced yet';

  return (
    <footer className="sync-status-bar" aria-live="polite">
      <span className="sync-status-bar__label" data-state={state}>{label}</span>
      <button
        type="button"
        className="sync-status-bar__button"
        onClick={() => {
          void engine.syncNow();
        }}
      >
        Sync now
      </button>
    </footer>
  );
}
