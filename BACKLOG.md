# Arca Backlog

## In Progress

## Up Next

- [ ] ARC-002 · Scaffold WXT + React + TS + Tailwind, ESLint/Prettier, Vitest · Phase 1 · P0
- [ ] ARC-003 · `src/lib` chrome API wrappers (bookmarks, storage, tabs, favicon) + tests · Phase 1 · P0
- [ ] ARC-004 · Normalized bookmark store + live sync from bookmark events (§8.12) · Phase 1 · P0

## Backlog

### Phase 1 – Core

- [ ] ARC-005 · Sidebar folder tree: collapsible, item counts, resizable, ⌘\ toggle · Phase 1 · P0
- [ ] ARC-006 · Main area: folder cards + grid view (comfortable / compact) · Phase 1 · P0
- [ ] ARC-007 · List view with sortable columns + remembered grid/list toggle · Phase 1 · P1
- [ ] ARC-008 · Breadcrumbs for the current folder path · Phase 1 · P1
- [ ] ARC-009 · Sort: manual, title A–Z, date added, domain · Phase 1 · P1
- [ ] ARC-010 · Favicons via `_favicon` endpoint with lettered fallback tile · Phase 1 · P1
- [ ] ARC-011 · Global fuzzy search: index, ⌘K / `/`, ↑↓ Enter ⌘Enter ⌥Enter, folder filter · Phase 1 · P0
- [ ] ARC-012 · Add / edit / delete bookmarks & folders, inline rename, root-folder guard · Phase 1 · P0
- [ ] ARC-013 · New Tab override + New Tab mode (dashboard / minimal search / redirect) · Phase 1 · P0
- [ ] ARC-014 · Dashboard page entrypoint (same UI in a normal tab) · Phase 1 · P1
- [ ] ARC-015 · Toolbar popup: search top 8, bookmark this tab, open dashboard · Phase 1 · P0
- [ ] ARC-016 · Virtualize grid/list over 200 items · Phase 1 · P1
- [ ] ARC-017 · Ardia-like theme: tokens, light/dark, grain gradient, reduced motion · Phase 1 · P1
- [ ] ARC-018 · README: load unpacked in Ardia + Chrome; verify §16 Ardia risks · Phase 1 · P0
- [ ] ARC-019 · Release v0.1.0 · Phase 1 · P0

### Phase 2 – Management

- [ ] ARC-020 · Drag & drop reorder within a folder · Phase 2 · P0
- [ ] ARC-021 · Drag & drop into folder cards / tree nodes, descendant guard, 600 ms auto-expand · Phase 2 · P0
- [ ] ARC-022 · Multi-select: ⌘-click, ⇧-click, hover checkbox · Phase 2 · P1
- [ ] ARC-023 · Bulk actions: move, delete, open all (warn > 10) · Phase 2 · P1
- [ ] ARC-024 · Undo stack: 20 actions, 8 s toast, ⌘Z, subtree recreate on delete · Phase 2 · P0
- [ ] ARC-025 · Open tabs panel: drag tab to folder, "Bookmark", mark bookmarked · Phase 2 · P1
- [ ] ARC-026 · Home view: Recently added (12) + Most visited, each hideable · Phase 2 · P1
- [ ] ARC-027 · Settings page (§8.13), stored in `chrome.storage.local` · Phase 2 · P1
- [ ] ARC-028 · Keyboard shortcuts, `?` sheet, extension command (⌥⇧B) · Phase 2 · P1
- [ ] ARC-029 · Background worker: "Add to Arca…" context menu · Phase 2 · P2
- [ ] ARC-030 · Release v0.2.0 · Phase 2 · P0

### Phase 3 – Power tools

- [ ] ARC-031 · Tags & notes: storage, editing, URL fallback re-link · Phase 3 · P0
- [ ] ARC-032 · Undo remaps tags/notes to recreated IDs; metadata cleanup after undo window · Phase 3 · P0
- [ ] ARC-033 · Tag manager: rename, merge, delete, colors · Phase 3 · P1
- [ ] ARC-034 · Bulk add/remove tag · Phase 3 · P2
- [ ] ARC-035 · Search filter chips: tag, has notes, duplicates, dead links · Phase 3 · P2
- [ ] ARC-036 · URL normalization + duplicates finder (keep / delete / merge) · Phase 3 · P1
- [ ] ARC-037 · Dead-link finder: optional permission, worker, cache, cancel · Phase 3 · P1
- [ ] ARC-038 · Export: Netscape HTML + Arca JSON (with tags/notes) · Phase 3 · P1
- [ ] ARC-039 · Import: Netscape HTML / Arca JSON into folder, preview, dup warnings · Phase 3 · P1
- [ ] ARC-040 · Release v1.0.0 (v0.3.0 if more work is planned before 1.0) · Phase 3 · P0

### Phase 4 – Later

- [ ] ARC-041 · Page preview thumbnails · Phase 4 · P3
- [ ] ARC-042 · Saved searches · Phase 4 · P3
- [ ] ARC-043 · Custom folder icons · Phase 4 · P3

### Tooling

- [ ] ARC-044 · Commit hooks: lefthook + commitlint (needs approval for deps) · P2

## Ideas (unscoped)

- Build flag that omits the New Tab override for users who want the browser's own New Tab.

## Done

- [x] ARC-001 · Repo + git setup, guides, CLAUDE.md, backlog · `main` (initial commit) · 2026-11-13

## Known Issues / Bugs

## Tech Debt / Risks to Verify

- Ardia: confirm unpacked loading via `chrome://extensions` and that the New Tab override applies (PRD §16.1–16.2). Track under ARC-018.
- TypeScript 7.0 (native port) is now latest stable; confirm WXT and typescript-eslint support it during ARC-002, else pin 5.x and note why.
- `@types/chrome` vs WXT's built-in `browser` types: pick one during ARC-003.
