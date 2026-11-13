# Changelog

All notable changes to this project are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the project uses
[Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

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
- `bun run e2e`: smoke checks against real Chrome with the built extension.
