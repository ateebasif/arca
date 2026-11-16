import { act, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { Dashboard } from '@/src/components/Dashboard';
import { parseSaved, resetSavedSearchesForTests } from '@/src/store/savedSearches';
import { useUi } from '@/src/store/ui';
import { renderWithBookmarks } from '../helpers/render';

beforeEach(() => resetSavedSearchesForTests());

describe('saved searches', () => {
  it('drops malformed stored entries', () => {
    expect(
      parseSaved([
        { id: 'a1', name: 'Docs', query: 'docs', filters: { note: true, tag: 5 } },
        { id: 'bad id!', query: 'x' },
        { id: 'b2', query: '   ' },
        'junk',
      ]),
    ).toEqual([
      {
        id: 'a1',
        name: 'Docs',
        query: 'docs',
        filters: { tag: null, note: true, duplicates: false, broken: false },
      },
    ]);
  });

  it('saves a search with its filters and runs it again from the sidebar', async () => {
    await fakeBrowser.storage.local.set({
      savedSearches: [{ id: 'old1', name: 'older', query: 'older', filters: {} }],
    });
    await renderWithBookmarks(<Dashboard surface="dashboard" />, {
      bar: [{ title: 'React docs', url: 'https://react.dev/' }],
    });
    act(() => useUi.getState().setQuery('docs'));
    const filters = await screen.findByRole('group', { name: 'Search filters' });
    await userEvent.click(within(filters).getByRole('button', { name: 'Duplicates' }));
    await userEvent.click(within(filters).getByRole('button', { name: 'Save search' }));
    expect(within(filters).getByRole('button', { name: 'Saved ✓' })).toBeDisabled();

    act(() => useUi.getState().setQuery(''));
    const list = await screen.findByRole('region', { name: 'Saved searches' });
    // Newest first; the earlier saved search is kept.
    expect(
      within(list)
        .getAllByRole('button', { pressed: false })
        .map((b) => b.textContent),
    ).toEqual(['docs', 'older']);
    await userEvent.click(within(list).getByRole('button', { name: 'docs' }));
    expect(useUi.getState().query).toBe('docs');
    expect(useUi.getState().filters.duplicates).toBe(true);

    await userEvent.click(
      within(list).getByRole('button', { name: 'Forget saved search older' }),
    );
    expect(
      (await fakeBrowser.storage.local.get('savedSearches')).savedSearches,
    ).toHaveLength(1);
  });
});
