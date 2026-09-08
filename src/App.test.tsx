import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { App } from './App';
import { db } from './data/db';

async function clearAll() {
  await db.notes.clear();
  await db.tags.clear();
  await db.meta.clear();
}

describe('App smoke test', () => {
  beforeEach(async () => {
    await clearAll();
    // jsdom does not implement matchMedia; provide a minimal shim
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: (query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addEventListener: () => {},
        removeEventListener: () => {},
        addListener: () => {},
        removeListener: () => {},
        dispatchEvent: () => false
      })
    });
  });

  it('renders the app and creates a note via the new button', async () => {
    render(<App />);
    await waitFor(() => {
      expect(screen.getAllByText('Inbox').length).toBeGreaterThan(0);
    });
    const newButtons = screen.getAllByLabelText('New note');
    fireEvent.click(newButtons[0]);
    await waitFor(async () => {
      const all = await db.notes.toArray();
      expect(all.length).toBeGreaterThan(0);
    });
  });
});
