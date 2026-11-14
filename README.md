# Arca

A bookmark dashboard extension for Ardia and other Chromium browsers. Arca turns your
real browser bookmarks into a fast, visual, fully editable dashboard on your New Tab,
with search, folders, and quick editing. Every change is a real bookmark change, and all
data stays on your machine.

> _Arca_ (Latin): a chest where valuables were kept.

**Status:** Phase 1 (core) complete, pre-release. See [BACKLOG.md](BACKLOG.md) and
[CHANGELOG.md](CHANGELOG.md).

## What it does

- **Dashboard**: sidebar folder tree, folder cards and bookmark tiles with
  brand-coloured covers (or a sortable list), breadcrumbs, back/forward.
- **All links view**: every link inside a folder and its subfolders in one grid,
  each labelled with its folder.
- **Search** (⌘K or `/`): fuzzy over titles, URLs and folders; copies of the same
  page fold into one result ("in N folders").
- **Editing**: add, edit, rename (F2), delete, all undoable (⌘Z or the toast's
  Undo).
- **Drag & drop**: reorder tiles, drop on a folder card's top band, a sidebar
  folder or a breadcrumb to move. Keyboard: Space, arrows, Space.
- **Broken links** (opt-in): find dead or moved links and fix or remove them.
- **Clean out**: finds impulse saves (old searches, local links, one-time pages,
  optional AI review) to archive or delete, all undoable.
- **Tidy up**: remove duplicates (keeps the best copy), remove empty folders,
  sort a folder for real, group links into per-site folders. Local and undoable.
- **AI organize** (opt-in, local only): groups links by topic with your own
  [Ollama](https://ollama.com) models and suggests folder names; you review
  before anything moves, and one Undo reverses it. See _Local AI_ below.
- **Ask Arca** (opt-in, local only): describe a bookmark you half remember and
  Arca finds it, with follow-up questions to narrow it down.
- **Mini windows**: open links as a small peek window; move one into your main
  window with **Open here**, right-click → Open in main window, or ⌥⇧O.
- **Multi-select**: tick items (or ⇧-click, ⌘A) to move, tag, open or delete them
  together.
- **Tags**: tag bookmarks and folders, filter by tag from the sidebar, or search
  `#tag`.
- **Descriptions** (local AI): a one-line summary under each title in list view.
- **Backup**: export everything as an HTML bookmarks file or a JSON backup with
  tags (Settings → Backup).
- **Open links in**: same tab, new tab, background tab or a mini window.
- **Link previews** (opt-in): hover a bookmark for a card you can scroll, with an
  excerpt, headings and quick-open buttons. Fetched once without cookies,
  cached for a week.
- **Popup** (⌥⇧B): search, bookmark this tab, most visited, recently added,
  folder shortcuts, Tidy up.
- **Dark-first design** with System / Light / Dark, subtle motion (off under
  "Reduce motion").

Private by design: no analytics, no accounts, no remote code, and no network requests
unless you turn on link previews or local AI (which only talks to Ollama on this computer). See [SECURITY.md](SECURITY.md).

## Local AI (optional)

Arca can use [Ollama](https://ollama.com) on this computer to organize bookmarks. No
Docker, no vector database, no cloud: Ollama embeds each link's title, site and folder,
Arca clusters the vectors itself and caches them in the browser, and a small chat model
names each group.

1. Pull models (any embedder and chat model work; these are the recommended ones):
   `ollama pull qwen3-embedding:4b` (best grouping; about 90 ms per link on the first
   run) or `nomic-embed-text` (about 10 ms per link, rougher groups), and
   `ollama pull llama3.2` for names.
2. Let Arca talk to Ollama (Ollama blocks browser extensions by default). Use your
   extension ID from the extensions page; Settings → Local AI shows the exact command:
   `launchctl setenv OLLAMA_ORIGINS "chrome-extension://<arca-id>"`, then quit and
   reopen Ollama.
3. Settings → Local AI → turn on (the browser asks to allow `localhost:11434`), pick
   models.
4. Open a folder → Tidy up → AI organize → Suggest folders → review → Apply.
5. Or click **Ask Arca** in the sidebar (or "Ask Arca" in search results) and
   describe what you're looking for. The first question reads every bookmark once
   (cached); after that, answers take a few seconds.

## Keyboard shortcuts

Press `?` in the dashboard for the full list. Highlights: ⌘K search, `[` / `]`
back/forward, ⌥↑ parent folder, F2 rename, Delete or ⌘⌫ delete, ⌘Z undo, ⌘\ sidebar.
Arca avoids shortcuts browsers use (⌘N, ⌘T, ⌘[).

## Install (load unpacked)

Build first:

```bash
bun install
bun run build
```

This writes the extension to `.output/chrome-mv3`.

### Chrome, Brave, Edge, Dia

1. Open `chrome://extensions` (Edge: `edge://extensions`).
2. Turn on **Developer mode** (top right).
3. Click **Load unpacked** and choose the `.output/chrome-mv3` folder.
4. Open a new tab. Chrome asks whether to keep the New Tab change; choose **Keep it**.
5. Optional: pin Arca from the puzzle-piece menu so the popup is one click away.

After rebuilding, click the reload icon on Arca's card in `chrome://extensions`.

### Ardia

Verified by hand in Ardia 0.2.46 (Chromium 157) on 2026-11-13:

1. Open `ardia://extensions`, turn on **Developer mode**, click **Load unpacked** and pick
   `.output/chrome-mv3`. Arca loads and reads your bookmarks (tested with ~4,000).
2. Ardia shows one **Warning**: `'externally_connectable' specifies neither 'matches' nor
'ids'; nothing will be able to connect`. That is intended: it's the setting that stops
   other extensions and websites from talking to Arca (see SECURITY.md).
3. **⌘T opens Ardia's command bar, not a New Tab page**, so the New Tab override doesn't
   show there. Open Arca instead by typing "Arca" in the command bar (**Arca — Open
   Extension**), then keep that tab in Ardia's sidebar so the dashboard is one click away.
   The popup (⌥⇧B) is the quick-search entry point.

### Getting your browser's New Tab back

Browsers don't let extensions switch their New Tab override off at runtime. Arca's
Settings offer a **minimal search page** or a **redirect to a URL** instead; to get the
browser's own New Tab back, disable Arca in the extensions page.

## Development

Requires [bun](https://bun.sh) and Node 20+.

```bash
bun run dev        # dev build with HMR in a Chromium window
bun run build      # production build in .output/chrome-mv3
bun run zip        # packaged zip
bun run test       # unit + component tests (Vitest, fake browser APIs)
bun run lint       # ESLint
bun run typecheck  # tsc
bun run e2e        # real-Chrome smoke + security checks (after `bun run build`)
bun run security   # static checks on the built manifest, CSP and bundle
```

`bun run e2e` loads the built extension into headless Google Chrome with a throwaway
profile (via the DevTools `Extensions.loadUnpacked` command; branded Chrome ignores
`--load-extension`). It checks rendering, search speed with 5,000 bookmarks, editing
round-trips, New Tab modes, the popup and virtualization, and saves screenshots to
`.e2e/`. Set `CHROME_PATH` to use another Chromium binary.

## Docs

- Product spec: [arca-prd.md](arca-prd.md)
- Working agreement for contributors and agents: [CLAUDE.md](CLAUDE.md)
- Git conventions: [docs/git/](docs/git/)
