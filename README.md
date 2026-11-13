# Arca

A bookmark dashboard extension for Ardia and other Chromium browsers. Arca turns your
real browser bookmarks into a fast, visual, fully editable dashboard on your New Tab,
with search, drag & drop, tags, notes and cleanup tools. All data stays local.

> _Arca_ (Latin): a chest where valuables were kept.

**Status:** early development (Phase 1). See [BACKLOG.md](BACKLOG.md).

## Development

Requires [bun](https://bun.sh) and Node 20+.

```bash
bun install        # also runs `wxt prepare`
bun run dev        # dev build with HMR, opens a Chromium window
bun run build      # production build in .output/chrome-mv3
bun run zip        # packaged zip for distribution
bun run test       # Vitest
bun run lint       # ESLint
bun run typecheck  # tsc
```

### Load unpacked (Chrome)

1. `bun run build`
2. Open `chrome://extensions`, turn on **Developer mode**.
3. Click **Load unpacked** and pick `.output/chrome-mv3`.

Steps for Ardia are pending verification (ARC-018).

## Docs

- Product spec: [arca-prd.md](arca-prd.md)
- Git conventions: [docs/git/](docs/git/)
