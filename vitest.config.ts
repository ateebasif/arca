import { defineConfig } from 'vitest/config';
import { WxtVitest } from 'wxt/testing/vitest-plugin';

// WxtVitest wires up WXT's aliases, auto-imports and an in-memory fake
// `browser`/`chrome` API (@webext-core/fake-browser) for tests.
export default defineConfig({
  plugins: [WxtVitest()],
  define: { __ARCA_NO_NEWTAB__: 'false' },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./tests/setup.ts'],
    include: ['tests/**/*.test.{ts,tsx}', 'src/**/*.test.{ts,tsx}'],
    restoreMocks: true,
  },
});
