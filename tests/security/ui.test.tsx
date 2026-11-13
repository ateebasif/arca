import { fireEvent, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { Dashboard } from '@/src/components/Dashboard';
import { parsePrefs } from '@/src/store/ui';
import { parseSettings, DEFAULT_SETTINGS } from '@/src/store/settings';
import { renderWithBookmarks } from '../helpers/render';

// Bookmarks another extension or an imported file could have planted.
const HOSTILE = {
  bar: [
    { title: 'Evil', url: 'javascript:alert(document.cookie)' },
    { title: 'Smuggled', url: 'data:text/html,<script>alert(1)</script>' },
    { title: 'Settings page', url: 'chrome://settings/' },
    { title: 'Normal', url: 'https://normal.dev/' },
  ],
};

const item = (title: string) =>
  [...document.querySelectorAll<HTMLElement>('[data-bookmark-id]')].find((el) =>
    el.textContent?.includes(title),
  )!;

describe('hostile bookmarks', () => {
  let update: ReturnType<typeof vi.spyOn>;
  let create: ReturnType<typeof vi.spyOn>;
  beforeEach(() => {
    update = vi.spyOn(fakeBrowser.tabs, 'update').mockResolvedValue({} as never);
    create = vi.spyOn(fakeBrowser.tabs, 'create').mockResolvedValue({} as never);
  });

  it('renders javascript:/data: bookmarks without an href and never opens them', async () => {
    await renderWithBookmarks(<Dashboard surface="dashboard" />, HOSTILE);
    for (const title of ['Evil', 'Smuggled']) {
      const el = item(title);
      expect(el).not.toHaveAttribute('href');
      expect(el).toHaveAttribute('data-blocked', 'true');
      expect(el).toHaveTextContent('Blocked link');
      await userEvent.click(el);
      el.focus();
      await userEvent.keyboard('{Enter}');
    }
    expect(update).not.toHaveBeenCalled();
    expect(create).not.toHaveBeenCalled();
    expect(screen.getAllByRole('alert')[0]).toHaveTextContent(
      /doesn't open or save javascript:/,
    );
    expect(document.querySelector('a[href^="javascript"], a[href^="data"]')).toBeNull();
  });

  it('opens browser pages through the tabs API, and web pages as real links', async () => {
    await renderWithBookmarks(<Dashboard surface="dashboard" />, HOSTILE);
    expect(item('Normal')).toHaveAttribute('href', 'https://normal.dev/');
    const settings = item('Settings page');
    expect(settings).not.toHaveAttribute('href');
    await userEvent.click(settings);
    expect(update).toHaveBeenCalledWith({ url: 'chrome://settings/' });
  });

  it('is safe in list view and search too', async () => {
    await renderWithBookmarks(<Dashboard surface="dashboard" />, HOSTILE);
    await userEvent.click(screen.getByRole('radio', { name: 'List' }));
    expect(item('Evil')).not.toHaveAttribute('href');
    await userEvent.click(item('Evil'));

    await userEvent.type(
      screen.getByRole('combobox', { name: 'Search bookmarks' }),
      'evil',
    );
    await userEvent.keyboard('{Enter}');
    await userEvent.keyboard('{Control>}{Enter}{/Control}');
    fireEvent.click(within(screen.getByRole('listbox')).getByRole('option'));
    expect(update).not.toHaveBeenCalled();
    expect(create).not.toHaveBeenCalled();
  });

  it('rejects javascript: URLs typed into the edit dialog', async () => {
    const { fake } = await renderWithBookmarks(
      <Dashboard surface="dashboard" />,
      HOSTILE,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Add' }));
    await userEvent.click(screen.getByRole('menuitem', { name: 'New bookmark' }));
    const dialog = await screen.findByRole('dialog');
    await userEvent.type(within(dialog).getByLabelText('URL'), 'javascript:alert(1)');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Add' }));
    expect(within(dialog).getByRole('alert')).toHaveTextContent('Enter a valid URL');
    expect(fake.size).toBe(2 + 4 + 1);
  });
});

describe('stored data validation', () => {
  it('drops invalid UI prefs', () => {
    const prefs = parsePrefs({
      view: '<img src=x onerror=alert(1)>',
      sidebarWidth: 'wide',
      expanded: ['1', 42, { a: 1 }, 'x'.repeat(100)],
      sortDirection: 'sideways',
      lastFolderId: { __proto__: { polluted: true } },
    });
    expect(prefs).toMatchObject({
      view: 'grid',
      sidebarWidth: 248,
      expanded: ['1'],
      sortDirection: 'asc',
      lastFolderId: '1',
    });
    expect(parsePrefs(null).view).toBe('grid');
    expect(parsePrefs({ sidebarWidth: 1e9 }).sidebarWidth).toBe(420);
  });

  it('drops invalid settings', () => {
    expect(parseSettings({ newTabMode: 'evil', redirectUrl: 5 })).toEqual(
      DEFAULT_SETTINGS,
    );
    expect(parseSettings('nope')).toEqual(DEFAULT_SETTINGS);
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
  });
});
