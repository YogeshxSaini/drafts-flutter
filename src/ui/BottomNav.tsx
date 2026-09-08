import { useEffect, useState } from 'react';
import { app } from '../state/appStore';
import { IconInbox, IconPin, IconArchive, IconTrash, IconSearch } from './icons';
import { useMediaQuery } from './useMediaQuery';

export function BottomNav() {
  const isMobile = useMediaQuery('(max-width: 720px)');
  const view = app((s) => s.view);
  const setView = app((s) => s.setView);
  if (!isMobile) return null;

  function active(kind: string) {
    return view.kind === kind;
  }

  return (
    <nav className="bottom-nav" aria-label="Bottom navigation">
      <button className={active('inbox') ? 'is-active' : ''} onClick={() => setView({ kind: 'inbox' })}>
        <IconInbox />
        <span>Inbox</span>
      </button>
      <button className={active('pinned') ? 'is-active' : ''} onClick={() => setView({ kind: 'pinned' })}>
        <IconPin />
        <span>Pinned</span>
      </button>
      <button
        onClick={() => {
          setView({ kind: 'search' });
          setTimeout(() => {
            const input = document.getElementById('search-input') as HTMLInputElement | null;
            input?.focus();
          }, 0);
        }}
        className={active('search') ? 'is-active' : ''}
      >
        <IconSearch />
        <span>Search</span>
      </button>
      <button className={active('archive') ? 'is-active' : ''} onClick={() => setView({ kind: 'archive' })}>
        <IconArchive />
        <span>Archive</span>
      </button>
      <button className={active('trash') ? 'is-active' : ''} onClick={() => setView({ kind: 'trash' })}>
        <IconTrash />
        <span>Trash</span>
      </button>
    </nav>
  );
}

export function Toast() {
  const toast = app((s) => s.toast);
  const hide = app((s) => s.hideToast);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => hide(), 6000);
    return () => clearTimeout(t);
  }, [toast, hide]);

  if (!toast) return null;
  return (
    <div className="toast" role="status" aria-live="polite">
      <span>{toast.message}</span>
      {toast.action && (
        <button
          onClick={() => {
            toast.action!.run();
            hide();
          }}
        >
          {toast.action.label}
        </button>
      )}
    </div>
  );
}

export function EmptyTrashButton() {
  const view = app((s) => s.view);
  const counts = app((s) => s.counts);
  const emptyTrash = app((s) => s.emptyTrash);
  const isMobile = useMediaQuery('(max-width: 720px)');
  const [confirm, setConfirm] = useState(false);

  if (view.kind !== 'trash') return null;
  if (counts.trash === 0) return null;
  if (!confirm) {
    return (
      <div className="archived-banner" style={{ background: 'var(--danger-soft)', color: 'var(--danger)' }}>
        <IconTrash size={14} />
        <span>{counts.trash} note{counts.trash === 1 ? '' : 's'} in Trash</span>
        <button onClick={() => setConfirm(true)} style={{ color: 'var(--danger)' }}>Empty Trash</button>
      </div>
    );
  }
  return (
    <div className="archived-banner" style={{ background: 'var(--danger-soft)', color: 'var(--danger)' }}>
      <span>Are you sure? This cannot be undone.</span>
      <button onClick={() => void emptyTrash()} style={{ color: 'var(--danger)', fontWeight: 600 }}>Yes, empty</button>
      <button onClick={() => setConfirm(false)}>Cancel</button>
    </div>
  );
}
