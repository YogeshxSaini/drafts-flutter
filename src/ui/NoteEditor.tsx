import { useEffect, useRef, useState } from 'react';
import { app } from '../state/appStore';
import { noteRepository } from '../data/noteRepository';
import { debounce } from '../domain/utils';
import { IconBold, IconCode, IconHeading, IconItalic, IconLink, IconList, IconChecklist, IconQuote, IconPlus, IconPin, IconArchive, IconTrash, IconMore, IconUnarchive } from './icons';
import { useOnClickOutside } from './useOnClickOutside';
import { useHotkey } from './useHotkey';
import { formatRelativeTime } from '../domain/utils';

interface Props {
  id: string;
  onDelete: () => void;
  onArchive: () => void;
  onUnarchive: () => void;
  onRestore: () => void;
  onPermanentDelete: () => void;
  isTrashView: boolean;
  isArchiveView: boolean;
}

export function NoteEditor({ id, onDelete, onArchive, onUnarchive, onRestore, onPermanentDelete, isTrashView, isArchiveView }: Props) {
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState('');
  const [showMenu, setShowMenu] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);

  const titleRef = useRef<HTMLTextAreaElement>(null);
  const contentRef = useRef<HTMLTextAreaElement>(null);
  const tagInputRef = useRef<HTMLInputElement>(null);
  const menuRef = useOnClickOutside<HTMLDivElement>(() => setShowMenu(false));

  const note = app((s) => s.notes.find((n) => n.id === id));

  useEffect(() => {
    if (!note) return;
    setTitle(note.title);
    setContent(note.content);
    setTags(note.tags);
    setSavedAt(note.updatedAt);
  }, [id, note?.createdAt]);

  const persist = debounce(async (next: { title: string; content: string; tags: string[] }) => {
    setSaving(true);
    try {
      await noteRepository.update(id, next);
      setSavedAt(Date.now());
      void app.getState().refresh();
    } catch (err) {
      console.error('Save failed', err);
      app.getState().showToast('Failed to save — your changes are still in this buffer.');
    } finally {
      setSaving(false);
    }
  }, 350);

  useEffect(() => {
    if (!note) return;
    if (note.isDeleted) return;
    persist({ title, content, tags });
  }, [title, content, tags, id, note?.isDeleted]);

  useHotkey('cmd+b', () => wrapSelection('**', '**'), { allowInInputs: true });
  useHotkey('cmd+i', () => wrapSelection('*', '*'), { allowInInputs: true });
  useHotkey('cmd+k', () => wrapSelection('[', '](url)'), { allowInInputs: true });
  useHotkey('cmd+shift+7', () => prefixLines('# '), { allowInInputs: true });
  useHotkey('cmd+shift+8', () => prefixLines('## '), { allowInInputs: true });
  useHotkey('cmd+shift+9', () => prefixLines('### '), { allowInInputs: true });
  useHotkey('cmd+shift+l', () => prefixLines('- '), { allowInInputs: true });
  useHotkey('cmd+shift+.', () => wrapSelection('`', '`'), { allowInInputs: true });
  useHotkey('cmd+shift+;', () => prefixLines('> '), { allowInInputs: true });
  useHotkey('cmd+shift+enter', () => prefixLines('- [ ] '), { allowInInputs: true });
  useHotkey('cmd+shift+backspace', () => onDelete(), { allowInInputs: true });
  useHotkey('cmd+enter', () => (isArchiveView ? onUnarchive() : onArchive()), { allowInInputs: true });

  if (!note) {
    return (
      <div className="editor-empty">
        <div>
          <h3 style={{ margin: 0, fontSize: 18, color: 'var(--fg)' }}>No note selected</h3>
          <p style={{ color: 'var(--fg-muted)' }}>Pick a note from the list, or create a new one.</p>
        </div>
      </div>
    );
  }

  function applyTextarea(ref: React.RefObject<HTMLTextAreaElement>, value: string, selection?: { start: number; end: number }) {
    const el = ref.current;
    if (!el) return;
    setTimeout(() => {
      el.focus();
      el.value = value;
      el.setSelectionRange(selection?.start ?? value.length, selection?.end ?? value.length);
    }, 0);
  }

  function wrapSelection(left: string, right: string) {
    const el = contentRef.current;
    if (!el) return;
    const start = el.selectionStart;
    const end = el.selectionEnd;
    const before = content.slice(0, start);
    const middle = content.slice(start, end);
    const after = content.slice(end);
    const next = before + left + middle + right + after;
    setContent(next);
    applyTextarea(contentRef, next, { start: start + left.length, end: end + left.length });
  }

  function prefixLines(prefix: string) {
    const el = contentRef.current;
    if (!el) return;
    const start = el.selectionStart;
    const end = el.selectionEnd;
    const before = content.slice(0, start);
    const middle = content.slice(start, end);
    const after = content.slice(end);
    const lineStart = before.lastIndexOf('\n') + 1;
    const block = content.slice(lineStart, end);
    const replaced = block.length ? block.split('\n').map((l) => (l.startsWith(prefix) ? l : prefix + l)).join('\n') : prefix;
    const next = content.slice(0, lineStart) + replaced + after;
    setContent(next);
    applyTextarea(contentRef, next, { start: lineStart, end: lineStart + replaced.length });
  }

  function insertAtCursor(text: string) {
    const el = contentRef.current;
    if (!el) {
      setContent((c) => c + text);
      return;
    }
    const start = el.selectionStart;
    const end = el.selectionEnd;
    const before = content.slice(0, start);
    const after = content.slice(end);
    const next = before + text + after;
    setContent(next);
    applyTextarea(contentRef, next, { start: start + text.length, end: start + text.length });
  }

  function autoResize(el: HTMLTextAreaElement) {
    el.style.height = 'auto';
    el.style.height = el.scrollHeight + 'px';
  }

  function handleTitleKey(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter') {
      e.preventDefault();
      contentRef.current?.focus();
    } else if (e.key === 'Backspace' && title === '') {
      e.preventDefault();
      contentRef.current?.focus();
    }
  }

  function handleContentKey(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Backspace' && content === '' && title === '') {
      e.preventDefault();
      titleRef.current?.focus();
    }
  }

  function addTag(raw: string) {
    const t = raw.trim().replace(/^#+/, '').toLowerCase();
    if (!t) return;
    if (tags.includes(t)) return;
    setTags([...tags, t]);
    setTagInput('');
  }

  function removeTag(name: string) {
    setTags(tags.filter((t) => t !== name));
  }

  function onTagKey(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' || e.key === ',' || e.key === ' ') {
      e.preventDefault();
      addTag(tagInput);
    } else if (e.key === 'Backspace' && tagInput === '' && tags.length > 0) {
      setTags(tags.slice(0, -1));
    }
  }

  const meta = saving ? 'Saving…' : savedAt ? `Saved ${formatRelativeTime(savedAt)}` : '';

  return (
    <div className="editor">
      <div className="editor-toolbar">
        {!isTrashView && (
          <>
            <button className="toolbar-button" onClick={() => wrapSelection('**', '**')} title="Bold (Cmd+B)">
              <IconBold />
            </button>
            <button className="toolbar-button" onClick={() => wrapSelection('*', '*')} title="Italic (Cmd+I)">
              <IconItalic />
            </button>
            <button className="toolbar-button" onClick={() => wrapSelection('[', '](url)')} title="Link (Cmd+K)">
              <IconLink />
            </button>
            <span className="divider" />
            <button className="toolbar-button" onClick={() => prefixLines('# ')} title="Heading 1 (Cmd+Shift+7)">
              <IconHeading />
            </button>
            <button className="toolbar-button" onClick={() => prefixLines('- ')} title="Bulleted list (Cmd+Shift+L)">
              <IconList />
            </button>
            <button className="toolbar-button" onClick={() => prefixLines('- [ ] ')} title="Checklist (Cmd+Shift+Enter)">
              <IconChecklist />
            </button>
            <button className="toolbar-button" onClick={() => wrapSelection('`', '`')} title="Code (Cmd+Shift+.)">
              <IconCode />
            </button>
            <button className="toolbar-button" onClick={() => prefixLines('> ')} title="Quote (Cmd+Shift+;)">
              <IconQuote />
            </button>
            <span className="divider" />
          </>
        )}
        <div className="spacer" style={{ flex: 1 }} />
        <span style={{ fontSize: 11, color: 'var(--fg-subtle)' }}>{meta}</span>
        <div className="menu" ref={menuRef}>
          <button className="icon-button" aria-label="More" onClick={() => setShowMenu((v) => !v)}>
            <IconMore />
          </button>
          {showMenu && (
            <div className="menu-popover">
              {!isTrashView && (
                <>
                  <button
                    className="menu-item"
                    onClick={() => {
                      void app.getState().pin(id, !note.isPinned);
                      setShowMenu(false);
                    }}
                  >
                    <IconPin size={14} />
                    <span>{note.isPinned ? 'Unpin' : 'Pin to top'}</span>
                  </button>
                  <button
                    className="menu-item"
                    onClick={() => {
                      if (isArchiveView) onUnarchive();
                      else onArchive();
                      setShowMenu(false);
                    }}
                  >
                    {isArchiveView ? <IconUnarchive size={14} /> : <IconArchive size={14} />}
                    <span>{isArchiveView ? 'Unarchive' : 'Archive'}</span>
                  </button>
                </>
              )}
              {isTrashView && (
                <button
                  className="menu-item"
                  onClick={() => {
                    onRestore();
                    setShowMenu(false);
                  }}
                >
                  <IconUnarchive size={14} />
                  <span>Restore</span>
                </button>
              )}
              <div className="menu-separator" />
              {isTrashView ? (
                <button
                  className="menu-item"
                  onClick={() => {
                    onPermanentDelete();
                    setShowMenu(false);
                  }}
                  style={{ color: 'var(--danger)' }}
                >
                  <IconTrash size={14} />
                  <span>Delete forever</span>
                </button>
              ) : (
                <button
                  className="menu-item"
                  onClick={() => {
                    onDelete();
                    setShowMenu(false);
                  }}
                  style={{ color: 'var(--danger)' }}
                >
                  <IconTrash size={14} />
                  <span>Move to Trash</span>
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {isArchiveView && (
        <div className="archived-banner">
          <IconArchive size={14} />
          <span>This note is archived.</span>
          <button onClick={onUnarchive}>Unarchive</button>
        </div>
      )}
      {isTrashView && (
        <div className="archived-banner" style={{ color: 'var(--danger)' }}>
          <IconTrash size={14} />
          <span>This note is in Trash. It will be permanently deleted when you empty the trash.</span>
          <button onClick={onRestore}>Restore</button>
        </div>
      )}

      <div className="editor-body">
        <div className="editor-canvas">
          <textarea
            ref={titleRef}
            className="editor-title"
            value={title}
            disabled={isTrashView}
            placeholder="Title"
            rows={1}
            onChange={(e) => setTitle(e.target.value)}
            onKeyDown={handleTitleKey}
            onInput={(e) => autoResize(e.currentTarget)}
            spellCheck
          />
          <div className="editor-meta">
            <span>Created {formatRelativeTime(note.createdAt)}</span>
            <span className="dot" />
            <span>Updated {formatRelativeTime(note.updatedAt)}</span>
            {note.isPinned && (
              <>
                <span className="dot" />
                <span style={{ color: 'var(--accent)' }}>Pinned</span>
              </>
            )}
          </div>
          <div className="tags-row" style={{ position: 'relative' }}>
            {tags.map((t) => (
              <span key={t} className="tag-pill">
                #{t}
                {!isTrashView && (
                  <button className="remove" aria-label={`Remove tag ${t}`} onClick={() => removeTag(t)}>
                    ×
                  </button>
                )}
              </span>
            ))}
            {!isTrashView && (
              <input
                ref={tagInputRef}
                className="tag-input"
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={onTagKey}
                onBlur={() => addTag(tagInput)}
                placeholder={tags.length === 0 ? 'Add a tag…' : ''}
              />
            )}
          </div>
          <textarea
            ref={contentRef}
            className="editor-content"
            value={content}
            disabled={isTrashView}
            placeholder="Start writing…"
            onChange={(e) => setContent(e.target.value)}
            onKeyDown={handleContentKey}
            onInput={(e) => autoResize(e.currentTarget)}
            spellCheck
          />
        </div>
      </div>
    </div>
  );
}
