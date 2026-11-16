import { act, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { Dashboard } from '@/src/components/Dashboard';
import * as undo from '@/src/features/undo/undo';
import { useUi } from '@/src/store/ui';
import { renderWithBookmarks } from '../helpers/render';

describe('Open tabs panel', () => {
  beforeEach(() => undo.clearUndoForTests());

  it('lists web tabs, marks saved ones, bookmarks into the open folder', async () => {
    vi.spyOn(fakeBrowser.tabs, 'query').mockResolvedValue([
      { id: 11, windowId: 1, url: 'https://react.dev/', title: 'React' },
      { id: 12, windowId: 1, url: 'https://news.dev/today', title: 'Today’s news' },
      { id: 13, windowId: 1, url: 'chrome://settings/', title: 'Settings' },
    ] as never);

    const { fake } = await renderWithBookmarks(<Dashboard surface="dashboard" />, {
      bar: [
        { title: 'React docs', url: 'https://react.dev' },
        { title: 'Reading', children: [] },
      ],
    });
    await userEvent.click(screen.getByRole('button', { name: 'Open tabs' }));
    const panel = await screen.findByRole('complementary', { name: 'Open tabs' });
    const rows = await within(panel).findAllByRole('listitem');
    // Browser pages (chrome://) aren't listed.
    expect(rows.map((r) => r.textContent)).toEqual([
      expect.stringContaining('React'),
      expect.stringContaining('Today’s news'),
    ]);
    expect(within(rows[0]!).getByRole('button', { name: 'Saved' })).toBeVisible();

    act(() => useUi.getState().openFolder(fake.findByTitle('Reading')!.id));
    await userEvent.click(
      within(panel).getByRole('button', { name: 'Bookmark Today’s news' }),
    );
    await vi.waitFor(() =>
      expect(fake.findByTitle('Today’s news')?.parentId).toBe(
        fake.findByTitle('Reading')!.id,
      ),
    );
    expect(await within(panel).findAllByRole('button', { name: 'Saved' })).toHaveLength(
      2,
    );

    expect(await undo.undoLast()).toBe(true);
    expect(fake.findByTitle('Today’s news')).toBeUndefined();
    // The panel stays open across reloads (remembered preference).
    expect(useUi.getState().tabsPanel).toBe(true);
  });
});
