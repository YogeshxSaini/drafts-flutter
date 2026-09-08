import { create } from './createStore';
import type { Note, NoteFilter, SortKey } from '../domain/types';
import { wrappedNoteRepository } from '../data/wrappedNoteRepository';
import { noteRepository } from '../data/noteRepository';
import { noteQuery } from '../data/noteQuery';
import { debounce } from '../domain/utils';

export type View =
  | { kind: 'inbox' }
  | { kind: 'pinned' }
  | { kind: 'archive' }
  | { kind: 'trash' }
  | { kind: 'tag'; name: string }
  | { kind: 'search' };

export interface AppState {
  ready: boolean;
  view: View;
  notes: Note[];
  tags: { name: string; count: number }[];
  counts: { inbox: number; archived: number; trash: number; pinned: number; tags: number };
  selectedId: string | null;
  query: string;
  sort: SortKey;
  sidebarOpen: boolean;
  commandOpen: boolean;
  toast: { id: number; message: string; action?: { label: string; run: () => void } } | null;

  init: () => Promise<void>;
  refresh: () => Promise<void>;
  setView: (view: View) => void;
  setQuery: (q: string) => void;
  setSort: (s: SortKey) => void;
  select: (id: string | null) => void;
  toggleSidebar: () => void;
  closeSidebar: () => void;
  openCommand: () => void;
  closeCommand: () => void;
  showToast: (message: string, action?: { label: string; run: () => void }) => void;
  hideToast: () => void;
  createNote: () => Promise<string>;
  pin: (id: string, pinned: boolean) => Promise<void>;
  archive: (id: string) => Promise<void>;
  unarchive: (id: string) => Promise<void>;
  softDelete: (id: string) => Promise<void>;
  restore: (id: string) => Promise<void>;
  permanentDelete: (id: string) => Promise<void>;
  emptyTrash: () => Promise<void>;
  renameTag: (from: string, to: string) => Promise<void>;
  deleteTag: (name: string) => Promise<void>;
}

const initial: Omit<AppState, 'init' | 'refresh' | 'setView' | 'setQuery' | 'setSort' | 'select' | 'toggleSidebar' | 'closeSidebar' | 'openCommand' | 'closeCommand' | 'showToast' | 'hideToast' | 'createNote' | 'pin' | 'archive' | 'unarchive' | 'softDelete' | 'restore' | 'permanentDelete' | 'emptyTrash' | 'renameTag' | 'deleteTag'> = {
  ready: false,
  view: { kind: 'inbox' },
  notes: [],
  tags: [],
  counts: { inbox: 0, archived: 0, trash: 0, pinned: 0, tags: 0 },
  selectedId: null,
  query: '',
  sort: 'updated',
  sidebarOpen: false,
  commandOpen: false,
  toast: null
};

let toastCounter = 0;

export const app = create<AppState>((set, get) => {
  const refresh = async () => {
    const s = get();
    const filter: NoteFilter = {
      query: s.query,
      sort: s.sort,
      tags: s.view.kind === 'tag' ? [s.view.name] : [],
      includeArchived: s.view.kind === 'archive',
      includeDeleted: s.view.kind === 'trash'
    };
    const [notes, tags, counts] = await Promise.all([
      noteQuery.list(filter),
      noteRepository.listTags(),
      noteQuery.countByView()
    ]);
    let nextSelected = s.selectedId;
    if (!notes.some((n) => n.id === nextSelected)) {
      nextSelected = notes[0]?.id ?? null;
    }
    set({ notes, tags, counts, selectedId: nextSelected });
  };

  const debouncedRefresh = debounce(refresh, 80);

  return {
    ...initial,
    async init() {
      await refresh();
      set({ ready: true });
    },
    async refresh() {
      await refresh();
    },
    setView(view: View) {
      set({ view, query: view.kind === 'search' ? get().query : '', sidebarOpen: false });
      void refresh();
    },
    setQuery(q: string) {
      set({ query: q, view: q.trim() ? { kind: 'search' } : get().view });
      debouncedRefresh();
    },
    setSort(sort: SortKey) {
      set({ sort });
      void refresh();
    },
    select(id: string | null) {
      set({ selectedId: id, sidebarOpen: false });
    },
    toggleSidebar() {
      set({ sidebarOpen: !get().sidebarOpen });
    },
    closeSidebar() {
      set({ sidebarOpen: false });
    },
    openCommand() {
      set({ commandOpen: true });
    },
    closeCommand() {
      set({ commandOpen: false });
    },
    showToast(message: string, action?: { label: string; run: () => void }) {
      const id = ++toastCounter;
      set({ toast: { id, message, action } });
    },
    hideToast() {
      set({ toast: null });
    },
    async createNote() {
      const note = await wrappedNoteRepository.create({ title: '', content: '', tags: [] });
      set({ view: { kind: 'inbox' }, selectedId: note.id });
      await refresh();
      return note.id;
    },
    async pin(id: string, pinned: boolean) {
      await wrappedNoteRepository.pin(id, pinned);
      await refresh();
    },
    async archive(id: string) {
      await wrappedNoteRepository.archive(id, true);
      set({ selectedId: null });
      await refresh();
      get().showToast('Note archived', { label: 'Undo', run: () => void get().unarchive(id) });
    },
    async unarchive(id: string) {
      await wrappedNoteRepository.archive(id, false);
      await refresh();
    },
    async softDelete(id: string) {
      await wrappedNoteRepository.softDelete(id);
      set({ selectedId: null });
      await refresh();
      get().showToast('Moved to Trash', { label: 'Undo', run: () => void get().restore(id) });
    },
    async restore(id: string) {
      await wrappedNoteRepository.restore(id);
      set({ selectedId: id });
      await refresh();
    },
    async permanentDelete(id: string) {
      await wrappedNoteRepository.permanentDelete(id);
      set({ selectedId: null });
      await refresh();
    },
    async emptyTrash() {
      await wrappedNoteRepository.emptyTrash();
      set({ selectedId: null });
      await refresh();
      get().showToast('Emptied trash');
    },
    async renameTag(from: string, to: string) {
      const n = await wrappedNoteRepository.renameTag(from, to);
      await refresh();
      get().showToast(`Renamed tag (${n} note${n === 1 ? '' : 's'})`);
    },
    async deleteTag(name: string) {
      const view = get().view;
      if (view.kind === 'tag' && view.name === name) {
        set({ view: { kind: 'inbox' } });
      }
      const n = await wrappedNoteRepository.deleteTag(name);
      await refresh();
      get().showToast(`Removed tag from ${n} note${n === 1 ? '' : 's'}`);
    }
  };
});
