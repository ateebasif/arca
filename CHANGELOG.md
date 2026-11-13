# Changelog

All notable changes to this project are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the project uses
[Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Security

- Strict Content Security Policy for all extension pages.
- Other extensions and websites can't message, frame or fetch Arca.
- `javascript:`, `data:` and similar bookmark URLs are never opened or rendered as
  links (shown as "Blocked link"), and Arca refuses to save them.
- Stored settings are validated on load.
- `bun run security` checks the built extension; e2e simulates a hostile extension,
  a hostile website and a planted bookmarklet. See SECURITY.md.

### Fixed

- Undo could stop half-way when restoring a folder containing a bookmarklet
  (javascript:) link, and older undo steps broke after a deleted item was
  restored with a new id. Undo now restores browser URLs as they were and
  tracks re-created ids.
- Undoing "Add folder" no longer deletes links you put in it afterwards.
- Tidy up could remove every copy of a page if the chosen copy left the
  "Look in" scope; it now always keeps one. Sort/group skip links that changed
  in the meantime and stay undoable if interrupted.
- Keyboard drag & drop can now drop into folders; Enter, F2 and Delete no longer
  act (or follow the link) mid-drag. Screen-reader announcements use names.
- A link preview now reappears on the same tile after using its buttons; Escape
  in the popup search brings its sections back.

- Search showed the same page many times when it was saved in several folders
  (e.g. imported Trash copies). Copies now fold into one result marked
  "in N folders", and long folder paths are shortened in the middle.
- Long breadcrumbs no longer run into the search box; middle folders collapse
  to "…".
- Folder card bookmark counts no longer wrap onto two lines next to the favicon
  preview.

### Changed

- Modern dark redesign: tiles get a cover in the site's brand colour (from its
  favicon, contrast-checked), folders match the tile shape, a deeper dark
  palette, and dark is the default theme.
- Subtle motion: tiles rise in when a folder opens, cards lift and glow on hover,
  menus and dialogs pop in. All of it respects "reduce motion".
- Two-row header: breadcrumb, search and add on top; view controls below.

### Added

- **AI organize** (Tidy up → AI organize, opt-in): groups a folder's links by topic
  with models running in your local Ollama, suggests folder names, and lets you
  rename or untick groups before moving anything into "Organized by Arca". One
  Undo reverses it. Embeddings are cached, so only new links are processed next
  time. Settings → Local AI picks the models (default `qwen3-embedding:4b` for
  grouping, `llama3.2` for names) and shows the `OLLAMA_ORIGINS` command if Ollama
  blocks the extension.
- Link preview cards are interactive: move the pointer into the card to scroll a
  readable excerpt and the page's headings, see the site, folder, date added and
  full link, and open it in a tab or mini window.
- Popup now shows Most visited sites, Recently added bookmarks and folder
  shortcuts (open the dashboard at that folder), plus Open dashboard and Tidy up.
- Tidy up (sidebar): find and remove duplicate bookmarks (keeps the best copy,
  never one in Trash unless it's the only one; you can pick), remove empty
  folders, sort a folder permanently, and group links into per-site folders.
  Runs locally; every action is one Undo.
- Drag & drop: reorder tiles and rows (manual sort), drop onto a folder card's
  cover, a sidebar folder (collapsed ones open after 0.6 s) or a breadcrumb to
  move. Folders can't go into themselves; root folders don't move. Keyboard:
  Space to pick up and drop, arrows to move, Esc to cancel. Every move is
  undoable.
- Undo for deletes (whole folders restored in place), renames, edits, moves and
  adds: an Undo button in the toast for 8 seconds, or ⌘Z for the last 20.
- Settings → "Open links in": same tab, new tab, new background tab, or a mini
  window (small, toolbar-less). Applies to tiles, search, the popup and the
  minimal New Tab. The item menu also offers "Open in mini window".
- Back / forward through folders: buttons next to the breadcrumbs, `[` and `]`,
  ⌥↑ for the parent folder, and mouse side buttons. `?` shows all shortcuts.
- "All links" view: every bookmark inside the open folder and its subfolders
  in one grid or list, each labelled with the folder it lives in.
- Arca icon: a strongbox with an arched lid, used for the toolbar, the
  extensions page, tab favicons and the sidebar logo.
- Repository setup: git guides, CLAUDE.md, backlog, PR template.
- WXT + React + TypeScript scaffold with New Tab, dashboard and popup pages and a
  background worker.
- Tailwind CSS with system light/dark tokens and reduced-motion support.
- ESLint, Prettier and Vitest + React Testing Library with a fake browser API.
- `src/lib` wrappers for bookmarks, storage, tabs, top sites and favicons, with
  root-folder and move-into-descendant guards.
- In-memory bookmarks fake for tests that mirrors Chromium's behaviour.
- Bookmark store: the tree is loaded once, kept in sync from browser events, and
  reloaded after browser imports or anything unexpected.
- Sidebar folder tree with bookmark counts, keyboard navigation, resizing and
  ⌘\ to hide it. View preferences are remembered.
- Grid view with folder cards (count + favicon preview) and bookmark tiles,
  comfortable and compact density, breadcrumbs, and an empty-folder state.
- Favicons from the browser cache with a coloured letter tile when the browser
  only has its generic placeholder.
- List view with title, URL, folder and date columns; click a column to sort.
- Sort by manual order, title, date added or domain, in either direction.
- Global fuzzy search (⌘K or /) over titles, URLs and folder names, with
  keyboard navigation, ⌘Enter for a new tab, ⌥Enter to show in folder, and an
  "in this folder" filter.
- Add bookmarks and folders, edit title/URL/folder, rename inline (F2, or
  double-click in the sidebar), and delete (non-empty folders ask first).
- Item menu from the ⋯ button, right-click or Shift+F10.
- Root folders are read-only everywhere in the UI.
- New Tab modes: dashboard, minimal search page, or redirect to a URL, chosen
  in a new Settings dialog.
- Toolbar popup (⌥⇧B): quick search with the top 8 results, "Bookmark this tab"
  with a remembered folder, "Saved in …" for bookmarked pages, and a button to
  open the dashboard in a tab.
- Folders with more than 200 items render virtually (a 1,000-item folder
  opens in ~30 ms with ~60 tiles in the DOM).
- Theme colours meet WCAG AA contrast in light and dark. New Tab paints in
  ~30 ms and is interactive in ~35 ms with 5,000 bookmarks.
- README: install steps for Chrome-family browsers and Ardia, plus what is
  still unverified in Ardia.
- Theme switch (System / Light / Dark) in the sidebar and Settings. The choice
  applies before first paint and syncs across open Arca tabs and the popup.
- Opt-in link previews: hover or focus a bookmark to see its title, description and
  image. Requires site access granted in Settings; each page is fetched once
  without cookies and cached locally for a week.
- `bun run e2e`: smoke checks against real Chrome with the built extension,
  including performance budgets and an audit that no request leaves the
  extension.
