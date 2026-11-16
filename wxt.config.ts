import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'wxt';

/**
 * Content Security Policy for every extension page and the service worker.
 * - Scripts only from the extension package: no inline, eval or remote code.
 * - No plugins, <base> hijacking, form posts, or framing by other pages.
 * - Images from the package, the _favicon cache, and cached preview data: URLs.
 * - connect-src allows http(s) only for opt-in link previews; those requests
 *   still need the optional host permission the user grants in Settings.
 */
const CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "object-src 'none'",
  "base-uri 'none'",
  "form-action 'none'",
  "frame-ancestors 'none'",
  "frame-src 'none'",
  "img-src 'self' data:",
  "style-src 'self'",
  "font-src 'self'",
  "connect-src 'self' https: http:",
].join('; ');

/**
 * `ARCA_NO_NEWTAB=1` builds a variant that leaves the browser's own New Tab
 * alone: no New Tab override (Arca opens from the toolbar popup and its
 * dashboard page). Output and zip get a "-no-newtab" suffix.
 */
const NO_NEWTAB = process.env.ARCA_NO_NEWTAB === '1';

// https://wxt.dev/api/config.html
export default defineConfig({
  modules: ['@wxt-dev/module-react'],
  ...(NO_NEWTAB
    ? {
        filterEntrypoints: ['background', 'popup', 'dashboard'],
        outDirTemplate: '{{browser}}-mv{{manifestVersion}}-no-newtab',
        zip: {
          artifactTemplate: '{{name}}-{{packageVersion}}-{{browser}}-no-newtab.zip',
        },
      }
    : {}),
  vite: () => ({
    plugins: [tailwindcss()],
    define: { __ARCA_NO_NEWTAB__: JSON.stringify(NO_NEWTAB) },
  }),
  manifest: ({ command }) => ({
    name: 'Arca',
    description: 'A fast, visual, fully editable dashboard for your browser bookmarks.',
    minimum_chrome_version: '116',
    permissions: ['bookmarks', 'storage', 'tabs', 'topSites', 'favicon', 'contextMenus'],
    // Requested at runtime only, for opt-in link previews and the dead-link checker.
    optional_host_permissions: ['<all_urls>'],
    // No other extension or website may message Arca.
    externally_connectable: { ids: [], matches: [] },
    // The dev server needs its own CSP (HMR); production gets the strict one.
    ...(command === 'build' ? { content_security_policy: { extension_pages: CSP } } : {}),
    action: {
      default_title: 'Arca',
    },
    commands: {
      _execute_action: {
        suggested_key: { default: 'Alt+Shift+B' },
        description: 'Open Arca',
      },
      'open-in-main-window': {
        suggested_key: { default: 'Alt+Shift+O' },
        description: 'Move an Arca mini window into your main window',
      },
    },
  }),
});
