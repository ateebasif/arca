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
