import { act, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Dashboard } from '@/src/components/Dashboard';
import * as undo from '@/src/features/undo/undo';
import { useUi } from '@/src/store/ui';
import { renderWithBookmarks } from '../helpers/render';

describe('header shortcuts', () => {
  beforeEach(() => undo.clearUndoForTests());

  it('renames the open folder by clicking its name; Esc cancels', async () => {
    const { fake } = await renderWithBookmarks(<Dashboard surface="dashboard" />, {
      bar: [{ title: 'Torrents Downloads', children: [] }],
    });
    act(() => useUi.getState().openFolder(fake.findByTitle('Torrents Downloads')!.id));
    await userEvent.click(
      await screen.findByRole('button', { name: 'Rename Torrents Downloads' }),
    );
    const field = screen.getByRole('textbox', { name: 'Name' });
    await userEvent.clear(field);
    await userEvent.type(field, 'Downloads{Enter}');
    await vi.waitFor(() => expect(fake.findByTitle('Downloads')).toBeDefined());
    expect(await undo.undoLast()).toBe(true);
    expect(fake.findByTitle('Torrents Downloads')).toBeDefined();

    // Esc leaves the name alone.
    await userEvent.click(
      await screen.findByRole('button', { name: 'Rename Torrents Downloads' }),
    );
    await userEvent.type(screen.getByRole('textbox', { name: 'Name' }), 'xyz{Escape}');
    expect(screen.queryByRole('textbox', { name: 'Name' })).toBeNull();
    expect(fake.findByTitle('Torrents Downloads')).toBeDefined();
  });

  it("browser folders can't be renamed from the header", async () => {
    await renderWithBookmarks(<Dashboard surface="dashboard" />, { bar: [] });
    act(() => useUi.getState().openFolder('1'));
    expect(await screen.findByRole('heading', { name: 'Bookmarks bar' })).toBeVisible();
    expect(screen.queryByRole('button', { name: /^Rename/ })).toBeNull();
  });

  it('the Arca logo goes to Home', async () => {
    await renderWithBookmarks(<Dashboard surface="dashboard" />, { bar: [] });
    await userEvent.click(screen.getByRole('button', { name: 'Arca: go to Home' }));
    expect(useUi.getState().home).toBe(true);
    expect(await screen.findByRole('heading', { name: 'Home' })).toBeVisible();
  });
});
