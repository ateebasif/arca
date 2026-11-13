import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'wxt';

// https://wxt.dev/api/config.html
export default defineConfig({
  modules: ['@wxt-dev/module-react'],
  vite: () => ({
    plugins: [tailwindcss()],
  }),
  manifest: {
    name: 'Arca',
    description: 'A fast, visual, fully editable dashboard for your browser bookmarks.',
    permissions: ['bookmarks', 'storage', 'tabs', 'topSites', 'favicon', 'contextMenus'],
    // Requested at runtime only, for the opt-in dead-link checker.
    optional_host_permissions: ['<all_urls>'],
    action: {
      default_title: 'Arca',
    },
    commands: {
      _execute_action: {
        suggested_key: { default: 'Alt+Shift+B' },
        description: 'Open Arca',
      },
    },
  },
});
