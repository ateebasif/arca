import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { fakeBrowser } from 'wxt/testing/fake-browser';

// jsdom doesn't implement scrolling.
Element.prototype.scrollIntoView = () => {};

afterEach(() => {
  cleanup();
  fakeBrowser.reset();
});
