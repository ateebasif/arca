# Arca

A bookmark dashboard extension for Ardia and other Chromium browsers. Arca turns your
real browser bookmarks into a fast, visual, fully editable dashboard on your New Tab,
with search, folders, and quick editing. Every change is a real bookmark change, and all
data stays on your machine.

> _Arca_ (Latin): a chest where valuables were kept.

**Status:** Phase 1 (core) complete, pre-release. See [BACKLOG.md](BACKLOG.md) and
[CHANGELOG.md](CHANGELOG.md).

## What it does (Phase 1)

- **Dashboard on New Tab**: sidebar folder tree with counts, folder cards, bookmark
  tiles (comfortable/compact) or a sortable list, breadcrumbs.
- **Search**: ⌘K or `/`, fuzzy over titles, URLs and folder names. ↑↓ to move, Enter to
  open, ⌘Enter for a new tab, ⌥Enter to show the bookmark in its folder.
- **Editing**: add bookmarks and folders, edit, rename inline (F2), delete. Browser root
  folders (Bookmarks bar, Other bookmarks, Mobile) are read-only.
- **Live sync**: changes made in the browser's own bookmark manager show up instantly,
  and vice versa.
- **Toolbar popup** (⌥⇧B): quick search, "Bookmark this tab", open the dashboard.
- **New Tab modes** (Settings): dashboard, minimal search page, or redirect to a URL.
- **Dark mode**: System / Light / Dark switch in the sidebar footer and Settings.
- **Link previews** (opt-in, Settings): hover a bookmark to see its title, description
  and image. Fetched once without cookies, cached locally for a week.

Private by design: no analytics, no accounts, no remote code, and no network requests
unless you turn on link previews. Favicons come from the browser's own cache via the
`_favicon` endpoint. See [SECURITY.md](SECURITY.md) for the security model.

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

Ardia is Chromium-based (Chromium 157 as of Ardia 0.2.46), so the same steps should apply:
open `chrome://extensions`, enable **Developer mode**, and **Load unpacked**.

> **Not yet verified in Ardia.** Ardia disables DevTools automation, so Arca's automated
> checks run in Chrome only. Please check by hand:
>
> 1. Does `chrome://extensions` offer Developer mode and Load unpacked?
> 2. Does a new tab show Arca, or Ardia's own New Tab / command bar?
> 3. Does the toolbar popup (or ⌥⇧B) open?
>
> If Ardia keeps its own New Tab, use the popup and the dashboard tab (popup → **Open
> dashboard**) as the main entry points. Results go in [BACKLOG.md](BACKLOG.md) (ARC-018).

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
