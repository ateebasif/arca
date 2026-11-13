import { render, type RenderResult } from '@testing-library/react';
import type { ReactElement } from 'react';
import { BookmarkStore } from '@/src/store/bookmarkStore';
import { resetOverlaysForTests } from '@/src/store/overlays';
import { resetSettingsForTests } from '@/src/store/settings';
import { resetUiForTests } from '@/src/store/ui';
import { setBookmarkStoreForTests } from '@/src/store/useBookmarks';
import {
  installFakeBookmarks,
  type FakeBookmarks,
  type FakeBookmarksSeed,
} from '../fakes/bookmarks';

export interface RenderedWithBookmarks extends RenderResult {
  fake: FakeBookmarks;
  store: BookmarkStore;
}

/** Installs fake bookmarks, a fresh store and default UI state, then renders. */
export async function renderWithBookmarks(
  ui: ReactElement,
  seed: FakeBookmarksSeed,
): Promise<RenderedWithBookmarks> {
  const fake = installFakeBookmarks(seed);
  const store = new BookmarkStore();
  setBookmarkStoreForTests(store);
  resetUiForTests();
  resetOverlaysForTests();
  resetSettingsForTests();
  await store.start();
  const result = render(ui);
  return { ...result, fake, store };
}

export const SAMPLE_SEED: FakeBookmarksSeed = {
  bar: [
    { title: 'GitHub', url: 'https://github.com/' },
    {
      title: 'Dev',
      children: [
        { title: 'MDN', url: 'https://developer.mozilla.org/' },
        {
          title: 'Nested',
          children: [{ title: 'Deep', url: 'https://deep.dev/' }],
        },
      ],
    },
    { title: 'News', url: 'https://news.ycombinator.com/' },
  ],
  other: [
    { title: 'Recipes', children: [{ title: 'Pasta', url: 'https://pasta.dev/' }] },
  ],
};
