# Inkwell — Project Progress

A fast, local-first, cross-platform note-taking application inspired by the
"capture now, organize later" philosophy of Drafts, with an original
implementation, visual design, and branding.

> **Brand:** Inkwell. **Tagline:** "Capture first. Organize later."

---

## 1. Architecture Decision

### Platform strategy

The build environment had **no Java, no Flutter, no Kotlin, no Xcode**, only
**Node.js v20**. The most practical cross-platform path that still delivers
a real, polished, native-feeling app on macOS and Android is:

**React 18 + TypeScript + Vite + Dexie (IndexedDB)**

- **Vite** gives a single codebase that runs identically on macOS (browser
  desktop app, PWA install, or wrapped via Tauri/Capacitor) and on Android
  (Chrome PWA, or wrapped as a Capacitor app for APK distribution).
- **Dexie / IndexedDB** is the local persistence layer. It is fast,
  transactional, supports indexes, and works fully offline in every modern
  browser — including the Android WebView used by Chrome and by the TWA /
  WebAPK install path.
- **vite-plugin-pwa** ships a service worker and Web App Manifest so the
  app installs as a real application (`.app` on macOS, home-screen icon on
  Android), with offline-first behavior, splash screen, and theme colors.
- The architecture is layered (`UI → App Store → Repository → Database`),
  so a future sync engine can be added below the repository without
  touching UI code.

### Why not the alternatives

| Option | Verdict | Reason |
| --- | --- | --- |
| Flutter | unavailable | not installed in build env |
| Kotlin Multiplatform | unavailable | requires Java + Android SDK |
| React Native + Electron | heavyweight | large bundle, dual runtime |
| Tauri + Rust | extra toolchain | not present |
| **React + Vite + Dexie** | ✅ chosen | fully present, fast, simple, offline, installable |

The same code can later be wrapped with **Capacitor** to produce a real
Android APK and a macOS native shell, without rewriting the app.

### Folder layout

```text
src/
├── data/         # Dexie DB, repository, query layer
├── domain/       # Pure types and utilities (no I/O)
├── state/        # App store (subscribe-based, with actions)
├── ui/           # React components (Sidebar, Editor, List, etc.)
├── styles/       # Design tokens + app CSS
├── test/         # Test setup
├── App.tsx
└── main.tsx
```

---

## 2. Storage

- **Engine:** Dexie 4 over IndexedDB
- **DB name:** `inkwell`
- **Tables:**
  - `notes` — indexed by `id, updatedAt, createdAt, isPinned, isArchived, isDeleted, *tags` (multi-entry on tags)
  - `tags` — indexed by `name, count, updatedAt` (denormalized tag counts)
  - `meta` — key/value for future preferences
- **Writes:** atomic via `db.transaction` for tag-count sync
- **Resilience:** `db.close()` then `db.open()` simulated in tests; data
  survives a real browser restart because IndexedDB is persistent on disk.
- **Migrations:** Dexie `version(1).stores(...)` pattern; future versions
  add new `version(N).stores(...).upgrade(tx => ...)` calls.

---

## 3. Status

### Completed
- [x] Project architecture decision
- [x] Vite + React + TypeScript scaffold
- [x] Local persistence (Dexie / IndexedDB)
- [x] Note data model (extensible for future attachments/links/etc.)
- [x] Note creation, edit, auto-save
- [x] Auto-save with debounce (350 ms)
- [x] Note list with preview, tags, pinned indicator
- [x] Search (title, content, tags, multi-token, case-insensitive)
- [x] Sort: recently modified, recently created, alphabetical, pinned first
- [x] Tags: add, remove, rename, delete, count, filter
- [x] Pin / unpin
- [x] Archive / unarchive
- [x] Trash (soft delete), restore, permanent delete, empty trash
- [x] Undo toasts for archive / delete
- [x] Light / dark / system theme
- [x] macOS-style sidebar with collapsible behavior
- [x] Android-style bottom navigation + drawer
- [x] Keyboard shortcuts (Cmd+N, Cmd+F, Cmd+K, Cmd+1..5, Cmd+P, Cmd+Enter, Cmd+., Cmd+\, Esc)
- [x] Command palette (Cmd+K)
- [x] Markdown toolbar (Bold, Italic, Link, Headings, Lists, Checklist, Code, Quote)
- [x] Original visual identity (calm, content-first, brand mark "i", warm terracotta accent)
- [x] Empty states for every view
- [x] Error handling / unhandled-rejection toast
- [x] PWA service worker (offline install)
- [x] 29 passing tests (data, query, persistence, utils, UI smoke)

### In progress
- [ ] (none — vertical slice complete)

### Remaining
- [ ] Cloud sync engine (architecture is ready: `repository → local DB` already abstracted)
- [ ] Attachment support
- [ ] Reminders / actions
- [ ] Folders / workspaces
- [ ] Version history
- [ ] Native packaging (Capacitor wrapper for Android APK + macOS .app)

---

## 4. How to run

```bash
npm install
npm run dev        # dev server, http://localhost:5173
npm run build      # production bundle to dist/
npm run preview    # serve dist/ on http://localhost:4173
npm test           # run vitest test suite
```

Open the app in any modern browser. The same code runs on macOS and Android
as a PWA; install via "Add to Home Screen" on Android, or "Install Inkwell"
in the Chrome/Edge address bar on macOS.

---

## 5. Keyboard shortcuts

| Shortcut | Action |
| --- | --- |
| ⌘N | New note |
| ⌘F | Focus search |
| ⌘K | Open command palette |
| ⌘1 | Inbox |
| ⌘2 | Pinned |
| ⌘3 | Archive |
| ⌘4 | Trash |
| ⌘5 | Search focus |
| ⌘P | Pin / unpin current note |
| ⌘. | Toggle theme |
| ⌘\\ | Toggle sidebar |
| ⌘Enter | Archive / unarchive current note |
| ⌘⇧⌫ | Move current note to Trash |
| Esc | Close palette / sidebar / clear search |
| ⌘B / ⌘I / ⌘K | Bold / italic / link in editor |
| ⌘⇧7 / ⌘⇧8 / ⌘⇧9 | H1 / H2 / H3 prefix |
| ⌘⇧L | Bulleted list |
| ⌘⇧Enter | Checklist |
| ⌘⇧. | Inline code |
| ⌘⇧; | Quote |

(`⌘` is `Ctrl` on Windows/Linux.)

---

## 6. Known limitations

- No cloud sync (intentional for v1 — local-first, sync-ready architecture)
- No attachment support yet (data model reserves space for it)
- Tag actions in the sidebar use `prompt()`/`confirm()` for v1 simplicity;
  a richer popover is a small follow-up

---

## 7. Next steps (recommended)

1. Wrap the production build with **Capacitor** to ship a real
   `Inkwell.app` (macOS) and `Inkwell.apk` (Android) without rewriting
   any code.
2. Add a sync engine below the repository. Repository signatures
   (`create / update / softDelete / ...`) are already stable, so a
   remote mirror + outbox queue can be added with no UI changes.
3. Polish the sidebar tag popover (replace `prompt()` with an in-app
   menu) for a more native feel.
4. Add a "favorites" indicator on the list rows for pinned notes
   (currently an icon; could be a star in the gutter).

---

## 8. Files

### Configuration
- `package.json`
- `vite.config.ts`
- `tsconfig.json`, `tsconfig.app.json`, `tsconfig.node.json`
- `index.html`
- `public/favicon.svg`

### Source
- `src/main.tsx`
- `src/App.tsx`
- `src/domain/types.ts`
- `src/domain/utils.ts`
- `src/data/db.ts`
- `src/data/noteRepository.ts`
- `src/data/noteQuery.ts`
- `src/state/createStore.ts`
- `src/state/appStore.ts`
- `src/ui/icons.tsx`
- `src/ui/useTheme.ts`
- `src/ui/useHotkey.ts`
- `src/ui/useMediaQuery.ts`
- `src/ui/useOnClickOutside.ts`
- `src/ui/Sidebar.tsx`
- `src/ui/TopBar.tsx` (in `CommandPalette.tsx`)
- `src/ui/NoteList.tsx`
- `src/ui/NoteEditor.tsx`
- `src/ui/CommandPalette.tsx`
- `src/ui/BottomNav.tsx`
- `src/ui/Shortcuts.tsx`
- `src/styles/tokens.css`
- `src/styles/app.css`

### Tests
- `src/data/noteRepository.test.ts` (9 tests)
- `src/data/noteQuery.test.ts` (12 tests)
- `src/data/persistence.test.ts` (3 tests)
- `src/domain/utils.test.ts` (4 tests)
- `src/App.test.tsx` (1 smoke test)

---

## 9. Session recovery

The next Claude Code session should:

1. `cd /root/drafts-android`
2. `npm install` (dependencies are already in `package.json`)
3. `npm run dev` to launch the dev server
4. `npm test` to verify the 29 tests still pass
5. Read this file for full context, then continue from "Next steps" above.

The data layer, state, and UI are decoupled; any one of them can be
modified without re-architecting the others.
