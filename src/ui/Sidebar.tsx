import { useState } from 'react';
import { app } from '../state/appStore';
import { IconInbox, IconPin, IconArchive, IconTrash, IconTag as IconTagIcon, IconPlus, IconMenu, IconSearch } from './icons';
import { useOnClickOutside } from './useOnClickOutside';
import { useMediaQuery } from './useMediaQuery';
import type { View } from '../state/appStore';

export function Sidebar() {
  const counts = app((s) => s.counts);
  const tags = app((s) => s.tags);
  const view = app((s) => s.view);
  const setView = app((s) => s.setView);
  const sidebarOpen = app((s) => s.sidebarOpen);
  const closeSidebar = app((s) => s.closeSidebar);
  const setQuery = app((s) => s.setQuery);
  const isMobile = useMediaQuery('(max-width: 720px)');

  const [showTagMenu, setShowTagMenu] = useState<string | null>(null);

  const ref = useOnClickOutside<HTMLElement>(() => {
    if (isMobile) closeSidebar();
  });

  return (
    <aside ref={ref} className={`sidebar ${sidebarOpen ? 'is-open' : ''}`}>
      <div className="sidebar-header">
        <div className="brand">
          <span className="brand-mark">i</span>
          <span>Inkwell</span>
        </div>
        <div style={{ marginLeft: 'auto' }}>
          <button
            className="icon-button"
            aria-label="New note"
            title="New note (Cmd+N)"
            onClick={() => void app.getState().createNote()}
          >
            <IconPlus />
          </button>
        </div>
      </div>

      <div className="sidebar-section">
        <NavRow active={view.kind === 'inbox'} onClick={() => setView({ kind: 'inbox' })} icon={<IconInbox />} label="Inbox" count={counts.inbox} />
        <NavRow active={view.kind === 'pinned'} onClick={() => setView({ kind: 'pinned' })} icon={<IconPin />} label="Pinned" count={counts.pinned} />
        <NavRow active={view.kind === 'archive'} onClick={() => setView({ kind: 'archive' })} icon={<IconArchive />} label="Archive" count={counts.archived} />
        <NavRow active={view.kind === 'trash'} onClick={() => setView({ kind: 'trash' })} icon={<IconTrash />} label="Trash" count={counts.trash} />
      </div>

      <div className="sidebar-section">
        <div className="sidebar-section-label">Tags</div>
        <div className="sidebar-tags">
          {tags.length === 0 && (
            <div style={{ padding: '6px 10px', fontSize: 12, color: 'var(--fg-subtle)' }}>
              No tags yet. Type a tag in the editor to create one.
            </div>
          )}
          {tags.map((t) => (
            <TagRow
              key={t.name}
              name={t.name}
              count={t.count}
              active={view.kind === 'tag' && view.name === t.name}
              onClick={() => setView({ kind: 'tag', name: t.name })}
              onRename={() => {
                const next = prompt('Rename tag', t.name);
                if (next && next !== t.name) void app.getState().renameTag(t.name, next);
                setShowTagMenu(null);
              }}
              onDelete={() => {
                if (confirm(`Remove tag #${t.name} from ${t.count} note${t.count === 1 ? '' : 's'}?`)) {
                  void app.getState().deleteTag(t.name);
                }
                setShowTagMenu(null);
              }}
            />
          ))}
        </div>
      </div>

      <div className="sidebar-footer">
        <button
          className="icon-button"
          aria-label="Search"
          onClick={() => {
            setQuery('');
            setView({ kind: 'search' });
            setTimeout(() => {
              const input = document.getElementById('search-input') as HTMLInputElement | null;
              input?.focus();
            }, 0);
          }}
        >
          <IconSearch />
        </button>
        <span style={{ fontSize: 12, color: 'var(--fg-subtle)' }}>Search notes</span>
      </div>
    </aside>
  );
}

function NavRow({ active, onClick, icon, label, count }: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string; count?: number }) {
  return (
    <button className={`nav-item ${active ? 'is-active' : ''}`} onClick={onClick}>
      <span className="nav-icon" aria-hidden>
        {icon}
      </span>
      <span>{label}</span>
      {count !== undefined && <span className="count">{count}</span>}
    </button>
  );
}

function TagRow({
  name,
  count,
  active,
  onClick,
  onRename,
  onDelete
}: {
  name: string;
  count: number;
  active: boolean;
  onClick: () => void;
  onRename: () => void;
  onDelete: () => void;
}) {
  return (
    <div className={`tag-row ${active ? 'is-active' : ''}`} onClick={onClick} role="button" tabIndex={0}>
      <span className="swatch" />
      <span className="name">#{name}</span>
      <span className="count">{count}</span>
      <button
        className="icon-button"
        aria-label="Tag actions"
        title="Tag actions"
        onClick={(e) => {
          e.stopPropagation();
          const choice = prompt(`Tag #${name}\n\n1 = Rename\n2 = Delete`, '1');
          if (choice === '1') onRename();
          else if (choice === '2') onDelete();
        }}
        style={{ width: 22, height: 22 }}
      >
        <span style={{ fontSize: 14, lineHeight: 1 }}>⋯</span>
      </button>
    </div>
  );
}
