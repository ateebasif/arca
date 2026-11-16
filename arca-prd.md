# PRD: Arca — Bookmark Dashboard Extension for Ardia

> _Arca_ (Latin): a chest or strongbox where valuables were kept. Also a nod to Arc.

## 1. Overview

Arca is a Manifest V3 browser extension that turns the browser's bookmarks into a fast,
visual, fully editable dashboard, inspired by Opera GX's bookmarks / speed dial. It reads
and writes the browser's real bookmarks through the `chrome.bookmarks` API, so every change
is live in the browser itself. Primary target: Ardia (Chromium-based Mac browser). It must
also work in any Chromium browser (Chrome, Dia, Brave, Edge).

## 2. Goals

- Browse thousands of bookmarks visually, with instant search.
- Manage bookmarks without friction: drag & drop, inline edit, bulk actions, undo.
- Feel native to Ardia: soft, rounded, subtle gradient, follows system light/dark.
- Fast and light: New Tab paints in under 100 ms, small bundle, zero network calls except
  the opt-in dead-link checker.
- Private: no analytics, no accounts, no remote code, all data local.

## 3. Non-goals (v1)

- Page preview thumbnails (Phase 4). Lightweight opt-in link previews (title, description,
  image; cached) were pulled forward at the user's request; see SECURITY.md.
- Cross-device sync beyond what the browser already syncs for bookmarks.
- Mobile support. AI features.

## 4. Project location

- Root: the repository folder.
- Keep every project file inside this folder. Never write files to the parent directory.

## 5. Tech stack

- **WXT** (Vite-based extension framework) for MV3, manifest generation, HMR, multi-browser
  builds. Check the current stable version before scaffolding.
- **React + TypeScript** (strict mode).
- **Tailwind CSS** (system light/dark via `prefers-color-scheme`).
- **dnd-kit** for drag & drop (with keyboard support).
- **TanStack Virtual** for virtualized grid/list.
- **Zustand** for UI state only; the bookmarks API is the source of truth.
- No Next.js, no server, no remote scripts, no inline scripts (MV3 CSP).
- Package manager: bun (or pnpm if WXT has issues with bun; document the choice).
- Testing: Vitest + React Testing Library; mock `chrome.*` APIs.
- Linting/formatting: ESLint + Prettier.

## 6. Extension surfaces (WXT entrypoints)

1. **New Tab override** (`chrome_url_overrides.newtab`): the full dashboard.
2. **Toolbar popup**: quick search, open a bookmark, "Bookmark this tab", button to open
   the full dashboard in a tab.
3. **Dashboard page**: the same dashboard openable in a normal tab.
4. **Background service worker**: keyboard commands, context menu ("Add to Arca…"),
   dead-link checks, storage cleanup.

### New Tab constraint

MV3 cannot switch `chrome_url_overrides` on or off at runtime. Implement a setting
"New Tab mode": **Dashboard** (default) / **Minimal search page** / **Redirect to a custom
URL**. Document that fully restoring the browser's own New Tab requires disabling the
extension (or a build flag that omits the override).

## 7. Permissions

- Required: `bookmarks`, `storage`, `tabs`, `topSites`, `favicon`, `contextMenus`.
- Optional, requested at runtime only for the dead-link checker and opt-in link previews:
  `optional_host_permissions: ["<all_urls>"]`.
- Favicons via the MV3 `_favicon` endpoint:
  `chrome.runtime.getURL("/_favicon/?pageUrl=<encoded url>&size=32")`, with a lettered
  fallback tile if it fails.

## 8. Features (v1)

### 8.1 Navigation & layout

- Left sidebar: collapsible folder tree with item counts; resizable; toggle with ⌘\.
- Main area: **folder cards** (click to enter) followed by bookmark items.
- Breadcrumbs for the current folder path; click any crumb to jump.
- **Grid view** (default) and **List view** toggle, remembered.
  - Grid: tiles with favicon, title, domain. Density: comfortable / compact.
  - List: favicon, title, URL, folder path, date added; sortable columns.
- Sort: manual (browser order), title A–Z, date added, domain.
- Home view: **Recently added** (last 12, by `dateAdded`) and **Most visited**
  (`chrome.topSites`), each hideable.

### 8.2 Search

- Global search, focused with ⌘K or `/`.
- Fuzzy search over titles, URLs, folder names, tags and notes; results in under 50 ms
  for 5,000 bookmarks (in-memory index rebuilt on bookmark events).
- Filter chips: folder, tag, has notes, duplicates, dead links.
- Keys: ↑/↓ move, Enter opens, ⌘Enter new tab, ⌥Enter reveals in folder.

### 8.3 Editing

- Add bookmark (title, URL, folder, tags, note) and add folder.
- Inline rename (double-click or F2); edit dialog for URL/folder/tags/note.
- Delete with confirmation for non-empty folders.
- Root folders (Bookmarks Bar, Other Bookmarks, Mobile) are read-only containers: cannot
  rename, move or delete. Handle this explicitly in the UI.

### 8.4 Drag & drop

- Reorder within a folder (`chrome.bookmarks.move` with `index`).
- Drag items/folders onto a folder card or sidebar tree node to move them.
- Drag an open tab (8.6) into a folder to bookmark it.
- Block moving a folder into itself or its descendants.
- Clear drop indicators; auto-expand tree nodes on hover after 600 ms.

### 8.5 Multi-select & bulk actions

- ⌘-click / ⇧-click, plus a hover checkbox.
- Bulk: move, add/remove tag, delete, open all (warn above 10 tabs).

### 8.6 Open tabs panel

- Toggleable right panel of open tabs in the current window.
- Drag a tab into a folder, or click "Bookmark". Mark tabs already bookmarked.

### 8.7 Tags & notes

- Stored in `chrome.storage.local`:
  `meta: Record<bookmarkId, { tags: string[]; note?: string; url: string }>`.
- `url` is a fallback key to re-link metadata if IDs change (import/sync).
- On `bookmarks.onRemoved`, delete matching metadata after the undo window expires.
- Tag manager: rename, merge, delete, colors.

### 8.8 Duplicates finder

- Normalize URLs (lowercase host, strip `www.`, trailing slash, `utm_*`, `fbclid`,
  `gclid`, fragments) and group duplicates.
- Per group: keep one, delete the rest, or merge tags/notes into the kept one.

### 8.9 Dead-link finder (opt-in)

- Request the optional host permission first, explaining why.
- Runs in the background worker: HEAD with GET fallback, 8 s timeout, concurrency 6,
  progress bar, cancel button.
- Status: OK / redirected (offer to update URL) / broken (4xx/5xx/DNS) / unknown
  (401/403/429 → probably alive).
- Cache results with timestamps; never run automatically.

### 8.10 Undo

- Last 20 actions (delete, move, rename, edit, bulk). Toast with "Undo" for 8 s, plus ⌘Z.
- Undoing a delete recreates the full subtree via `bookmarks.create` and **remaps
  tags/notes to the new IDs**.

### 8.11 Import / export

- Export: Netscape bookmark HTML and a JSON backup including tags and notes.
- Import: Netscape HTML or Arca JSON into a chosen folder, with preview and duplicate
  warnings.

### 8.12 Live sync with the browser

- Subscribe to `onCreated`, `onRemoved`, `onChanged`, `onMoved`, `onChildrenReordered`,
  `onImportBegan`, `onImportEnded`. Batch updates during imports; never require a reload.

### 8.13 Settings

- New Tab mode, default view, density, Home sections, theme (system/light/dark), accent
  color, open links in same/new tab, confirm-before-delete.
- Stored in `chrome.storage.local`.

### 8.14 Keyboard shortcuts

- Extension command to open the popup (suggested ⌥⇧B, user-changeable).
- Dashboard: ⌘K search, ⌘N new bookmark, ⇧⌘N new folder, Delete, F2 rename, ⌘A select
  all, ⌘Z undo, `G L` / `G G` list/grid, `?` shortcuts sheet.

## 9. UI / UX

- Ardia-like: 12–16 px rounded corners, subtle grainy gradient backdrop, translucent
  panels, gentle shadows, 150–200 ms animations; respect `prefers-reduced-motion`.
- Follows system light/dark by default. System font stack (SF Pro on Mac).
- Empty states for empty folders, no results, no duplicates.
- Accessibility: full keyboard navigation, visible focus rings, ARIA tree/grid roles,
  AA contrast, dnd-kit keyboard sensor.
- Popup: 380 px wide, search focused on open, top 8 results, "Bookmark this tab".

## 10. Performance budgets

- New Tab first paint under 100 ms; interactive under 200 ms with 5,000 bookmarks.
- Virtualize any list/grid over 200 items.
- Load the tree once with `getTree()`, keep a normalized map by ID, apply incremental
  updates from events.
- Lazy-load heavy views (duplicates, dead links, import/export, settings).
- Production JS under 400 KB total.

## 11. Project structure (suggested)

```
arca/
  .github/
    pull_request_template.md
  docs/
    git/
      branch-naming-guide.md
      commit-style-guide.md
      pr-style-guide.md
  entrypoints/
    newtab/
    dashboard/
    popup/
    background.ts
  src/
    components/
    features/      # search, dnd, tags, duplicates, deadlinks, undo, importexport
    lib/           # chrome API wrappers, url normalize, favicon, storage
    store/
    styles/
  tests/
  BACKLOG.md
  CHANGELOG.md
  CLAUDE.md
  README.md
```

- Every `chrome.*` call goes through `src/lib`; components never call the API directly.

## 12. Git setup & workflow

### 12.1 Repository setup (do this first)

1. `git init` in the project root with `main` as the default branch.
2. Initial commit on `main`: `chore: initialize repository` (README, .gitignore,
   BACKLOG.md, CLAUDE.md, docs/git/).
3. Create `develop` from `main`. All work branches off `develop` (Gitflow).
4. `.gitignore`: node*modules, .output, .wxt, dist, *.zip, .env\_, .DS_Store, coverage.
5. Add `.github/pull_request_template.md` using the PR body sections in 12.4.
6. Do **not** create a GitHub remote or push without asking the user first.

### 12.2 Git guides

- Copy the user's existing guides into `docs/git/` if they exist at:
  `~/.claude/skills/` (`branch-naming-guide`, `git-commit-style`, `pull-request-style-guide`).
- If they are missing, write them in `docs/git/` from the rules below.
- These guides are the source of truth; the summaries below must not contradict them.

### 12.3 Branch naming (Gitflow)

- Format: `category/description` or `category/issue-description` (e.g.
  `feature/88-folder-tree`).
- Lowercase, hyphens only, 2–5 words, no underscores, camelCase, personal names or vague
  words (`fix/bug`, `feature/updates`).
- Categories:

| Category                          | Based on | Merges into            |
| --------------------------------- | -------- | ---------------------- |
| `feature/`                        | develop  | develop                |
| `fix/`                            | develop  | develop                |
| `hotfix/`                         | main     | main + develop         |
| `release/` (e.g. `release/1.0.0`) | develop  | main + develop         |
| `refactor/`                       | develop  | develop                |
| `chore/`                          | develop  | develop                |
| `docs/`                           | develop  | develop                |
| `test/`                           | develop  | develop                |
| `experiment/`                     | develop  | never (may be deleted) |

- Never commit directly to `main` or `develop`. Always branch + PR.

### 12.4 Commits (Conventional Commits)

- Format: `type(scope): description`, optional body, optional footer.
- Subject: aim for 50 chars, hard cap 72; imperative mood; lowercase start; no period.
- Body wrapped at 72 chars, explains _why_. Footers: `Closes #n`, `Fixes #n`, `Refs #n`,
  `BREAKING CHANGE:`, `Co-authored-by:`.
- Types: `feat`, `fix`, `docs`, `style`, `refactor`, `perf`, `test`, `build`, `ci`,
  `chore`, `revert`.
  - `build` = build system/dependencies; `chore` = housekeeping with no production impact.
- Scope: optional, single word (e.g. `search`, `dnd`, `popup`, `tags`); omit when the
  change is cross-cutting.
- Breaking change: `feat(api)!: …` or a `BREAKING CHANGE:` footer.
- Revert: `revert: revert "<original subject>"` + `This reverts commit <hash>.`
- `wip:` commits allowed on feature branches only, never on `main`/`develop`.
- One logical change per commit; keep commits small.

### 12.5 Pull requests

- Title: same format as commits, `type(scope): description`. Draft:
  `[WIP] type(scope): description`, opened as a GitHub Draft.
- Body sections: **What** (1–2 sentences), **Why** (motivation + `Closes #n`),
  **Changes** (grouped by area, not a git log dump), **How to Test** (exact numbered
  steps), **Screenshots** (UI changes only), **Checklist** (self-review).
- Size: under 200 lines ideal; 200–500 acceptable; 500–1000 justify or split; over 1000
  split into stacked PRs.
- Feature/fix PRs target `develop`; hotfix and release PRs target `main` (then back-merge
  into `develop`).
- Before a PR: lint, typecheck, tests and build all pass; BACKLOG.md and CHANGELOG.md
  updated.
- If no remote exists yet, write the PR title and body in the chat and merge locally with
  `git merge --no-ff` after the user approves.

### 12.6 Commit hooks (ask first)

- Propose `lefthook` (or husky) + `commitlint` with the Conventional Commits config to
  enforce the rules. Ask before adding these dependencies.

## 13. BACKLOG.md (maintain throughout)

Create `BACKLOG.md` in the project root and keep it current. It is the single source of
truth for what's planned, in progress and done.

### Format

```
# Arca Backlog

## In Progress
- [ ] ARC-012 · Drag & drop between folders · `feature/dnd-folders` · Phase 2

## Up Next
- [ ] ARC-013 · Multi-select bulk move · Phase 2 · P1

## Backlog
- [ ] ARC-030 · Page preview thumbnails · Phase 4 · P3

## Ideas (unscoped)
- Saved searches

## Done
- [x] ARC-001 · Scaffold WXT + React + TS · `chore/scaffold` · 2026-11-14

## Known Issues / Bugs
- [ ] ARC-B01 · Favicon fallback flickers on slow load · P2
```

### Rules

- Seed it from this PRD: one item per feature in §8, grouped by the phases in §14.
- IDs: `ARC-###` for features/tasks, `ARC-B##` for bugs. Never reuse an ID.
- Priorities: P0 (blocker) – P3 (nice to have).
- Before starting work: move the item to **In Progress** and add its branch name.
- When a PR merges: move it to **Done** with the date.
- Add any bug, tech debt or idea discovered during work immediately, even if it isn't
  being fixed now.
- Update BACKLOG.md in the same PR as the related change.

## 14. Milestones

1. **Phase 1 – Core**: repo + git setup, WXT + React + TS + Tailwind scaffold, folder
   tree, grid/list, breadcrumbs, favicons, search, live sync, add/edit/delete, New Tab +
   popup.
2. **Phase 2 – Management**: drag & drop, multi-select bulk actions, undo, open tabs
   panel, Recently added / Most visited, settings, keyboard shortcuts.
3. **Phase 3 – Power tools**: tags & notes, duplicates finder, dead-link finder,
   import/export.
4. **Phase 4 – Later**: page preview thumbnails, saved searches, custom folder icons.

Finish, test and merge each phase before starting the next. Tag releases on `main`
(`v0.1.0` after Phase 1, `v0.2.0` after Phase 2, etc.) via `release/` branches, and update
CHANGELOG.md (Keep a Changelog format).

## 15. Acceptance criteria (v1)

- Every edit in Arca appears in the browser's bookmarks immediately, and vice versa,
  without reloading.
- Drag & drop never loses or duplicates a bookmark; root folders cannot be modified.
- Undo restores deleted folders with all children, tags and notes.
- Search over 5,000 bookmarks returns results in under 50 ms.
- No network requests except the opt-in dead-link checker (verify in DevTools).
- Works in Ardia and Chrome; README covers loading unpacked in both.
- Git history follows §12; BACKLOG.md reflects the true state of the project.

## 16. Risks / verify first

1. **Unpacked loading in Ardia**: confirm `chrome://extensions` with Developer mode works.
   If not, document the Chrome workflow and check Ardia's docs or Discord.
2. **New Tab override in Ardia**: Ardia has its own New Tab / command bar. Confirm the
   override applies; if not, the popup + dashboard tab become the primary entry points.
3. Bookmark IDs can change after import/sync: rely on the URL fallback for metadata.
4. Some sites block HEAD requests or rate-limit: report "unknown", not "broken".

## 17. Instructions for Claude Code

1. Read this whole PRD first.
2. Create `CLAUDE.md` in the project root summarizing: project purpose, stack, commands
   (dev, build, test, lint, zip), folder structure, the git rules in §12, and the backlog
   rules in §13, so they persist across sessions. Follow CLAUDE.md in every session.
3. Do the repo setup in §12.1, seed BACKLOG.md, then propose a short Phase 1 plan and wait
   for approval before writing feature code.
4. Ask before deviating from the stack or adding dependencies not listed here.
5. Use current stable package versions; check docs instead of guessing APIs.
6. Write tests for the bookmarks wrapper, URL normalization, undo, and tag remapping.
7. Work one backlog item per branch, small commits, PR per item, following §12.
