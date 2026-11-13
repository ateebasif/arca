import js from '@eslint/js';
import prettier from 'eslint-config-prettier';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['.output', '.wxt', '.e2e', 'dist', 'coverage', 'node_modules'] },
  {
    files: ['**/*.{ts,tsx}'],
    extends: [js.configs.recommended, ...tseslint.configs.strict, prettier],
    languageOptions: {
      ecmaVersion: 'latest',
      globals: { ...globals.browser },
    },
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
      // Destructuring props away ({ role: _role, ...rest }) is intentional.
      '@typescript-eslint/no-unused-vars': ['error', { ignoreRestSiblings: true }],
      // Security: no code from strings, no raw HTML injection, no script URLs.
      'no-eval': 'error',
      'no-implied-eval': 'error',
      'no-new-func': 'error',
      'no-script-url': 'error',
      'no-restricted-syntax': [
        'error',
        {
          selector: "JSXAttribute[name.name='dangerouslySetInnerHTML']",
          message: 'Render text with React instead of injecting HTML.',
        },
        {
          selector:
            'AssignmentExpression[left.property.name=/^(innerHTML|outerHTML|srcdoc)$/]',
          message: 'Never assign HTML strings; build DOM with React.',
        },
        {
          selector: "CallExpression[callee.property.name='insertAdjacentHTML']",
          message: 'Never inject HTML strings.',
        },
        {
          selector:
            "CallExpression[callee.object.name='document'][callee.property.name=/^write(ln)?$/]",
          message: 'document.write is not allowed.',
        },
        {
          selector: "CallExpression[callee.property.name='executeScript']",
          message: 'Arca never injects scripts into pages.',
        },
      ],
      // Components must go through src/lib for chrome.* / browser.* (CLAUDE.md).
      'no-restricted-globals': [
        'error',
        { name: 'chrome', message: 'Call chrome APIs through src/lib wrappers.' },
      ],
    },
  },
  {
    // The wrapper layer, background worker and tests may touch the API directly.
    files: [
      'src/lib/**',
      'entrypoints/background.ts',
      'tests/**',
      'scripts/**',
      '**/*.test.{ts,tsx}',
    ],
    rules: { 'no-restricted-globals': 'off' },
  },
  {
    // dnd-kit hands out callback refs (setNodeRef) that react-hooks/refs
    // mistakes for ref objects read during render. That rule only matters for
    // the React Compiler, which Arca doesn't use.
    files: [
      'src/components/main/BookmarkTile.tsx',
      'src/components/main/FolderCard.tsx',
      'src/components/main/BookmarkList.tsx',
      'src/components/main/Breadcrumbs.tsx',
      'src/components/sidebar/FolderTree.tsx',
    ],
    rules: { 'react-hooks/refs': 'off' },
  },
  {
    // Test code and fakes may assert shapes they just built, and security
    // tests deliberately contain javascript: URLs as attack inputs.
    files: ['tests/**', 'scripts/**', '**/*.test.{ts,tsx}'],
    rules: { '@typescript-eslint/no-non-null-assertion': 'off', 'no-script-url': 'off' },
  },
);
