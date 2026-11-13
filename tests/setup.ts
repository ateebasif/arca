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

// Default: the optional site-access permission is not granted. Tests that need
// it override these spies.
beforeEach(() => {
  const p = fakeBrowser.permissions;
  vi.spyOn(p, 'contains').mockResolvedValue(false as never);
  vi.spyOn(p, 'request').mockResolvedValue(false as never);
  vi.spyOn(p, 'remove').mockResolvedValue(true as never);
  for (const event of [p.onAdded, p.onRemoved]) {
    vi.spyOn(event, 'addListener').mockImplementation(() => {});
    vi.spyOn(event, 'removeListener').mockImplementation(() => {});
  }
});

afterEach(() => {
  cleanup();
  fakeBrowser.reset();
});
