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
| Script injection into websites                                                                                    | Arca has no content scripts and never calls `scripting.executeScript`.                                                                                                              | `bun run security`, ESLint                          |

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
