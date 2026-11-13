import js from '@eslint/js';
import prettier from 'eslint-config-prettier';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['.output', '.wxt', 'dist', 'coverage', 'node_modules'] },
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
      // Components must go through src/lib for chrome.* / browser.* (CLAUDE.md).
      'no-restricted-globals': [
        'error',
        { name: 'chrome', message: 'Call chrome APIs through src/lib wrappers.' },
      ],
    },
  },
  {
    // The wrapper layer, background worker and tests may touch the API directly.
    files: ['src/lib/**', 'entrypoints/background.ts', 'tests/**', '**/*.test.{ts,tsx}'],
    rules: { 'no-restricted-globals': 'off' },
  },
  {
    // Test code and fakes may assert shapes they just built.
    files: ['tests/**', '**/*.test.{ts,tsx}'],
    rules: { '@typescript-eslint/no-non-null-assertion': 'off' },
  },
);
