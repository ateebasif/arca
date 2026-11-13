# Arca Backlog

## In Progress

- [ ] ARC-018 · README: load unpacked in Ardia + Chrome; verify §16 Ardia risks · `docs/readme-load-unpacked` · Phase 1 · Ardia: loads unpacked, dashboard works with ~4k bookmarks; ⌘T opens Ardia's command bar (no New Tab override); popup still to check

## Up Next

## Backlog

### Phase 1 – Core

- [ ] ARC-019 · Release v0.1.0 · Phase 1 · P0

### Phase 2 – Management

- [ ] ARC-022 · Multi-select: ⌘-click, ⇧-click, hover checkbox · Phase 2 · P1
- [ ] ARC-023 · Bulk actions: move, delete, open all (warn > 10) · Phase 2 · P1
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

- [ ] ARC-042 · Saved searches · Phase 4 · P3
- [ ] ARC-043 · Custom folder icons · Phase 4 · P3

### Tooling

- [ ] ARC-044 · Commit hooks: lefthook + commitlint (needs approval for deps) · P2

## Ideas (unscoped)

- Sync UI prefs (view, density, sort) live across open Arca tabs via `onStorageChange`.
- Build flag that omits the New Tab override for users who want the browser's own New Tab.

## Done

- [x] ARC-021 · Drag & drop into folder cards / tree nodes, descendant guard, 600 ms auto-expand · `feature/drag-drop` · 2026-11-13
- [x] ARC-020 · Drag & drop reorder within a folder · `feature/drag-drop` · 2026-11-13
- [x] ARC-024 · Undo stack: 20 actions, 8 s toast, ⌘Z, subtree recreate on delete · `feature/undo` · 2026-11-13
- [x] ARC-054 · "Open links in" setting: same tab / new tab / background / mini window · `feature/open-links-setting` · 2026-11-13
- [x] ARC-053 · Back/forward folder history: buttons, [ ], ⌥↑, mouse side buttons, ? shortcuts sheet · `feature/folder-history-nav` · 2026-11-13
- [x] ARC-052 · Search folds duplicate copies ("in N folders"), compact paths, collapsing breadcrumbs · `fix/search-duplicates-paths` · 2026-11-13
- [x] ARC-051 · Modern dark redesign: favicon-coloured tile covers, deeper dark palette, entrance/hover animations · `style/modern-dark-tiles` · 2026-11-13
- [x] ARC-050 · "All links" view: every bookmark under a folder, flat, labelled with its folder · `feature/all-links-view` · 2026-11-13
- [x] ARC-049 · Arca icon (strongbox with arched lid), tab favicons, in-app logo · `feature/arca-icon` · 2026-11-13
- [x] ARC-041 · Link previews (title, description, image) on hover, opt-in, cached locally (pulled forward from Phase 4; metadata cards, not screenshots) · `feature/link-previews` · 2026-11-13
- [x] ARC-048 · Theme setting: system / light / dark (split out of ARC-027) · `feature/theme-setting` · 2026-11-13
- [x] ARC-047 · Security hardening: CSP, block external messaging, URL scheme allowlist, storage validation, security checks · `fix/security-hardening` · 2026-11-13
- [x] ARC-046 · E2E no-network audit (PRD §15): fail on any request leaving the extension · `test/e2e-network-audit` · 2026-11-13
- [x] ARC-017 · Ardia-like theme: tokens, light/dark, grain gradient, reduced motion · `style/theme-contrast-polish` · 2026-11-13
- [x] ARC-016 · Virtualize grid/list over 200 items · `perf/virtualize-grid-list` · 2026-11-13
- [x] ARC-015 · Toolbar popup: search top 8, bookmark this tab, open dashboard · `feature/popup-quick-search` · 2026-11-13
- [x] ARC-014 · Dashboard page entrypoint (same UI in a normal tab) · `feature/popup-quick-search` · 2026-11-13
- [x] ARC-013 · New Tab override + New Tab mode (dashboard / minimal search / redirect) · `feature/newtab-modes` · 2026-11-13
- [x] ARC-012 · Add / edit / delete bookmarks & folders, inline rename, root-folder guard · `feature/bookmark-editing` · 2026-11-13
- [x] ARC-011 · Global fuzzy search: index, ⌘K / `/`, ↑↓ Enter ⌘Enter ⌥Enter, folder filter · `feature/global-search` · 2026-11-13
- [x] ARC-009 · Sort: manual, title A–Z, date added, domain · `feature/list-view-sort` · 2026-11-13
- [x] ARC-007 · List view with sortable columns + remembered grid/list toggle · `feature/list-view-sort` · 2026-11-13
- [x] ARC-010 · Favicons via `_favicon` endpoint with lettered fallback tile · `feature/bookmark-grid` · 2026-11-13
- [x] ARC-008 · Breadcrumbs for the current folder path · `feature/bookmark-grid` · 2026-11-13
- [x] ARC-006 · Main area: folder cards + grid view (comfortable / compact) · `feature/bookmark-grid` · 2026-11-13
- [x] ARC-005 · Sidebar folder tree: collapsible, item counts, resizable, ⌘\ toggle · `feature/folder-tree-sidebar` · 2026-11-13
- [x] ARC-004 · Normalized bookmark store + live sync from bookmark events (§8.12) · `feature/bookmark-store-sync` · 2026-11-13
- [x] ARC-045 · E2E smoke harness: real Chrome via DevTools pipe + `Extensions.loadUnpacked` · `test/e2e-harness` · 2026-11-13
- [x] ARC-003 · `src/lib` chrome API wrappers (bookmarks, storage, tabs, favicon) + tests · `feature/bookmarks-api-wrapper` + `feature/chrome-api-wrappers` · 2026-11-13
- [x] ARC-002 · Scaffold WXT + React + TS + Tailwind, ESLint/Prettier, Vitest · `chore/scaffold-wxt-react` · 2026-11-13
- [x] ARC-001 · Repo + git setup, guides, CLAUDE.md, backlog · `main` (initial commit) · 2026-11-13

## Known Issues / Bugs

## Tech Debt / Risks to Verify

- Ardia (0.2.46, Chromium 157) disables DevTools automation, so it can't run `bun run e2e`; Ardia checks are manual. Verified 2026-11-13: unpacked loading works; ⌘T opens Ardia's command bar instead of the New Tab override (PRD §16.2), so the sidebar/popup are the entry points there.
- TypeScript pinned to 5.9.x because typescript-eslint 8 requires `<6.1`. Revisit TS 7 when typescript-eslint supports it.
- JS is 320 KB raw / 99 KB gzip at end of Phase 1 (budget 400 KB raw); React is ~220 KB of that. Lazy-load Phase 3 views (§10).
- New Tab, dashboard and popup each import `global.css`; fine for now, revisit if popup CSS grows.
- `getAncestorIds` and the move guard call `bookmarks.get` once per level. UI code should use the store's `isWithin`/`getPath` instead.
- Store copies the id→node Map on every event (~5k entries, < 1 ms). Fine for v1; revisit if profiles show it during bulk ops (ARC-023).
- `storageGet` treats a stored `null` as missing (the fake browser reports missing keys as `null`). Don't use `null` as a real stored value.
- E2E harness needs a local Chrome with `Extensions.loadUnpacked` (Chrome 126+). Chrome for Testing 121 in `~/.cache/puppeteer` crashes on this macOS; branded Chrome 154 works. Not wired into CI.
- Favicon placeholder detection fingerprints Chrome's generic globe per size. If Ardia or a Chrome update changes that image, detection silently stops and globes show again (cosmetic only).
- ⌘N / ⇧⌘N (PRD §8.14) are reserved by Chrome (new window / incognito) and can't be captured by a page. Pick alternatives in ARC-028 (e.g. `N` / `⇧N` when not typing).
- Sidebar tree and search results are not virtualized (tree shows only expanded folders; search caps at 50). Revisit if someone has thousands of folders.
- `bun audit`: minimatch (moderate) and deepmerge (low) in dev-only tooling (eslint, typescript-eslint, web-ext). Not shipped; no compatible fix yet. Re-check on tool updates.
- e2e can't prove the "other extension messaging" block on its own: Arca has no listeners, so Chrome gives the same "receiving end does not exist" error either way. The manifest check in `bun run security` covers the policy.
- Drag & drop: dragging folders _from_ the sidebar tree isn't supported yet (drag their cards instead). Reordering is disabled when a sort other than Manual is active, since the shown order isn't the browser order.
- Links are no longer natively draggable (to other apps / the tab strip) because the browser's link drag cancels dnd-kit's pointer drag.
