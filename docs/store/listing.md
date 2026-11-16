# Chrome Web Store listing

Copy for the store's developer dashboard. Screenshots are in this folder
(1280×800, regenerate with `bun run build && bun scripts/screenshots.ts --store`).

## Before submitting

1. Set the version (it's `0.0.0` until the first release): bump `version` in
   `package.json` as part of the release, e.g. `0.1.0`.
2. `bun run build && bun run zip`. Upload `.output/arca-<version>-chrome.zip`.
3. Host the privacy policy: link to `PRIVACY.md` in the public GitHub repository.
4. Fill in the fields below. Data usage: tick **none** of the data types.

## Fields

**Name:** Arca

**Summary (max 132 characters):**
Your bookmarks as a fast, visual dashboard. Search, tags, notes and tidy-up tools, with optional local AI. Private by design.

**Category:** Productivity

**Language:** English

**Description:**

Arca turns your browser's real bookmarks into a fast, visual dashboard on your New Tab
page. Every change you make in Arca is a real bookmark change, so your browser's sync
and other devices stay in step.

FIND ANYTHING
• Instant search (⌘K) across titles, addresses, folders, tags and notes
• Filter by tag, notes, duplicates or broken links, and save searches
• Home shows your newest bookmarks and most visited sites

ORGANIZE
• Folder cards, tiles or a list; drag and drop to move or reorder
• Tags, notes and emoji folder icons
• Select many items to move, tag, open or delete them together
• Open tabs panel: drag a tab onto a folder to bookmark it
• Everything is undoable

TIDY UP
• Remove duplicates and empty folders, sort folders for real
• Find broken and moved links (optional)
• Clean out old one-time saves

OPTIONAL LOCAL AI
With Ollama running on your own computer, Arca can group links into topic folders,
suggest tags, describe bookmarks, and find a bookmark from a vague description. Nothing
is sent to any cloud service.

PRIVATE BY DESIGN
No accounts, no analytics, no tracking, no remote code. Arca makes no network requests
unless you turn on link previews, the broken-link check or local AI.

Open source under the MIT license.

**Single purpose (for the review form):**
Arca shows and manages the user's browser bookmarks as a dashboard on the New Tab page
and in a popup.

**Permission justifications:**

- `bookmarks`: core feature; reads and edits the user's bookmarks.
- `storage`: stores tags, notes, settings and caches locally.
- `tabs`: opens bookmarks, bookmarks the current tab, lists open tabs in the Open tabs
  panel.
- `topSites`: shows "Most visited" on Home and in the popup.
- `favicon`: shows site icons from the browser's favicon cache.
- `contextMenus`: the right-click "Add to Arca…" item.
- Optional host access (`<all_urls>`): requested only when the user turns on link
  previews, the broken-link check, or local AI (to reach Ollama on localhost).
- New Tab override: Arca's dashboard is the New Tab page; Settings offers a minimal
  page or a redirect instead.

**Remote code:** No, Arca uses no remote code.

**Data usage:** Arca does not collect or transmit user data.

## Assets

| Asset             | Size     | File                          |
| ----------------- | -------- | ----------------------------- |
| Icon              | 128×128  | `public/icon/128.png`         |
| Screenshots (1–5) | 1280×800 | `docs/store/screenshot-*.png` |
| Small promo tile  | 440×280  | not made yet (optional)       |
