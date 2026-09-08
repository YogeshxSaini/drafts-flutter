import { useEffect, useRef, useState } from 'react';

export function useOnClickOutside<T extends HTMLElement>(handler: () => void): React.RefObject<T> {
  const ref = useRef<T>(null);
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (!ref.current) return;
      if (ref.current.contains(e.target as Node)) return;
      handler();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') handler();
    };
    document.addEventListener('mousedown', onClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [handler]);
  return ref;
}
