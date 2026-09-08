import { useEffect, useState, useCallback } from 'react';

type Theme = 'light' | 'dark' | 'system';

const STORAGE_KEY = 'inkwell:theme';

function getSystem(): 'light' | 'dark' {
  if (typeof window === 'undefined' || !window.matchMedia) return 'light';
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function applyTheme(theme: Theme) {
  if (typeof document === 'undefined') return;
  const resolved = theme === 'system' ? getSystem() : theme;
  document.documentElement.setAttribute('data-theme', resolved);
}

export function useTheme(): { theme: Theme; resolved: 'light' | 'dark'; setTheme: (t: Theme) => void; toggle: () => void } {
  const [theme, setThemeState] = useState<Theme>(() => {
    if (typeof window === 'undefined') return 'system';
    const stored = window.localStorage.getItem(STORAGE_KEY) as Theme | null;
    return stored ?? 'system';
  });

  const [resolved, setResolved] = useState<'light' | 'dark'>(() => {
    if (theme === 'system') return getSystem();
    return theme;
  });

  useEffect(() => {
    applyTheme(theme);
    setResolved(theme === 'system' ? getSystem() : theme);
    if (theme === 'system') {
      const mq = window.matchMedia('(prefers-color-scheme: dark)');
      const onChange = () => {
        applyTheme('system');
        setResolved(getSystem());
      };
      mq.addEventListener('change', onChange);
      return () => mq.removeEventListener('change', onChange);
    }
  }, [theme]);

  const setTheme = useCallback((t: Theme) => {
    setThemeState(t);
    try {
      window.localStorage.setItem(STORAGE_KEY, t);
    } catch {
      /* ignore */
    }
  }, []);

  const toggle = useCallback(() => {
    setTheme(resolved === 'dark' ? 'light' : 'dark');
  }, [resolved, setTheme]);

  return { theme, resolved, setTheme, toggle };
}
