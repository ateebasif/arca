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
- Requests send **no cookies, no credentials and no referrer**, with an 8 s timeout. At most
  768 KB of HTML and 3 MB of image data are read.
- HTML is parsed with `DOMParser`, which builds an inert document: scripts, event handlers
  and subresources never run or load. `<base href>` is ignored.
- Only the title, description, site name and image URL are kept. Text is stripped of
  control, zero-width and bidi-override characters and length-capped, then rendered as
  plain text by React.
- Images: raster formats only (no SVG). They are decoded and re-encoded to a small WebP
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
- Requests send no cookies or referrer and have timeouts. Responses are shape-checked.
- Only bookmark titles, sites and folder names are sent, and only to that local server.
- The model never chooses which bookmarks move; local k-means clustering does. Its
  folder-name replies are treated as untrusted: control, zero-width, bidi and path
  characters are stripped, length is capped, and the bookmark text is marked as data in
  the prompt. Every suggestion is shown for review, and one Undo reverses the move.
- Ask Arca: the chat model only sees a short list of candidate bookmarks (title,
  site, folder, date) and can only answer with their numbers; numbers outside the
  list are dropped, so every result shown is a real bookmark, opened through the
  same safe-link rules as everywhere else. Its reply is cleaned like folder names
  and rendered as plain text. The conversation is kept in memory only.
- Embeddings are cached in IndexedDB (private to Arca) and can be cleared in Settings.

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

- `bun audit` reports `minimatch` (moderate, ReDoS) and `deepmerge` (low) in dev tooling
  (`eslint`, `typescript-eslint`, `web-ext`). They only process this repo's own files at
  build time and are not shipped in the extension. Re-check when those tools update.

## Reporting

This is a personal project. If you find a problem, open an issue or contact the
maintainer directly rather than posting details publicly.
