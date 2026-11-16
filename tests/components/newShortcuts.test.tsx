import { act, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Dashboard } from '@/src/components/Dashboard';
import { useOverlays } from '@/src/store/overlays';
import { useUi } from '@/src/store/ui';
import { renderWithBookmarks } from '../helpers/render';

describe('N / ⇧N shortcuts', () => {
  it('N adds a bookmark and ⇧N a folder in the open folder; not while typing', async () => {
    const { fake } = await renderWithBookmarks(<Dashboard surface="dashboard" />, {
      bar: [{ title: 'Work', children: [] }],
    });
    const work = fake.findByTitle('Work')!.id;
    act(() => useUi.getState().openFolder(work));

    await userEvent.keyboard('n');
    expect(await screen.findByRole('dialog', { name: 'New bookmark' })).toBeVisible();
    expect(useOverlays.getState().editor).toMatchObject({
      mode: 'create',
      kind: 'bookmark',
      parentId: work,
    });
    await userEvent.keyboard('{Escape}');

    await userEvent.keyboard('{Shift>}N{/Shift}');
    expect(await screen.findByRole('dialog', { name: 'New folder' })).toBeVisible();
    await userEvent.keyboard('{Escape}');

    // Typing an "n" in search doesn't open anything.
    await userEvent.click(screen.getByRole('combobox', { name: 'Search bookmarks' }));
    await userEvent.keyboard('n');
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(useUi.getState().query).toBe('n');
  });

  it('from Home, new items go to the Bookmarks bar', async () => {
    await renderWithBookmarks(<Dashboard surface="dashboard" />, { bar: [] });
    act(() => useUi.getState().showHome());
    await userEvent.keyboard('n');
    expect(useOverlays.getState().editor).toMatchObject({ parentId: '1' });
  });
});
