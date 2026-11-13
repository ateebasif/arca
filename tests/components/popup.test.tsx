import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { Popup } from '@/src/components/Popup';
import { useSettings } from '@/src/store/settings';
import { renderWithBookmarks, SAMPLE_SEED } from '../helpers/render';

function activeTab(url: string, title = 'Some page') {
  vi.spyOn(fakeBrowser.tabs, 'query').mockResolvedValue([
    { id: 1, url, title, active: true },
  ] as never);
}

describe('popup', () => {
  beforeEach(() => {
    vi.spyOn(window, 'close').mockImplementation(() => {});
  });

  it('searches and opens a bookmark, then closes', async () => {
    activeTab('https://example.com/');
    const update = vi.spyOn(fakeBrowser.tabs, 'update').mockResolvedValue({} as never);
    await renderWithBookmarks(<Popup />, SAMPLE_SEED);
    await userEvent.type(screen.getByRole('combobox'), 'mdn');
    await userEvent.keyboard('{Enter}');
    expect(update).toHaveBeenCalledWith({ url: 'https://developer.mozilla.org/' });
    expect(window.close).toHaveBeenCalled();
  });

  it('caps results at 8', async () => {
    activeTab('https://example.com/');
    await renderWithBookmarks(<Popup />, {
      bar: Array.from({ length: 20 }, (_, i) => ({
        title: `Doc ${i}`,
        url: `https://d${i}.dev/`,
      })),
    });
    await userEvent.type(screen.getByRole('combobox'), 'doc');
    expect(within(screen.getByRole('listbox')).getAllByRole('option')).toHaveLength(8);
  });

  it('bookmarks the current tab into the chosen folder and remembers it', async () => {
    activeTab('https://new.dev/page', 'New page');
    const { fake } = await renderWithBookmarks(<Popup />, SAMPLE_SEED);
    const section = await screen.findByRole('region', { name: 'Current tab' });
    const recipes = fake.findByTitle('Recipes')!.id;
    await userEvent.selectOptions(
      within(section).getByLabelText('Save to folder'),
      recipes,
    );
    await userEvent.click(
      within(section).getByRole('button', { name: 'Bookmark this tab' }),
    );
    expect(fake.findByTitle('New page')).toMatchObject({
      parentId: recipes,
      url: 'https://new.dev/page',
    });
    expect(useSettings.getState().saveFolderId).toBe(recipes);
    expect(await within(section).findByRole('status')).toHaveTextContent(
      'Saved in Other bookmarks / Recipes',
    );
  });

  it('marks an already-bookmarked tab and can remove it', async () => {
    activeTab('https://github.com/', 'GitHub');
    const { fake } = await renderWithBookmarks(<Popup />, SAMPLE_SEED);
    const section = await screen.findByRole('region', { name: 'Current tab' });
    expect(within(section).getByRole('status')).toHaveTextContent(
      'Saved in Bookmarks bar',
    );
    await userEvent.click(within(section).getByRole('button', { name: 'Remove' }));
    await waitFor(() => expect(fake.findByTitle('GitHub')).toBeUndefined());
    expect(
      within(section).getByRole('button', { name: 'Bookmark this tab' }),
    ).toBeInTheDocument();
  });

  it("explains when a page can't be bookmarked", async () => {
    activeTab('chrome://settings/');
    await renderWithBookmarks(<Popup />, SAMPLE_SEED);
    expect(
      await screen.findByText("This page can't be bookmarked from Arca."),
    ).toBeInTheDocument();
  });

  it('opens the dashboard in a new tab', async () => {
    activeTab('https://example.com/');
    const create = vi.spyOn(fakeBrowser.tabs, 'create').mockResolvedValue({} as never);
    await renderWithBookmarks(<Popup />, SAMPLE_SEED);
    await userEvent.click(screen.getByRole('button', { name: /Open dashboard/ }));
    expect(create).toHaveBeenCalledWith({
      url: expect.stringMatching(/\/dashboard\.html$/),
    });
    await waitFor(() => expect(window.close).toHaveBeenCalled());
  });
});
