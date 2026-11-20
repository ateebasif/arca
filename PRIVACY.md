# Privacy Policy

_Last updated: 16 November 2026_

Arca is a browser extension that shows your browser bookmarks as a dashboard. It is
built to keep everything on your computer.

## What Arca collects

**Nothing.** Arca has no accounts, no analytics, no tracking, no ads and no servers.
The developer never receives any of your data.

## What Arca stores, and where

Everything Arca keeps stays in your browser, on your computer:

- **Your bookmarks** stay in your browser's own bookmarks. Arca reads and edits them
  through the browser; every change is an ordinary bookmark change.
- **Tags, notes, folder icons, saved searches and settings** are stored in the
  extension's local storage.
- **Optional caches** (link preview cards, broken-link check results, AI readings and
  descriptions) are stored in the extension's IndexedDB. You can clear them in
  Settings, and they are removed when you uninstall Arca.

If you use your browser's sync, your browser may sync your bookmarks as it always
does. Arca itself doesn't send them anywhere.

## Network requests

Arca makes no network requests unless you turn on one of these optional features.
Each asks for the browser's permission first, and you can turn it off at any time:

- **Link previews:** when you hover a bookmark, Arca fetches that page once to show a
  preview card. Requests carry no cookies, no login and no referrer.
- **Broken-link check:** when you start a check, Arca asks each bookmarked site for
  its status, without cookies or a referrer, and reads no page content.
- **Local AI:** Arca talks only to [Ollama](https://ollama.com) running on your own
  computer (`localhost`). Bookmark titles and addresses are sent to that local
  program and nowhere else; Arca refuses any address that isn't on your computer.

Favicons are shown from the browser's own favicon cache, not fetched from websites.

## Permissions

| Permission             | Why Arca needs it                                                                   |
| ---------------------- | ----------------------------------------------------------------------------------- |
| Bookmarks              | Show, search and edit your bookmarks.                                               |
| Storage                | Keep tags, notes, settings and caches on your computer.                             |
| Tabs                   | Open links, bookmark the current tab, and show the Open tabs panel.                 |
| Top sites              | Show "Most visited" on Home and in the popup.                                       |
| Favicon                | Show site icons from the browser's cache.                                           |
| Context menus          | The right-click "Add to Arca…" item.                                                |
| Site access (optional) | Only for link previews, the broken-link check and local AI, after you turn them on. |

Settings → Support Arca and the "Support Arca" link in the sidebar link to my Patreon page. Arca
also remembers, on your computer only, the day you first opened it, so it can show a
one-time "Enjoying Arca?" card two weeks later.
Settings → Support Arca has links to my Patreon page. They are ordinary links: nothing
is loaded or sent unless you click one, and then your browser simply opens Patreon.

## Third parties

Arca shares nothing with anyone. It contains no third-party code that collects data.

## Contact

Questions or concerns: open an issue in Arca's GitHub repository.
