import { act, fireEvent, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { Dashboard } from '@/src/components/Dashboard';
import { MinimalNewTab } from '@/src/components/MinimalNewTab';
import { openUrl } from '@/src/lib/tabs';
import { parseSettings, useSettings } from '@/src/store/settings';
import { renderWithBookmarks, SAMPLE_SEED } from '../helpers/render';

const tile = (title: string) =>
  [...document.querySelectorAll<HTMLElement>('[data-bookmark-id]')].find((el) =>
    el.textContent?.includes(title),
  )!;

describe('open links setting', () => {
  let update: ReturnType<typeof vi.spyOn>;
  let create: ReturnType<typeof vi.spyOn>;
  let createWindow: ReturnType<typeof vi.spyOn>;
  beforeEach(() => {
    update = vi.spyOn(fakeBrowser.tabs, 'update').mockResolvedValue({} as never);
    create = vi.spyOn(fakeBrowser.tabs, 'create').mockResolvedValue({} as never);
    createWindow = vi.spyOn(fakeBrowser.windows, 'create').mockResolvedValue({} as never);
  });

  it('opens a mini window as a toolbar-less popup window', async () => {
    await openUrl('https://a.dev/', 'window');
    expect(createWindow).toHaveBeenCalledWith(
      expect.objectContaining({ url: 'https://a.dev/', type: 'popup', focused: true }),
    );
  });

  it('leaves plain clicks to the browser in "same tab" mode', async () => {
    await renderWithBookmarks(<Dashboard surface="dashboard" />, SAMPLE_SEED);
    const clicked = fireEvent.click(tile('GitHub'));
    expect(clicked).toBe(true); // not prevented: the real link navigates
    expect(create).not.toHaveBeenCalled();
  });

  it.each([
    ['new-tab', () => create, { url: 'https://github.com/', active: true }],
    ['background', () => create, { url: 'https://github.com/', active: false }],
  ] as const)('"%s" mode opens plain clicks there', async (mode, spy, args) => {
    await renderWithBookmarks(<Dashboard surface="dashboard" />, SAMPLE_SEED);
    await act(() => useSettings.getState().update({ openIn: mode }));
    const clicked = fireEvent.click(tile('GitHub'));
    expect(clicked).toBe(false);
    expect(spy()).toHaveBeenCalledWith(args);
  });

  it('"mini window" mode works from tiles, search and the minimal page', async () => {
    await renderWithBookmarks(<Dashboard surface="dashboard" />, SAMPLE_SEED);
    await act(() => useSettings.getState().update({ openIn: 'window' }));
    fireEvent.click(tile('GitHub'));
    await userEvent.type(
      screen.getByRole('combobox', { name: 'Search bookmarks' }),
      'mdn',
    );
    await userEvent.keyboard('{Enter}');
    expect(createWindow).toHaveBeenCalledTimes(2);
    expect(update).not.toHaveBeenCalled();
  });

  it('keeps ⌘-click as a background tab whatever the setting', async () => {
    await renderWithBookmarks(<Dashboard surface="dashboard" />, SAMPLE_SEED);
    await act(() => useSettings.getState().update({ openIn: 'window' }));
    fireEvent.click(tile('GitHub'), { metaKey: true });
    fireEvent.click(tile('GitHub'), { ctrlKey: true });
    expect(createWindow).not.toHaveBeenCalled();
  });

  it('applies to the quick search used by the popup', async () => {
    await renderWithBookmarks(<MinimalNewTab />, SAMPLE_SEED);
    await act(() => useSettings.getState().update({ openIn: 'new-tab' }));
    await userEvent.type(screen.getByRole('combobox'), 'pasta');
    await userEvent.keyboard('{Enter}');
    expect(create).toHaveBeenCalledWith({ url: 'https://pasta.dev/', active: true });
  });

  it('is chosen in Settings and validated on load', async () => {
    await renderWithBookmarks(<Dashboard surface="dashboard" />, SAMPLE_SEED);
    await userEvent.click(screen.getByRole('button', { name: 'Settings' }));
    await userEvent.selectOptions(screen.getByLabelText('Open links in'), 'window');
    expect(useSettings.getState().openIn).toBe('window');
    expect(parseSettings({ openIn: 'everywhere' }).openIn).toBe('current');
  });
});
