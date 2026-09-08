import { useEffect } from 'react';
import { app } from './state/appStore';
import { useMediaQuery } from './ui/useMediaQuery';
import { Sidebar } from './ui/Sidebar';
import { TopBar, CommandPalette } from './ui/CommandPalette';
import { NoteList } from './ui/NoteList';
import { NoteEditor } from './ui/NoteEditor';
import { BottomNav, Toast, EmptyTrashButton } from './ui/BottomNav';
import { Shortcuts } from './ui/Shortcuts';
import { db } from './data/db';

export function App() {
  const ready = app((s) => s.ready);
  const view = app((s) => s.view);
  const selectedId = app((s) => s.selectedId);
  const sidebarOpen = app((s) => s.sidebarOpen);
  const init = app((s) => s.init);
  const isMobile = useMediaQuery('(max-width: 720px)');

  useEffect(() => {
    void init();
  }, [init]);

  useEffect(() => {
    const onUnhandled = (event: PromiseRejectionEvent) => {
      console.error('Unhandled promise rejection', event.reason);
      app.getState().showToast('Something went wrong. Your data is safe.');
    };
    window.addEventListener('unhandledrejection', onUnhandled);
    return () => window.removeEventListener('unhandledrejection', onUnhandled);
  }, []);

  if (!ready) {
    return (
      <div className="app app--mobile" style={{ placeItems: 'center', display: 'grid' }}>
        <div style={{ color: 'var(--fg-muted)' }}>Loading…</div>
      </div>
    );
  }

  const isTrashView = view.kind === 'trash';
  const isArchiveView = view.kind === 'archive';

  const listPane =
    isMobile && selectedId ? null : <NoteList />;

  const editorPane = !selectedId ? (
    <div className="editor">
      <div className="editor-empty">
        <div>
          <h3 style={{ margin: 0, fontSize: 18, color: 'var(--fg)' }}>
            {isTrashView ? 'Trash is empty' : isArchiveView ? 'No archived notes' : 'Welcome to Inkwell'}
          </h3>
          <p style={{ color: 'var(--fg-muted)' }}>
            {isTrashView
              ? 'Deleted notes show up here.'
              : isArchiveView
              ? 'Archive notes from the editor menu to see them here.'
              : 'Press ⌘N or tap the New button to start writing.'}
          </p>
        </div>
      </div>
    </div>
  ) : (
    <NoteEditor
      id={selectedId}
      isTrashView={isTrashView}
      isArchiveView={isArchiveView}
      onDelete={() => void app.getState().softDelete(selectedId)}
      onArchive={() => void app.getState().archive(selectedId)}
      onUnarchive={() => void app.getState().unarchive(selectedId)}
      onRestore={() => void app.getState().restore(selectedId)}
      onPermanentDelete={() => {
        if (confirm('Delete this note forever? This cannot be undone.')) {
          void app.getState().permanentDelete(selectedId);
        }
      }}
    />
  );

  return (
    <div className={`app ${isMobile ? 'app--mobile' : 'app--sidebar'}`}>
      <Shortcuts />
      <Sidebar />
      {sidebarOpen && <div className="scrim" onClick={() => app.getState().closeSidebar()} />}
      <main className="main">
        <TopBar />
        <EmptyTrashButton />
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'minmax(280px, 360px) 1fr', overflow: 'hidden', minHeight: 0 }}>
          {listPane}
          {editorPane}
        </div>
        <BottomNav />
      </main>
      <CommandPalette />
      <Toast />
    </div>
  );
}
