import { useEffect, useMemo, useState } from 'react';
import { app } from '../state/appStore';
import { IconCommand, IconInbox, IconPin, IconArchive, IconTrash, IconPlus, IconSearch, IconSun, IconMoon, IconSidebar } from './icons';
import { useOnClickOutside } from './useOnClickOutside';
import { useTheme } from './useTheme';
import { useMediaQuery } from './useMediaQuery';

const ACTIONS = [
  { id: 'new', label: 'New note', icon: <IconPlus size={14} />, shortcut: '⌘N' },
  { id: 'inbox', label: 'Go to Inbox', icon: <IconInbox size={14} />, shortcut: '⌘1' },
  { id: 'pinned', label: 'Go to Pinned', icon: <IconPin size={14} />, shortcut: '⌘2' },
  { id: 'archive', label: 'Go to Archive', icon: <IconArchive size={14} />, shortcut: '⌘3' },
  { id: 'trash', label: 'Go to Trash', icon: <IconTrash size={14} />, shortcut: '⌘4' },
  { id: 'theme', label: 'Toggle theme', icon: <IconSun size={14} />, shortcut: '⌘.' },
  { id: 'toggle-sidebar', label: 'Toggle sidebar', icon: <IconSidebar size={14} />, shortcut: '⌘\\' }
];

export function CommandPalette() {
  const open = app((s) => s.commandOpen);
  const close = app((s) => s.closeCommand);
  const [q, setQ] = useState('');
  const [active, setActive] = useState(0);
  const ref = useOnClickOutside<HTMLDivElement>(close);

  useEffect(() => {
    if (open) {
      setQ('');
      setActive(0);
    }
  }, [open]);

  const filtered = useMemo(() => {
    const term = q.toLowerCase();
    return ACTIONS.filter((a) => a.label.toLowerCase().includes(term));
  }, [q]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setActive((i) => Math.min(i + 1, filtered.length - 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setActive((i) => Math.max(i - 1, 0));
      } else if (e.key === 'Enter') {
        e.preventDefault();
        const item = filtered[active];
        if (item) run(item.id);
      } else if (e.key === 'Escape') {
        e.preventDefault();
        close();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, filtered, active, close]);

  if (!open) return null;

  function run(id: string) {
    switch (id) {
      case 'new':
        void app.getState().createNote();
        break;
      case 'inbox':
        app.getState().setView({ kind: 'inbox' });
        break;
      case 'pinned':
        app.getState().setView({ kind: 'pinned' });
        break;
      case 'archive':
        app.getState().setView({ kind: 'archive' });
        break;
      case 'trash':
        app.getState().setView({ kind: 'trash' });
        break;
      case 'theme':
        toggleTheme();
        break;
      case 'toggle-sidebar':
        app.getState().toggleSidebar();
        break;
    }
    close();
  }

  return (
    <div className="command-palette" role="dialog" aria-modal="true" aria-label="Command palette">
      <div className="scrim" onClick={close} />
      <div className="panel" ref={ref}>
        <div style={{ display: 'flex', alignItems: 'center', padding: '0 12px', borderBottom: '1px solid var(--border)' }}>
          <IconCommand size={16} style={{ color: 'var(--fg-subtle)' }} />
          <input
            autoFocus
            placeholder="Type a command…"
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setActive(0);
            }}
          />
        </div>
        <div className="command-list">
          {filtered.length === 0 ? (
            <div style={{ padding: 12, color: 'var(--fg-muted)', fontSize: 13 }}>No matching commands</div>
          ) : (
            filtered.map((a, i) => (
              <button key={a.id} className={`command-item ${i === active ? 'is-active' : ''}`} onClick={() => run(a.id)} onMouseEnter={() => setActive(i)}>
                <span className="icon">{a.icon}</span>
                <span className="label">{a.label}</span>
                <span className="shortcut">{a.shortcut}</span>
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

let _theme: { toggle: () => void } | null = null;

function toggleTheme() {
  if (!_theme) {
    _theme = useTheme();
  }
  _theme.toggle();
}

export function TopBar() {
  const view = app((s) => s.view);
  const query = app((s) => s.query);
  const setQuery = app((s) => s.setQuery);
  const toggleSidebar = app((s) => s.toggleSidebar);
  const isMobile = useMediaQuery('(max-width: 720px)');
  const { resolved, toggle } = useTheme();
  _theme = { toggle };

  return (
    <div className="topbar">
      <button className="icon-button" aria-label="Open sidebar" onClick={toggleSidebar}>
        <IconSidebar />
      </button>
      <div className="title">{viewLabel(view)}</div>
      <div className="spacer" />
      <div className="search">
        <span className="icon">
          <IconSearch size={14} />
        </span>
        <input
          id="search-input"
          placeholder="Search notes…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <kbd>⌘F</kbd>
      </div>
      {!isMobile && (
        <button className="icon-button" aria-label="Toggle theme" onClick={toggle} title="Toggle theme (⌘.)">
          {resolved === 'dark' ? <IconSun /> : <IconMoon />}
        </button>
      )}
      <button
        className="button is-primary"
        onClick={() => void app.getState().createNote()}
        title="New note (⌘N)"
      >
        <IconPlus size={14} /> New
      </button>
    </div>
  );
}

function viewLabel(view: import('../state/appStore').View) {
  switch (view.kind) {
    case 'inbox':
      return 'Inbox';
    case 'pinned':
      return 'Pinned';
    case 'archive':
      return 'Archive';
    case 'trash':
      return 'Trash';
    case 'tag':
      return `#${view.name}`;
    case 'search':
      return 'Search';
  }
}
