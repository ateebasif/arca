import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { fakeBrowser } from 'wxt/testing/fake-browser';

// jsdom doesn't implement scrolling.
Element.prototype.scrollIntoView = () => {};

// jsdom has no layout; a no-op ResizeObserver lets virtualized lists mount.
globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
} as unknown as typeof ResizeObserver;

afterEach(() => {
  cleanup();
  fakeBrowser.reset();
});
