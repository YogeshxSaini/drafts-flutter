import { useEffect, useMemo, useRef, useState } from 'react';
import { app } from '../state/appStore';
import { formatRelativeTime, previewText } from '../domain/utils';
import { IconChecklist, IconInbox, IconNote, IconPin, IconSearch, IconSort, IconTag as IconTagIcon, IconArchive, IconTrash } from './icons';
import { useMediaQuery } from './useMediaQuery';
import type { SortKey } from '../domain/types';
import { useHotkey } from './useHotkey';

const SORT_LABELS: Record<SortKey, string> = {
  updated: 'Recently modified',
  created: 'Recently created',
  alpha: 'Alphabetical',
  pinned: 'Pinned first'
};

export function NoteList() {
  const notes = app((s) => s.notes);
  const selectedId = app((s) => s.selectedId);
  const view = app((s) => s.view);
  const query = app((s) => s.query);
  const sort = app((s) => s.sort);
  const setSort = app((s) => s.setSort);
  const select = app((s) => s.select);
  const setView = app((s) => s.setView);
  const setQuery = app((s) => s.setQuery);
  const isMobile = useMediaQuery('(max-width: 720px)');
  const [showSort, setShowSort] = useState(false);

  useHotkey('cmd+f', () => {
    const input = document.getElementById('search-input') as HTMLInputElement | null;
    if (input) {
      input.focus();
      input.select();
    }
  });

  const viewLabel = useMemo(() => {
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
        return `Search: "${query}"`;
      default:
        return 'Notes';
    }
  }, [view, query]);

  const ViewIcon = useMemo(() => {
    switch (view.kind) {
      case 'inbox':
        return IconInbox;
      case 'pinned':
        return IconPin;
      case 'archive':
        return IconArchive;
      case 'trash':
        return IconTrash;
      case 'tag':
        return IconTagIcon;
      case 'search':
        return IconSearch;
      default:
        return IconNote;
    }
  }, [view]);

  const empty = (
    <EmptyState view={view} query={query} onClearQuery={() => setQuery('')} onNewNote={() => void app.getState().createNote()} />
  );

  if (isMobile) {
    return (
      <div className="list-pane">
        <div className="mobile-header">
          <ViewIcon size={18} />
          <div className="title" style={{ fontSize: 15, fontWeight: 600 }}>
            {viewLabel}
          </div>
          <div className="spacer" />
          <button className="icon-button" aria-label="Sort" onClick={() => setShowSort((v) => !v)}>
            <IconSort />
          </button>
        </div>
        {showSort && (
          <div className="mobile-bar" style={{ borderTop: '1px solid var(--border)' }}>
            <span style={{ fontSize: 12, color: 'var(--fg-muted)' }}>Sort:</span>
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as SortKey)}
              style={{ background: 'var(--bg-sunken)', border: '1px solid var(--border)', borderRadius: 6, padding: '4px 6px', color: 'var(--fg)' }}
            >
              {(Object.entries(SORT_LABELS) as [SortKey, string][]).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
          </div>
        )}
        {notes.length === 0 ? (
          empty
        ) : (
          <div className="list">
            {notes.map((n) => (
              <NoteRow key={n.id} note={n} selected={n.id === selectedId} onSelect={() => select(n.id)} />
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="list-pane">
      <div className="list-header">
        <ViewIcon size={16} />
        <span className="label">{viewLabel}</span>
        <span style={{ color: 'var(--fg-subtle)', fontSize: 12 }}>{notes.length}</span>
        <div className="spacer" />
        <div className="sort-menu">
          <button className="icon-button" aria-label="Sort" onClick={() => setShowSort((v) => !v)}>
            <IconSort />
          </button>
          {showSort && (
            <div className="menu-popover" style={{ right: 0, top: 'calc(100% + 4px)' }}>
              {(Object.entries(SORT_LABELS) as [SortKey, string][]).map(([k, v]) => (
                <button
                  key={k}
                  className="menu-item"
                  onClick={() => {
                    setSort(k);
                    setShowSort(false);
                  }}
                  style={k === sort ? { background: 'var(--bg-active)' } : undefined}
                >
                  <span>{v}</span>
                  {k === sort && <span style={{ marginLeft: 'auto', color: 'var(--accent)' }}>•</span>}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
      {notes.length === 0 ? (
        empty
      ) : (
        <div className="list">
          {notes.map((n) => (
            <NoteRow key={n.id} note={n} selected={n.id === selectedId} onSelect={() => select(n.id)} />
          ))}
        </div>
      )}
    </div>
  );
}

function NoteRow({ note, selected, onSelect }: { note: import('../domain/types').Note; selected: boolean; onSelect: () => void }) {
  const preview = note.content ? previewText(note.content, 160) : 'No content';
  return (
    <button className={`list-item ${selected ? 'is-selected' : ''}`} onClick={onSelect}>
      <div className="row1">
        {note.isPinned && <IconPin size={12} className="nav-icon" style={{ color: 'var(--accent)' }} />}
        <span className="title">{note.title || 'Untitled'}</span>
        <span className="when">{formatRelativeTime(note.updatedAt)}</span>
      </div>
      <div className="preview">{preview}</div>
      {(note.tags.length > 0 || note.isArchived) && (
        <div className="row3">
          {note.tags.slice(0, 4).map((t) => (
            <span key={t} className="tag-pill" style={{ fontSize: 11, padding: '1px 6px' }}>
              #{t}
            </span>
          ))}
          {note.tags.length > 4 && <span style={{ color: 'var(--fg-subtle)', fontSize: 11 }}>+{note.tags.length - 4}</span>}
          {note.isArchived && <span className="tag-pill" style={{ background: 'var(--bg-sunken)', color: 'var(--fg-muted)' }}>Archived</span>}
        </div>
      )}
    </button>
  );
}

function EmptyState({ view, query, onClearQuery, onNewNote }: { view: import('../state/appStore').View; query: string; onClearQuery: () => void; onNewNote: () => void }) {
  let title = 'No notes yet';
  let body = 'Start writing to capture a thought.';
  let action: React.ReactNode = (
    <button className="button is-primary" onClick={onNewNote} style={{ marginTop: 12 }}>
      New note
    </button>
  );

  if (view.kind === 'search' || query.trim()) {
    title = 'No notes found';
    body = `No matches for "${query}".`;
    action = (
      <button className="button" onClick={onClearQuery} style={{ marginTop: 12 }}>
        Clear search
      </button>
    );
  } else if (view.kind === 'archive') {
    title = 'Nothing archived';
    body = 'Your archived notes will appear here.';
  } else if (view.kind === 'trash') {
    title = 'Trash is empty';
    body = 'Deleted notes show up here.';
  } else if (view.kind === 'pinned') {
    title = 'No pinned notes';
    body = 'Pin important notes to keep them at hand.';
    action = null;
  } else if (view.kind === 'tag') {
    title = `No notes tagged #${view.name}`;
    body = 'Add this tag to a note to see it here.';
    action = null;
  }

  return (
    <div className="empty">
      <div>
        <IconChecklist size={36} className="icon" style={{ display: 'block', margin: '0 auto 12px' }} />
        <h3>{title}</h3>
        <p>{body}</p>
        {action}
      </div>
    </div>
  );
}
