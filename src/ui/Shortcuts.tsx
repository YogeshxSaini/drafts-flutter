import { useEffect } from 'react';
import { app } from '../state/appStore';
import { useHotkeys } from './useHotkey';
import { useMediaQuery } from './useMediaQuery';

export function Shortcuts() {
  const isMobile = useMediaQuery('(max-width: 720px)');
  useHotkeys({
    'cmd+n': () => void app.getState().createNote(),
    'cmd+1': () => app.getState().setView({ kind: 'inbox' }),
    'cmd+2': () => app.getState().setView({ kind: 'pinned' }),
    'cmd+3': () => app.getState().setView({ kind: 'archive' }),
    'cmd+4': () => app.getState().setView({ kind: 'trash' }),
    'cmd+5': () => {
      app.getState().setView({ kind: 'search' });
      setTimeout(() => {
        const input = document.getElementById('search-input') as HTMLInputElement | null;
        input?.focus();
      }, 0);
    },
    'cmd+k': () => app.getState().openCommand(),
    '\\': () => app.getState().toggleSidebar(),
    'cmd+\\': () => app.getState().toggleSidebar(),
    'cmd+shift+backspace': () => {
      const id = app.getState().selectedId;
      if (id) void app.getState().softDelete(id);
    },
    'cmd+p': () => {
      const id = app.getState().selectedId;
      if (!id) return;
      const note = app.getState().notes.find((n) => n.id === id);
      if (note) void app.getState().pin(id, !note.isPinned);
    },
    'cmd+enter': () => {
      const view = app.getState().view;
      const id = app.getState().selectedId;
      if (!id) return;
      if (view.kind === 'archive') void app.getState().unarchive(id);
      else void app.getState().archive(id);
    },
    'cmd+.': () => {
      const html = document.documentElement;
      const next = html.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
      html.setAttribute('data-theme', next);
      try {
        window.localStorage.setItem('inkwell:theme', next);
      } catch {
        /* ignore */
      }
    },
    'escape': () => {
      if (app.getState().commandOpen) app.getState().closeCommand();
      else if (app.getState().sidebarOpen) app.getState().closeSidebar();
      else {
        const view = app.getState().view;
        if (view.kind === 'search' || view.kind === 'tag') app.getState().setView({ kind: 'inbox' });
      }
    }
  });

  useEffect(() => {
    // prevent default browser back navigation on Android back button if it bubbles
    const onPop = (e: PopStateEvent) => {
      const view = app.getState().view;
      if (view.kind !== 'inbox') {
        e.preventDefault();
        app.getState().setView({ kind: 'inbox' });
        window.history.pushState(null, '', window.location.href);
      }
    };
    if (isMobile) {
      window.history.pushState(null, '', window.location.href);
      window.addEventListener('popstate', onPop);
      return () => window.removeEventListener('popstate', onPop);
    }
  }, [isMobile]);

  return null;
}
