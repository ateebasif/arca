# Chrome Web Store listing

Copy for the store's developer dashboard. Screenshots and the promo tile are in this
folder (regenerate with `bun run build && bun scripts/screenshots.ts --store` and
`bun scripts/render-promo.ts`).

## Before submitting

1. Build the release zip: `bun run build && bun run zip`, then upload
   `.output/arca-<version>-chrome.zip` (for example `arca-1.1.0-chrome.zip`).
2. Fill in the fields below. In **Privacy practices**, tick **none** of the data types
   and confirm the three disclosure statements.
3. Each new version: bump `version` in `package.json` (store versions must go up),
   rebuild, zip, and upload under **Package → Upload new package**.

## URLs

- **Store listing:** https://chromewebstore.google.com/detail/arca/idpebnbnhmlmlkmjpkhabhljnkbpindo
- **Homepage:** https://github.com/ateebasif/arca
- **Support:** https://github.com/ateebasif/arca/issues
- **Privacy policy:** https://github.com/ateebasif/arca/blob/main/PRIVACY.md

## Fields

**Name:** Arca

**Summary (max 132 characters):**
Your bookmarks as a fast, visual dashboard. Search, tags, notes and tidy-up tools, with optional local AI. Private by design.

**Category:** Productivity (if the dashboard asks for a sub-category, pick the one
closest to "Tools")

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

Open source under the MIT license. Like it? Support Arca at patreon.com/AteebAsif.

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

**Data usage:** Arca does not collect or transmit user data. The Support Arca links only
open Patreon in a new tab when clicked; nothing is sent automatically.

## Assets

| Asset             | Size     | File                                 |
| ----------------- | -------- | ------------------------------------ |
| Icon              | 128×128  | `public/icon/128.png`                |
| Screenshots (1–5) | 1280×800 | `docs/store/screenshot-*.png`        |
| Small promo tile  | 440×280  | `docs/store/promo-small-440x280.png` |
