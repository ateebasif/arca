import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { Dashboard } from '@/src/components/Dashboard';
import { MinimalNewTab } from '@/src/components/MinimalNewTab';
import { useSettings } from '@/src/store/settings';
import { renderWithBookmarks, SAMPLE_SEED } from '../helpers/render';

describe('settings dialog', () => {
  it('switches New Tab mode and validates the redirect URL', async () => {
    await renderWithBookmarks(<Dashboard surface="dashboard" />, SAMPLE_SEED);
    await userEvent.click(screen.getByRole('button', { name: 'Settings' }));
    const dialog = await screen.findByRole('dialog', { name: 'Settings' });
    await userEvent.click(
      within(dialog).getByRole('radio', { name: /Redirect to a URL/ }),
    );
    await userEvent.type(within(dialog).getByLabelText('Redirect URL'), 'nope');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Save' }));
    expect(within(dialog).getByRole('alert')).toBeInTheDocument();

    await userEvent.clear(within(dialog).getByLabelText('Redirect URL'));
    await userEvent.type(within(dialog).getByLabelText('Redirect URL'), 'example.com');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Save' }));
    expect(useSettings.getState()).toMatchObject({
      newTabMode: 'redirect',
      redirectUrl: 'https://example.com/',
    });
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});

describe('minimal New Tab', () => {
  it('searches bookmarks and opens with Enter', async () => {
    const update = vi.spyOn(fakeBrowser.tabs, 'update').mockResolvedValue({} as never);
    await renderWithBookmarks(<MinimalNewTab />, SAMPLE_SEED);
    const input = screen.getByRole('combobox', { name: 'Search bookmarks' });
    expect(input).toHaveFocus();
    await userEvent.type(input, 'pasta');
    expect(screen.getAllByRole('option')).toHaveLength(1);
    await userEvent.keyboard('{Enter}');
    expect(update).toHaveBeenCalledWith({ url: 'https://pasta.dev/' });
  });

  it('opens a typed URL when nothing matches', async () => {
    const update = vi.spyOn(fakeBrowser.tabs, 'update').mockResolvedValue({} as never);
    await renderWithBookmarks(<MinimalNewTab />, SAMPLE_SEED);
    await userEvent.type(screen.getByRole('combobox'), 'wikipedia.org');
    expect(screen.getByText(/Press Enter to open/)).toHaveTextContent(
      'https://wikipedia.org/',
    );
    await userEvent.keyboard('{Enter}');
    expect(update).toHaveBeenCalledWith({ url: 'https://wikipedia.org/' });
  });
});
