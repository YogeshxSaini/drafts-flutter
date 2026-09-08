# Inkwell

A fast, local-first, cross-platform note-taking application inspired by
"capture first, organize later." Original implementation, branding, and
visual design — built for **macOS** and **Android**.

- ⚡️ Opens instantly, no account required
- 🧠 Capture first; organize later with tags, archive, and pin
- 🔍 Fast local search across title, body, and tags
- ⌨️ Keyboard-first on desktop, touch-first on mobile
- 🌗 Light and dark themes, follows your system
- 📦 Offline-first; PWA installable on macOS and Android

## Quick start

```bash
npm install
npm run dev      # http://localhost:5173
npm test         # 29 tests
npm run build    # production bundle in dist/
npm run preview  # serve dist/ on http://localhost:4173
```

## What's in here

- `src/data/` — Dexie database, repository, query
- `src/domain/` — pure types and utilities
- `src/state/` — app store with subscribe-based actions
- `src/ui/` — Sidebar, List, Editor, Command Palette, Shortcuts
- `src/styles/` — design tokens, app CSS
- `PROJECT_PROGRESS.md` — full project status, architecture, and roadmap

## Next steps for new sessions

1. Read `PROJECT_PROGRESS.md`.
2. Run `npm test` to confirm the 29 baseline tests pass.
3. Continue from the "Next steps" section.
