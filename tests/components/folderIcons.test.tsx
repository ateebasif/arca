import { act, fireEvent, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { Dashboard } from '@/src/components/Dashboard';
import { isEmoji, parseIcons, resetFolderIconsForTests } from '@/src/store/folderIcons';
import { useUi } from '@/src/store/ui';
import { renderWithBookmarks } from '../helpers/render';

beforeEach(() => resetFolderIconsForTests());

describe('folder icons', () => {
  it('accepts exactly one emoji and nothing else', () => {
    for (const ok of ['📁', '❤️', '👩🏽‍💻', '🇵🇰']) expect(isEmoji(ok)).toBe(true);
    for (const bad of ['', 'a', '📁📁', '<b>', '📁x', 7])
      expect(isEmoji(bad)).toBe(false);
    expect([...parseIcons({ '12': '🎨', 'bad id!': '🎨', '13': 'text' })]).toEqual([
      ['12', '🎨'],
    ]);
  });

  it('sets an icon from the folder menu, shows it, and removes it', async () => {
    const { fake } = await renderWithBookmarks(<Dashboard surface="dashboard" />, {
      bar: [
        { title: 'Design', children: [{ title: 'Figma', url: 'https://figma.com/' }] },
      ],
    });
    const id = fake.findByTitle('Design')!.id;
    act(() => useUi.getState().openFolder('1'));
    const card = await screen.findByRole('button', { name: /^Design,/ });
    fireEvent.contextMenu(card);
    await userEvent.click(await screen.findByRole('menuitem', { name: 'Icon…' }));
    const dialog = await screen.findByRole('dialog', { name: 'Icon for “Design”' });
    await userEvent.click(within(dialog).getByRole('button', { name: 'Use 🎨' }));
    await vi.waitFor(() =>
      expect(
        document.querySelectorAll('[data-folder-emoji]').length,
      ).toBeGreaterThanOrEqual(2),
    );
    expect((await fakeBrowser.storage.local.get('folderIcons')).folderIcons).toEqual({
      [id]: '🎨',
    });
    // Remove it again.
    fireEvent.contextMenu(screen.getByRole('button', { name: /^Design,/ }));
    await userEvent.click(await screen.findByRole('menuitem', { name: 'Icon…' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Remove icon' }));
    await vi.waitFor(() =>
      expect(document.querySelector('[data-folder-emoji]')).toBeNull(),
    );
  });
});
