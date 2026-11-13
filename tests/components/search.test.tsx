import { act, fireEvent, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { Dashboard } from '@/src/components/Dashboard';
import { useUi } from '@/src/store/ui';
import { renderWithBookmarks, SAMPLE_SEED } from '../helpers/render';

const input = () => screen.getByRole('combobox', { name: 'Search bookmarks' });
const options = () => within(screen.getByRole('listbox')).getAllByRole('option');

describe('search UI', () => {
  it('focuses with mod+K and /, and shows results as you type', async () => {
    await renderWithBookmarks(<Dashboard surface="dashboard" />, SAMPLE_SEED);
    fireEvent.keyDown(window, { key: 'k', ctrlKey: true });
    expect(input()).toHaveFocus();
    input().blur();
    fireEvent.keyDown(document.body, { key: '/' });
    expect(input()).toHaveFocus();
    await userEvent.type(input(), 'md');
    expect(options()[0]).toHaveTextContent('MDN');
    expect(input()).toHaveAttribute('aria-activedescendant', options()[0]!.id);
  });

  it('moves with arrows and opens with Enter / mod+Enter', async () => {
    const update = vi.spyOn(fakeBrowser.tabs, 'update').mockResolvedValue({} as never);
    const create = vi.spyOn(fakeBrowser.tabs, 'create').mockResolvedValue({} as never);
    await renderWithBookmarks(<Dashboard surface="dashboard" />, SAMPLE_SEED);
    await userEvent.type(input(), 'e');
    const second = options()[1]!;
    await userEvent.keyboard('{ArrowDown}');
    expect(second).toHaveAttribute('aria-selected', 'true');

    await userEvent.type(input(), '{Backspace}github');
    await userEvent.keyboard('{Enter}');
    expect(update).toHaveBeenCalledWith({ url: 'https://github.com/' });
    await userEvent.keyboard('{Control>}{Enter}{/Control}');
    expect(create).toHaveBeenCalledWith({ url: 'https://github.com/', active: false });
  });

  it('opens folders and reveals bookmarks in their folder', async () => {
    await renderWithBookmarks(<Dashboard surface="dashboard" />, SAMPLE_SEED);
    await userEvent.type(input(), 'deep');
    await userEvent.keyboard('{Alt>}{Enter}{/Alt}');
    expect(useUi.getState().query).toBe('');
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Nested');
    expect(document.querySelector('[data-bookmark-id]')).toHaveFocus();

    await userEvent.type(input(), 'dev');
    await userEvent.click(options().find((o) => o.textContent?.startsWith('Dev'))!);
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Dev');
  });

  it('filters to the open folder and shows an empty state', async () => {
    await renderWithBookmarks(<Dashboard surface="dashboard" />, SAMPLE_SEED);
    act(() => useUi.getState().openFolder('2'));
    await userEvent.type(input(), 'github');
    expect(options()).toHaveLength(1);
    await userEvent.click(screen.getByRole('button', { name: /In “Other bookmarks”/ }));
    expect(screen.getByText(/No matches for “github”/)).toBeInTheDocument();
    await userEvent.keyboard('{Escape}');
    expect(input()).toHaveValue('');
    expect(screen.queryByRole('listbox')).toBeNull();
  });
});
