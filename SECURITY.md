# Security model

Arca runs with access to your bookmarks and tabs, so it is built to be a closed box:
nothing else can run code through it, and it never runs code from anywhere else.

## What Arca guarantees

| Threat                                                                                                            | Protection                                                                                                                                                                          | Checked by                                          |
| ----------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------- |
| Remote or injected code                                                                                           | Strict CSP: `script-src 'self'`, no inline scripts, no `eval`, no remote imports. All code ships in the package.                                                                    | `bun run security`, ESLint, e2e (no CSP violations) |
| Other extensions messaging Arca                                                                                   | `externally_connectable: { ids: [], matches: [] }`. Arca registers no external message listeners.                                                                                   | `bun run security`, e2e hostile extension           |
| Other extensions reading Arca's pages                                                                             | No `web_accessible_resources`. Fetching Arca's pages from another extension fails.                                                                                                  | `bun run security`, e2e hostile extension           |
| Websites framing Arca (clickjacking)                                                                              | `frame-ancestors 'none'` and no web-accessible resources.                                                                                                                           | e2e hostile website                                 |
| Websites fetching Arca's files                                                                                    | Not web-accessible; requests fail.                                                                                                                                                  | e2e hostile website                                 |
| Malicious bookmark URLs (`javascript:`, `data:`, `vbscript:`, `blob:`…) planted by another extension or an import | Arca never renders them as links and never opens them. They show as "Blocked link". Arca also refuses to save them.                                                                 | unit tests, e2e planted bookmarklet                 |
| HTML injection from bookmark titles or stored data                                                                | All text is rendered by React (escaped). `innerHTML`, `dangerouslySetInnerHTML`, `insertAdjacentHTML` and `document.write` are banned by lint.                                      | ESLint                                              |
| Corrupted or tampered settings in storage                                                                         | Every stored field is type-checked on load; invalid values fall back to defaults.                                                                                                   | unit tests                                          |
| Plugins, `<base>` hijacking, form posts                                                                           | `object-src 'none'`, `base-uri 'none'`, `form-action 'none'`.                                                                                                                       | `bun run security`                                  |
| Silent network access                                                                                             | No host permissions by default. `<all_urls>` is optional and only requested when you turn on a feature that needs it. Every e2e run fails on any request that leaves the extension. | `bun run security`, e2e network audit               |
| Link previews leaking cookies or running site code                                                                | Opt-in; no credentials or referrer; inert HTML parsing; images re-encoded; see below.                                                                                               | unit tests, e2e local test site                     |
| Script injection into websites                                                                                    | Arca has no content scripts and never calls `scripting.executeScript`.                                                                                                              | `bun run security`, ESLint                          |

### Link previews (opt-in)

Off by default. Turning them on shows the browser's permission prompt; turning them off
removes the permission again. When on:

- Only `http(s)` pages are fetched, only on hover/focus, never in bulk or in the background.
  A request still waiting its turn is dropped when its card goes away.
- **No local-network requests on a page's behalf.** A public page can't point its
  preview image at `localhost`, `*.local`, private / loopback / link-local / CGNAT IPv4
  or local IPv6 addresses, and a preview that redirects to one is discarded. Only a
  bookmark that is itself on your network (a NAS, a router page) previews from there.
- Requests send **no cookies, no credentials and no referrer**, with an 8 s timeout. At most
  768 KB of HTML and 3 MB of image data are read.
- HTML is parsed with `DOMParser`, which builds an inert document: scripts, event handlers
  and subresources never run or load. `<base href>` is ignored.
- Only the title, description, site name and image URL are kept. Text is stripped of
  control, zero-width and bidi-override characters and length-capped, then rendered as
  plain text by React.
- Images: raster formats only (no SVG). They are decoded straight to thumbnail size
  (a small file can't expand into a huge bitmap) and re-encoded to a small WebP
  thumbnail, so only plain pixels are stored and shown, as `data:` URLs (no request
  to the site when the card is displayed).
- The cache (IndexedDB, private to Arca) is re-validated on read. Tampered entries are
  dropped.
- Each page is fetched at most once a week (failures once a day). You can clear the
  cache in Settings.

### Local AI (opt-in)

Off by default. Turning it on asks for permission to reach the Ollama address only
(`http://localhost:11434/*` by default).

- The Ollama URL must be a loopback host (`localhost`, `127.0.0.1`, `[::1]`) with no
  credentials; anything else is rejected before a request is made, including values
  tampered into storage.
- Requests send no cookies or referrer, never follow redirects (something else on the
  port can't bounce bookmark titles elsewhere), have timeouts, and can be cancelled:
  Stop/Cancel aborts the request so Ollama stops working. Replies are capped at 64 MB
  and shape-checked.
- Only bookmark titles, sites and folder names are sent, and only to that local server.
- The model never chooses which bookmarks move; local k-means clustering does. Its
  folder-name replies are treated as untrusted: control, zero-width, bidi and path
  characters are stripped, length is capped, and the bookmark text is marked as data in
  the prompt. Every suggestion is shown for review, and one Undo reverses the move.
- Your own organize instructions (folder-name and tag rules) are the only text
  treated as instructions; they're stripped of control/bidi characters and capped
  at 600 characters. Suggested tags are cleaned like any tag (max 3 per folder).
- Ask Arca: the chat model only sees a short list of candidate bookmarks (title,
  site, folder, date) and can only answer with their numbers; numbers outside the
  list are dropped, so every result shown is a real bookmark, opened through the
  same safe-link rules as everywhere else. Its reply is cleaned like folder names
  and rendered as plain text. The conversation is kept in memory and in that tab's sessionStorage (so Back
  restores it), validated on read, and dropped when the tab closes.
- List descriptions are written from the title and address only (nothing is
  fetched for them), cleaned like other model text, and cached in IndexedDB.
- Bookmark embeddings are cached in IndexedDB (private to Arca) and can be cleared in
  Settings. What you type (search text, Ask questions) is embedded in memory only and
  never written to disk. Turning AI off frees the in-memory vectors (capped at 96 MB)
  and stops any background reading.

### Mini windows

- Arca remembers the ids of the windows it opened as mini windows and only ever
  acts on those; other popups are never touched. The ids live in session storage,
  which the browser clears on quit (window ids restart after a relaunch), and before
  acting Arca checks the window is still a one-tab popup, so a normal window that
  reused an old id is never moved or closed.
- "Open in main window" re-checks the page's URL with the same rules as any link
  before reopening it as a tab. The right-click item is only shown while an Arca
  mini window is focused. No content scripts or host permissions are involved.

### Tags

- Edits from several Arca pages at once merge per item (each write re-reads storage
  and changes only its own items), and bulk tagging is one write.
- Stored in `chrome.storage.local` under `meta`, validated on every read: ids must
  look like bookmark ids, tags are lowercased, stripped of control/zero-width/bidi
  characters, capped at 32 characters and 20 per item. Rendered as plain text.

### Broken-link check (opt-in)

- Uses the same optional site permission as link previews; asked for when you
  start a check, never runs on its own.
- HEAD (GET only if refused) with no cookies, no credentials, no referrer and an
  8 s timeout; the response body is cancelled unread. Only the status code and
  final address are kept, in IndexedDB, for two weeks; older results are deleted
  at the next check, and "Forget results" deletes them all at once. A check refuses
  to run if site access was removed (otherwise everything would look broken).
- At most 6 requests at once and 2 per site.

- Tag colours (`tagColors`) are validated the same way: known tags only, slots 0–7.

### Right-click "Add to Arca…"

- Uses the `contextMenus` permission Arca already has; menu items only appear on
  http(s) pages and links. Arca reads just the clicked page's or link's address and
  title (no content scripts, no page access), keeps it for at most two minutes
  in local storage, validates it again when the popup reads it, and never opens
  or saves non-web URLs.

### How links open

- **Web URLs** (`http`, `https`, `ftp`) are real links.
- **Browser pages** (`chrome://`, `file://`, `about:`…) open through the tabs API.
- **Everything else is blocked.** The scheme is checked with the browser's own URL parser,
  so tricks like `JaVaScRiPt:`, leading spaces or embedded tabs are caught.

## Running the checks

```bash
bun run lint       # includes the security lint rules
bun run test       # tests/security/* cover URL handling and stored data
bun run build
bun run security   # static checks on the built manifest, HTML and JS
bun run e2e        # real-Chrome attacks: hostile extension, hostile website, planted bookmarklet
```

All five must pass before a merge (see CLAUDE.md).

## Known, accepted issues

- **HTML export keeps bookmarklets.** `javascript:` bookmarks are written to the
  Netscape HTML export as they are (escaped), because browsers import them that way
  and dropping them would lose data. Clicking one in the exported file runs it on a
  `file://` page, as it would in the browser. Arca itself never opens them.
- **Site access stays after a link check.** The optional `<all_urls>` permission is
  shared with link previews; Arca doesn't remove it when a check ends. Turning link
  previews off in Settings removes it.
- **Preview redirects to a local address.** The redirect is followed by the browser
  before Arca can see it (extensions can't read `Location` headers), so the request
  is sent, without cookies; Arca then drops the response and shows nothing from it.

- `bun audit` reports `minimatch` (moderate, ReDoS) and `deepmerge` (low) in dev tooling
  (`eslint`, `typescript-eslint`, `web-ext`). They only process this repo's own files at
  build time and are not shipped in the extension. Re-check when those tools update.

## Reporting

This is a personal project. If you find a problem, open an issue or contact the
maintainer directly rather than posting details publicly.
