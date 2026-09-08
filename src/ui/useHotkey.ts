import { useEffect, useRef } from 'react';

type KeyHandler = (e: KeyboardEvent) => void;

interface Options {
  allowInInputs?: boolean;
}

export function useHotkey(combo: string, handler: KeyHandler, options: Options = {}) {
  const handlerRef = useRef(handler);
  handlerRef.current = handler;
  const optsRef = useRef(options);
  optsRef.current = options;

  useEffect(() => {
    const parts = combo.toLowerCase().split('+').map((p) => p.trim());
    const want = {
      meta: parts.includes('cmd') || parts.includes('meta'),
      ctrl: parts.includes('ctrl') || parts.includes('control'),
      shift: parts.includes('shift'),
      alt: parts.includes('alt') || parts.includes('option'),
      key: parts[parts.length - 1]
    };
    const onKey = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      if (k !== want.key) return;
      const isMac = navigator.platform.toLowerCase().includes('mac');
      const meta = isMac ? e.metaKey : e.ctrlKey;
      if (want.meta !== meta) return;
      if (want.shift !== e.shiftKey) return;
      if (want.alt !== e.altKey) return;
      const target = e.target as HTMLElement | null;
      const inField = !!target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable);
      if (inField && !optsRef.current.allowInInputs) return;
      e.preventDefault();
      handlerRef.current(e);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [combo]);
}

export function useHotkeys(map: Record<string, KeyHandler>, options: Options = {}) {
  const mapRef = useRef(map);
  mapRef.current = map;
  const optsRef = useRef(options);
  optsRef.current = options;

  useEffect(() => {
    const isMac = navigator.platform.toLowerCase().includes('mac');
    const onKey = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      const meta = isMac ? e.metaKey : e.ctrlKey;
      const shift = e.shiftKey;
      const alt = e.altKey;
      const target = e.target as HTMLElement | null;
      const inField = !!target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable);
      if (inField && !optsRef.current.allowInInputs) return;
      for (const [combo, handler] of Object.entries(mapRef.current)) {
        const parts = combo.toLowerCase().split('+').map((p) => p.trim());
        const want = {
          meta: parts.includes('cmd') || parts.includes('meta'),
          shift: parts.includes('shift'),
          alt: parts.includes('alt') || parts.includes('option'),
          key: parts[parts.length - 1]
        };
        if (k !== want.key) continue;
        if (want.meta !== meta) continue;
        if (want.shift !== shift) continue;
        if (want.alt !== alt) continue;
        e.preventDefault();
        handler(e);
        return;
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
}
