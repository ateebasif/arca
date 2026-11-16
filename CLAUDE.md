# CLAUDE.md — Arca

Read this at the start of every session and follow it. The full spec is
[arca-prd.md](arca-prd.md); this file is the short version plus the rules that must
persist.

## What this is

Arca is a Manifest V3 browser extension that turns the browser's real bookmarks into a
fast, visual, editable dashboard (Opera GX speed-dial style). Primary target: **Ardia**
(Chromium, macOS). Must also work in Chrome, Dia, Brave, Edge.

- `chrome.bookmarks` is the source of truth. Every edit in Arca is a real bookmark edit.
- Private: no analytics, no accounts, no remote code, no network calls except opt-in
  features (link previews, dead-link checker).
- Fast: New Tab first paint < 100 ms, interactive < 200 ms at 5,000 bookmarks, search
  < 50 ms, production JS < 400 KB.

## Project location

- Root: `/Users/ateebasif/Downloads/ProjectsLocal/Side-Hustle/arca/`.
- Keep every project file inside this folder. Never write to the parent directory.

## Stack

WXT (MV3) · React + TypeScript (strict) · Tailwind CSS · dnd-kit · TanStack Virtual ·
Zustand (UI state only) · Vitest + React Testing Library (mock `chrome.*`) · ESLint +
Prettier. Package manager: **bun** (fall back to pnpm only if WXT breaks; document why).

- TypeScript is pinned to **5.9.x**: typescript-eslint supports `<6.1` and WXT's template
  targets 5.x, so TS 7 waits until the tooling catches up.
- Path alias `@/` = project root, so app code imports as `@/src/lib/...`.
- Tests use WXT's `fakeBrowser` (in-memory `browser.*`), reset after each test in
  `tests/setup.ts`. ESLint blocks the `chrome` global outside `src/lib`, background and tests.
- `fakeBrowser` has no bookmarks API: call `installFakeBookmarks(seed)` from
  `tests/fakes/bookmarks.ts` in `beforeEach` to get a Chromium-like in-memory tree.
- `bun run e2e` loads the built extension into headless Chrome (throwaway profile)
  and runs `scripts/e2e/smoke.ts`; screenshots go to `.e2e/`. Use it to verify UI work
  in a real browser. The fake's move semantics are checked against Chrome there.
  Ardia disables DevTools automation, so Ardia checks are manual (see README).
- Wrappers throw `ArcaError` with a stable `code` (`ROOT_FOLDER`, `INVALID_MOVE`,
  `NOT_FOUND`, `NOT_A_FOLDER`, `API`); the UI should branch on `code`, not `message`.

- No Next.js, no server, no remote scripts, no inline scripts (MV3 CSP).
- Ask before adding any dependency not listed here or deviating from the stack.
- Use current stable versions; check docs instead of guessing APIs.

## Commands

| Task      | Command                                 |
| --------- | --------------------------------------- |
| Install   | `bun install`                           |
| Dev (HMR) | `bun run dev`                           |
| Build     | `bun run build`                         |
| Zip       | `bun run zip`                           |
| Test      | `bun run test`                          |
| Lint      | `bun run lint`                          |
| Typecheck | `bun run typecheck`                     |
| Format    | `bun run format` (`format:check` in CI) |
| E2E       | `bun run build && bun run e2e`          |

## Structure

```
entrypoints/   newtab/, dashboard/, popup/, background.ts
src/
  components/  shared UI
  features/    search, dnd, tags, duplicates, deadlinks, undo, importexport
  lib/         chrome API wrappers, url normalize, favicon, storage
  store/       Zustand stores (UI state only)
  styles/
tests/
docs/git/      branch, commit and PR guides (source of truth for git rules)
```

- **Every `chrome.*` call goes through `src/lib`.** Components never call the API
  directly.
- Load the tree once with `getTree()`, keep a normalized map by ID, apply incremental
  updates from bookmark events.
- Root folders (Bookmarks Bar, Other Bookmarks, Mobile) are read-only: never rename,
  move or delete them.
- Lazy-load heavy views (duplicates, dead links, import/export, settings). Virtualize
  any list/grid over 200 items.

## Feature notes

- Undo (`src/features/undo`): record one action per user operation; resolve ids
  with `resolveId` (restores create new ids); restore URLs with `restore: true`.
- Drag & drop (`src/features/dnd`): folder drop zones win over sortable items;
  check `isDragActive()` before item key handlers act.
- Rarely used views are lazy (`src/components/overlays/lazyOverlays.ts`,
  `ActivePreviews`); tests must `await findBy…` them.

## Security rules (see SECURITY.md)

- Never use `eval`, `new Function`, `innerHTML`, `dangerouslySetInnerHTML`,
  `insertAdjacentHTML`, `document.write` or `executeScript` (ESLint enforces).
- Never render a bookmark URL as `href` directly; use `bookmarkLinkProps` /
  `safeHref`. Open URLs only through `openSafely` / `openUrl`, which block
  `javascript:`, `data:` and other code-carrying schemes.
- Validate anything read from storage (`src/lib/validate.ts`).
- Don't add content scripts, web-accessible resources, host permissions or external
  message listeners. If messaging between Arca's own pages is ever needed, check
  `sender.id === browser.runtime.id`.
- Network access only behind an optional permission the user grants in Settings
  (link previews today; dead-link checker later). Fetch with `credentials: 'omit'`,
  `referrerPolicy: 'no-referrer'`, timeouts and size caps; parse HTML only with
  `DOMParser`; never store or render remote HTML.
- Keep `bun run security` and the e2e security checks green.

## Git rules (full detail in `docs/git/`, which wins on any conflict)

- **Gitflow.** `main` = releases, `develop` = integration. Never commit directly to
  either; always branch + PR (or local `--no-ff` merge after the user approves).
- **Branches:** `category/description` or `category/issue-description`, lowercase,
  hyphens, 2–5 words. `feature/ fix/ refactor/ chore/ docs/ test/ experiment/` branch
  off `develop`; `hotfix/` off `main` (→ main + develop); `release/x.y.z` off `develop`
  (→ main + develop).
- **Commits:** Conventional Commits `type(scope): description`. Subject ≈50 chars, max
  72, imperative, lowercase, no period. Body wrapped at 72, explains why. Types: feat,
  fix, docs, style, refactor, perf, test, build, ci, chore, revert. Single-word scope or
  none. `wip:` only on feature branches, never merged as-is. One logical change per
  commit.
- **PRs:** title same format as commits (`[WIP] ` prefix for drafts). Body: What, Why,
  Changes (grouped by area), How to Test (numbered), Screenshots (UI only), Checklist.
  Aim < 200 lines; > 1000 must be split. Template: `.github/pull_request_template.md`.
- **Before a PR:** lint, typecheck, tests, build, `bun run security` and `bun run e2e` pass; BACKLOG.md and CHANGELOG.md
  updated in the same PR.
- **No remote yet:** never create a GitHub remote or push without asking. Until one
  exists, write the PR title + body in chat and merge locally with `git merge --no-ff`
  after the user approves.
- Releases: `release/` branch → tag on `main` (`v0.1.0` after Phase 1, `v0.2.0` after
  Phase 2, …) → back-merge to `develop`. CHANGELOG.md uses Keep a Changelog.
- Commit hooks (lefthook + commitlint) run on every commit: prettier + eslint on staged
  files, commitlint on the message (`commitlint.config.js`). Skip once with `LEFTHOOK=0`.

## Backlog rules (BACKLOG.md)

- Single source of truth for planned / in progress / done.
- IDs: `ARC-###` for features/tasks, `ARC-B##` for bugs. Never reuse an ID.
- Priorities P0 (blocker) → P3 (nice to have).
- Before starting work: move the item to **In Progress** with its branch name.
- When its PR merges: move it to **Done** with the date.
- Log any bug, tech debt or idea found during work immediately, even if not fixing it.
- Update BACKLOG.md in the same PR as the related change.

## Workflow

- One backlog item per branch, small commits, one PR per item.
- Finish, test and merge each phase before starting the next.
- Required tests: bookmarks wrapper, URL normalization, undo, tag remapping.
