import { act, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import * as bm from '@/src/lib/bookmarks';
import { Dashboard } from '@/src/components/Dashboard';
import { BookmarkStore } from '@/src/store/bookmarkStore';
import { linksWithin } from '@/src/store/selectors';
import { parsePrefs, useUi } from '@/src/store/ui';
import { installFakeBookmarks } from '../fakes/bookmarks';
import { renderWithBookmarks, SAMPLE_SEED } from '../helpers/render';

describe('linksWithin', () => {
  it('flattens every bookmark under a folder with its relative folder path', async () => {
    installFakeBookmarks(SAMPLE_SEED);
    const store = new BookmarkStore();
    await store.start();
    const state = store.getSnapshot();
    const links = linksWithin(state, '1');
    expect(links.map((l) => [l.node.title, l.folderLabel])).toEqual([
      ['GitHub', ''],
      ['MDN', 'Dev'],
      ['Deep', 'Dev / Nested'],
      ['News', ''],
    ]);
    expect(linksWithin(state, '1')).toBe(links); // cached per snapshot
    const dev = links[1]!.folderId;
    expect(linksWithin(state, dev).map((l) => l.folderLabel)).toEqual(['', 'Nested']);
  });
});

describe('All links view', () => {
  const tiles = () =>
    within(screen.getByRole('region', { name: 'All links' }))
      .getAllByRole('link')
      .map((a) => a.querySelector('.line-clamp-2')?.textContent ?? a.textContent);

  it('shows every link under the folder, labelled with its folder', async () => {
    await renderWithBookmarks(<Dashboard surface="dashboard" />, SAMPLE_SEED);
    await userEvent.click(screen.getByRole('radio', { name: 'All links' }));
    expect(useUi.getState().scope).toBe('all');
    expect(screen.getByText('4 links across 3 folders')).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Folders' })).toBeNull();
    const text = within(screen.getByRole('region', { name: 'All links' }))
      .getAllByRole('link')
      .map((a) => a.textContent)
      .join(' | ');
    expect(text).toContain('Deep');
    expect(text).toContain('Nested');
    // Tiles show the nearest folder; the full path is in the tooltip.
    expect(
      screen
        .getByRole('region', { name: 'All links' })
        .querySelector('[title="Dev / Nested"]'),
    ).not.toBeNull();
    expect(text).toContain('MDN');
  });

  it('sorts across subfolders and updates live', async () => {
    await renderWithBookmarks(<Dashboard surface="dashboard" />, SAMPLE_SEED);
    act(() => {
      useUi.getState().setScope('all');
      useUi.getState().setSort('title');
    });
    expect(tiles().map((t) => t?.split(/[^A-Za-z]/)[0])).toEqual([
      'Deep',
      'GitHub',
      'MDN',
      'News',
    ]);
    await act(() =>
      bm.create({ parentId: '1', title: 'Arca', url: 'https://arca.dev/' }),
    );
    expect(tiles()[0]).toContain('Arca');
  });

  it('works in list view with folder paths', async () => {
    await renderWithBookmarks(<Dashboard surface="dashboard" />, SAMPLE_SEED);
    act(() => {
      useUi.getState().setScope('all');
      useUi.getState().setView('list');
    });
    const table = screen.getByRole('table', { name: 'All links' });
    expect(table).toHaveTextContent('Dev / Nested');
  });

  it('remembers the choice and validates it', () => {
    expect(parsePrefs({ scope: 'all' }).scope).toBe('all');
    expect(parsePrefs({ scope: 'everything' }).scope).toBe('folders');
  });
});
