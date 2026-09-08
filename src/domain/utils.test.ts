import { describe, it, expect } from 'vitest';
import { previewText, formatRelativeTime, debounce } from './utils';

describe('utils', () => {
  it('previewText trims whitespace and limits length', () => {
    expect(previewText('   hello   world  ')).toBe('hello world');
    const long = 'a'.repeat(200);
    const trimmed = previewText(long, 50);
    expect(trimmed.length).toBe(50);
    expect(trimmed.endsWith('…')).toBe(true);
  });

  it('formatRelativeTime produces friendly strings', () => {
    const now = 1_700_000_000_000;
    expect(formatRelativeTime(now - 5_000, now)).toBe('just now');
    expect(formatRelativeTime(now - 5 * 60_000, now)).toBe('5m ago');
    expect(formatRelativeTime(now - 3 * 3_600_000, now)).toBe('3h ago');
    expect(formatRelativeTime(now - 26 * 3_600_000, now)).toBe('yesterday');
  });

  it('debounce fires once after the window', async () => {
    let n = 0;
    const fn = debounce(() => n++, 10);
    fn();
    fn();
    fn();
    await new Promise((r) => setTimeout(r, 25));
    expect(n).toBe(1);
  });

  it('debounce flush forces immediate call', () => {
    let n = 0;
    const fn = debounce(() => n++, 1000);
    fn();
    fn.flush();
    expect(n).toBe(1);
  });
});
