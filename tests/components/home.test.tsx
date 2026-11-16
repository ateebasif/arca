import { act, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { Dashboard } from '@/src/components/Dashboard';
import { useSettings } from '@/src/store/settings';
import { useUi } from '@/src/store/ui';
import { renderWithBookmarks } from '../helpers/render';

const links = Array.from({ length: 14 }, (_, i) => ({
  title: `Link ${i + 1}`,
  url: `https://l${i + 1}.dev/`,
}));

describe('Home view', () => {
  beforeEach(() => {
    vi.spyOn(fakeBrowser.topSites, 'get').mockResolvedValue([
      { url: 'https://news.dev/', title: 'News' },
      { url: 'javascript:alert(1)', title: 'Bad' },
    ] as never);
  });

  it('shows the 12 newest bookmarks and most visited sites; sections hide', async () => {
    await renderWithBookmarks(<Dashboard surface="dashboard" />, {
      bar: [{ title: 'Work', children: links }],
    });
    await userEvent.click(screen.getByRole('button', { name: 'Home' }));
    expect(useUi.getState().home).toBe(true);
    const recent = await screen.findByRole('region', { name: 'Recently added' });
    const items = within(recent).getAllByRole('link');
    expect(items).toHaveLength(12);
    // Newest first; the two oldest are left out.
    expect(items[0]).toHaveTextContent('Link 14');
    expect(items[0]).toHaveTextContent('Work');
    expect(within(recent).queryByText('Link 1')).toBeNull();

    const visited = await screen.findByRole('region', { name: 'Most visited' });
    expect(await within(visited).findByText('News')).toBeVisible();
    // Code links from the browser's list are never shown.
    expect(within(visited).queryByText('Bad')).toBeNull();

    await userEvent.click(screen.getByRole('button', { name: 'Hide Most visited' }));
    expect(useSettings.getState().homeMostVisited).toBe(false);
    expect(screen.queryByRole('region', { name: 'Most visited' })).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: 'Hide Recently added' }));
    await userEvent.click(screen.getByRole('button', { name: 'Show them again' }));
    expect(await screen.findByRole('region', { name: 'Recently added' })).toBeVisible();
  });

  it('opening a folder or going back leaves Home', async () => {
    const { fake } = await renderWithBookmarks(<Dashboard surface="dashboard" />, {
      bar: [{ title: 'Work', children: links.slice(0, 2) }],
    });
    act(() => useUi.getState().showHome());
    expect(await screen.findByRole('heading', { name: 'Home' })).toBeVisible();
    act(() => useUi.getState().goBack());
    expect(useUi.getState().home).toBe(false);
    act(() => useUi.getState().showHome());
    act(() => useUi.getState().openFolder(fake.findByTitle('Work')!.id));
    expect(useUi.getState().home).toBe(false);
    expect(screen.queryByRole('heading', { name: 'Home' })).toBeNull();
  });
});
