# Changelog

All notable changes to this project are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the project uses
[Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Security

- Mini windows: Arca could mistake a normal window for one of its mini windows after
  a browser restart (window ids are reused) and close it. Ids now live in session
  storage, and every window is checked to still be a one-tab popup before Arca acts.
- Link previews never contact your local network (localhost, `*.local`, private IPs)
  on a public page's behalf, via its image or a redirect.
- Local AI requests no longer follow redirects, cap the reply size and can be
  cancelled.
- Search text and Ask questions are no longer saved to disk as embeddings.
- Broken-link results older than two weeks are deleted, with a "Forget results"
  button; a check refuses to run without site access.

- Strict Content Security Policy for all extension pages.
- Other extensions and websites can't message, frame or fetch Arca.
- `javascript:`, `data:` and similar bookmark URLs are never opened or rendered as
  links (shown as "Blocked link"), and Arca refuses to save them.
- Stored settings are validated on load.
- `bun run security` checks the built extension; e2e simulates a hostile extension,
  a hostile website and a planted bookmarklet. See SECURITY.md.

### Fixed

- Tags on link tiles no longer get cut off at the bottom of the card: the folder
  and tags now share one line.
- Tags added in two Arca pages at the same time no longer overwrite each other.
- Folder names from AI organize keep leading accented or non-Latin letters
  ("Éducation", "日本 News").
- Stop on link check / clean-out review keeps working after a quick restart.
- Cancel and Stop now stop Ollama too; Ask Arca stops reading the library when its
  panel closes; list descriptions stop when rows scroll away or the setting is off.

### Performance

- Tagging many items (bulk tag, organize with tags) is one storage write instead of
  one per item.
- Bursts of bookmark changes (organize, bulk moves) render once instead of per item.
- AI organize no longer freezes the page while grouping large libraries.
- Meaning matches read cached readings in one go and remember what's missing,
  instead of thousands of IndexedDB reads per keystroke.
- Preview cache: memory capped, pruning no longer loads every thumbnail, abandoned
  fetches are dropped; thumbnails decode at thumbnail size.
- In-memory AI vectors capped by size (96 MB) and freed when AI is turned off.

- "Small tiles" now applies to folders too (compact folder rows), so the
  Large/Small switch visibly changes views that are mostly folders.
- The folder picker's search box now gets focus as soon as it opens (it could
  stay on the button, so typing went nowhere).
- List descriptions no longer show a loading bar forever when a description
  can't be written (Ollama busy or unavailable); those rows are just left blank.
- Selection checkboxes: in list view and small tiles they have their own column
  at the left (the site/folder icon stays visible); on tiles and folder cards they sit
  centred on the right of the cover, clear of the site name and favicons. The
  selection bar is centred over the main area and the list leaves room for it.
- Ask Arca follow-ups ran a fresh keyword/meaning search on the new words, so
  "what would u pick" returned colour pickers. The model now sees the previous
  results first: choosing or narrowing ("which would you pick", "only the anime
  one", "quickest to cook") answers from them, while a new topic ("any recipes?")
  searches again. Narrowed answers show just the picks.
- Reading progress (first time or after switching embedding models) shows on the
  sidebar's Ask Arca button ("reading 42%") and just above the input again,
  instead of scrolling out of view.
- nomic-embed-text v2 (MoE) gets its search prefix for AI organize too, so both
  features share its cached readings.
- Rename from the right-click / ⋯ menu did nothing for folders that also show in
  the sidebar: both copies opened a name field and fought over focus. Rename now
  opens only where you started it (main view or sidebar).
- AI organize no longer nests "Organized by Arca" inside itself. Organizing
  inside it (or one of its topic folders) works in place, organizing a folder
  that already has one reuses it, topic folders with the same name are reused,
  and old topic folders the run emptied are removed. One Undo still reverses it.
- The layout switcher is one control (Large tiles · Small tiles · List) with a
  single clear selected state, instead of a density toggle that looked selected
  next to the Grid/List pair.
- AI organize no longer stops when you switch Tidy up tabs, close the panel or
  open another folder. The run keeps going, the sidebar's Tidy up button shows
  its progress ("AI 42%", "AI ready to review"), and reopening Tidy up returns
  to the suggestions, which still apply to the folder you started in. Tidy up
  also reopens on the last tab you used.
- Settings (and other long dialogs) ran off the bottom of short windows; the
  body now scrolls while the title and buttons stay visible.
- Settings → Local AI said "Connected" even when Ollama would refuse Arca's
  requests. Test connection now checks the same kind of request AI organize
  makes, and the fix is shown as numbered steps.
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

- Selection checkboxes are rounded squares instead of circles.
- Choosing a folder (popup "Bookmark this tab", Edit dialog, bulk Move) uses a
  searchable folder picker instead of a long system dropdown: type to filter
  (with each folder's path), recently used folders first, then the indented
  tree; arrows and Enter to pick.
- Popup search shows every match with a result count, in a list about ten rows
  tall that scrolls (it used to stop at 8).
- Bookmarks open in a new tab by default (applied once to existing settings,
  since mini windows open full-size in Ardia and Arc; change it in Settings).
- Link preview cards appear right below the hovered list row (or above it near
  the bottom), aligned with the title and kept fully on screen; tiles keep the
  side placement with the same fallback. Moving the pointer into a card keeps it
  open even if it crosses other rows; switching cards needs a short pause on
  another bookmark. Rows no longer stack the browser tooltip on top of the card.
- Ask Arca is much faster: matches (by meaning and keyword, up to 40) appear in
  well under a second and the AI's answer follows in a couple of seconds, with
  its picks listed first, "Show more", and a jump to all keyword results.
  Bookmarks are read in the background as soon as the panel opens, models stay
  loaded between questions, and answers are capped so a model can't ramble.
- Cached AI readings no longer include folder names, so organizing or moving
  links doesn't force everything to be read again, and AI organize and Ask Arca
  share the same cache (with qwen3-embedding).
- Modern dark redesign: tiles get a cover in the site's brand colour (from its
  favicon, contrast-checked), folders match the tile shape, a deeper dark
  palette, and dark is the default theme.
- Subtle motion: tiles rise in when a folder opens, cards lift and glow on hover,
  menus and dialogs pop in. All of it respects "reduce motion".
- Two-row header: breadcrumb, search and add on top; view controls below.

### Added

- **Import** (Settings → Backup): bookmarks exported from any browser (HTML) or an
  Arca backup (JSON) go into a new folder after a preview; duplicates are skipped
  by default, tags are kept, and one Undo removes the whole import.
- AI organize can work on **all bookmarks** at once (not just the open folder):
  results go into Other bookmarks / Organized by Arca; the Bookmarks bar is left
  alone unless you include it.
- AI organize: optional instructions for folder names and for tags (empty boxes use
  the defaults shown in them). The model now suggests 1–3 tags per folder that
  follow your rules and reuse tags you already have; edit them before applying.
- AI organize can **let the AI decide how many folders**: it tries different
  counts (up to 60 for big libraries) on a sample of your links and keeps the one
  whose groups separate most cleanly. It's the new default; the quick estimate
  and fixed counts (now up to 60) are still there.
- **Related by meaning** in search results (local AI on): links close in meaning
  to what you typed that the keyword search missed, from the readings Ask Arca
  already cached. Only your query is sent to the local model, so it's quick
  and never starts reading the library from a keystroke.
- **Add to Arca…** in the right-click menu on any web page or link: opens Arca's
  popup as a save box with an editable title, the folder picker (create folders
  there too) and tags. It says if the page is already saved. Falls back to a
  small window if the browser won't open the popup from a menu.
- **Tag manager** (sidebar → Tags → Manage): find, rename (renaming to an existing
  tag merges them), merge several checked tags into one, recolour (8 colours,
  shown everywhere tags appear), delete a tag from every item, or jump to its
  items. It also spots look-alike tags (react / reactjs / React.js) and merges
  them in one click. Every change is one undo.
- Selection bar: **Select all** (everything in the folder or view, including rows
  not yet scrolled into view) once one item is picked, and **Ungroup** for the
  selected folders (several at once, asks first; one undo).
- Create a folder right from the folder picker (popup save, Edit, bulk Move):
  "New folder in …" at the bottom, or type a name that doesn't exist yet and pick
  "Create …". It goes inside the chosen folder, is selected straight away, and
  can be undone.
- **Backup** (Settings): export all bookmarks as a standard HTML bookmarks file
  any browser can import (tags included, Bookmarks bar marked as the toolbar), or
  as an Arca JSON backup with the full tree and tags. Saved through a normal
  download link, so no extra permission is needed.
- **Broken links** (Tidy up → Clean out, opt-in): checks every link with a HEAD
  request (GET if refused), no cookies or referrer, nothing downloaded, 8 s
  timeout, 6 at a time and 2 per site. Broken links (404/410/server errors/sites
  that no longer exist) join Clean out to archive or delete; moved links can be
  updated to their new address (one at a time or all, one undo). Login walls and
  rate limits count as "couldn't confirm". Results are cached for two weeks and
  the check never runs on its own.
- **Multi-select and bulk actions**: hover a tile, card or row and tick its
  checkbox to start selecting; then clicks toggle items, ⇧-click selects a range,
  ⌘A selects everything shown and Esc clears. A bar at the bottom moves the
  selection to a folder, adds or removes tags, opens all links (asks first above
  ten) or deletes, each in one undo.
- AI organize can also tag links with their new folder's name (e.g. "Torrent
  Sites" → `#torrent-sites`): tick "Also tag links with their folder name" in the
  review step. Existing tags are kept, and one Undo removes the moves and the tags.
- **Clean out** (Tidy up): suggests bookmarks that look saved on impulse:
  search-result pages, local/temporary links, one-time pages (sign-in, checkout,
  password reset…), titles that say nothing, and saves over 3 years old. With local
  AI on, an optional second opinion labels what each page is and flags news, past
  events, single videos, specific downloads and deals. Pick what to remove and
  **Archive** (to "Archived by Arca", still searchable) or Delete; one Undo
  reverses either.
- **One-line descriptions** in list view (with local AI on): the answer model
  writes a short line under each title from its title and address, only for rows
  you look at, once per link (cached); a cached link preview's own description
  is used when there is one. Toggle in Settings → Local AI.
- **Tags**: add tags to any bookmark or folder in its Edit dialog (with
  suggestions from tags you already use). Tags show as coloured chips on tiles,
  list rows and folder cards; the sidebar lists every tag with a count, and
  clicking one shows everything with that tag from all folders. Search finds
  tags too, and `#tag` lists only tagged items. Tags follow a bookmark through
  undo and re-link by URL if bookmark ids change. Ask Arca sees them as context.
- Ask Arca ranks its picks (1, 2, 3…) with a few words on why each fits, and
  "which would you pick?" style follow-ups show up to five ranked options.
- **Ungroup** a folder (right-click or ⋯ → Ungroup): everything inside moves up to
  where the folder was, in order, and the empty folder is removed. One Undo puts
  it back.
- Ask Arca has an "Answers by" model picker (smallest marked fastest), separate
  from the folder-naming model.
- The Ask Arca chat survives leaving the tab: open a result in the same tab, go
  Back, and the chat (and panel) come back. It's kept only in that tab and gone
  when the tab closes.
- Settings explains that some browsers (Ardia, Arc) show mini windows as regular
  windows, and that their own Little Arc / Peek can't be opened by extensions.
- Mini windows can become a normal tab: while one is open, a small bar in Arca
  offers **Open here** (or close). In the mini window itself, right-click →
  **Open in main window**, or press ⌥⇧O. Mini windows now open as a peek on the
  right side of the screen. Ask Arca results and previews follow the "Open links
  in" setting too.
- **Ask Arca** (sidebar, or "Ask Arca" in search results): describe a bookmark the
  way you remember it ("I had some torrent sites saved somewhere") and get your
  real bookmarks back, with a short answer. Follow-ups refine it ("only the movie
  ones"). Runs on local Ollama: the embedding model finds links by meaning and
  keywords, the chat model picks the ones that fit and can only point at real
  bookmarks. The first question reads all bookmarks once; later answers take a
  few seconds.
- AI organize shows live progress: elapsed time, an estimate of what's left,
  which links are being read (or which group is being named), how many came
  from the cache, and a "Starting the model" state for the first batch.
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
