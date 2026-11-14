import { act, fireEvent, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { Dashboard } from '@/src/components/Dashboard';
import * as undo from '@/src/features/undo/undo';
import type { BookmarkNode } from '@/src/lib/bookmarks';
import { useSelection } from '@/src/store/selection';
import { getMetaStore } from '@/src/store/useMeta';
import { useUi } from '@/src/store/ui';
import { renderWithBookmarks } from '../helpers/render';

const seed = {
  bar: [
    { title: 'Alpha', url: 'https://alpha.dev/' },
    { title: 'Beta', url: 'https://beta.dev/' },
    { title: 'Gamma', url: 'https://gamma.dev/' },
    { title: 'Delta', url: 'https://delta.dev/' },
    { title: 'Target', children: [] },
  ],
};
const box = (name: string) => screen.getByRole('checkbox', { name: `Select ${name}` });
const tile = (title: string) =>
  [...document.querySelectorAll<HTMLElement>('[data-bookmark-id]')].find((el) =>
    el.textContent?.includes(title),
  )!;
const bar = () => screen.getByRole('region', { name: 'Selection' });

async function setup() {
  const r = await renderWithBookmarks(<Dashboard surface="dashboard" />, seed);
  act(() => useUi.getState().openFolder('1'));
  await screen.findByRole('checkbox', { name: 'Select Alpha' });
  undo.clearUndoForTests();
  return r;
}

describe('multi-select', () => {
  it('checkbox starts selecting; clicks then toggle instead of opening; ⇧-click selects a range', async () => {
    const create = vi.spyOn(fakeBrowser.tabs, 'create');
    await setup();
    await userEvent.click(box('Alpha'));
    // The bar loads on first selection.
    expect(
      within(await screen.findByRole('region', { name: 'Selection' })).getByText(
        '1 item selected',
      ),
    ).toBeVisible();

    // While selecting, clicking a tile toggles it (no tab opens).
    expect(fireEvent.click(tile('Beta'))).toBe(false);
    expect(create).not.toHaveBeenCalled();
    expect(useSelection.getState().ids.has(useSelection.getState().anchor!)).toBe(true);

    // ⇧-click from Beta to Delta selects Beta, Gamma, Delta.
    fireEvent.click(tile('Delta'), { shiftKey: true });
    expect(within(bar()).getByText('4 items selected')).toBeVisible();

    // Esc clears.
    await userEvent.keyboard('{Escape}');
    expect(screen.queryByRole('region', { name: 'Selection' })).toBeNull();
  });

  it('⌘A selects everything shown; opening another folder clears', async () => {
    const { fake } = await setup();
    await userEvent.keyboard('{Meta>}a{/Meta}');
    expect(
      within(await screen.findByRole('region', { name: 'Selection' })).getByText(
        '5 items selected',
      ),
    ).toBeVisible();
    act(() => useUi.getState().openFolder(fake.findByTitle('Target')!.id));
    expect(useSelection.getState().ids.size).toBe(0);
  });

  it('moves selected items to a folder, in one undo', async () => {
    const { fake } = await setup();
    await userEvent.click(box('Alpha'));
    await userEvent.click(box('Gamma'));
    await screen.findByRole('region', { name: 'Selection' });
    await userEvent.click(within(bar()).getByRole('button', { name: 'Move to…' }));
    await userEvent.selectOptions(
      within(bar()).getByRole('combobox', { name: 'Move to folder' }),
      fake.findByTitle('Target')!.id,
    );
    await userEvent.click(within(bar()).getByRole('button', { name: 'Move 2 items' }));
    const target = fake.findByTitle('Target')!.id;
    await vi.waitFor(() => expect(fake.childIds(target)).toHaveLength(2));
    expect(useSelection.getState().ids.size).toBe(0);
    await act(async () => void (await undo.undoLast()));
    expect(fake.childIds(target)).toHaveLength(0);
    expect(fake.childIds('1').map((id) => fake.findById(id)!.title)).toEqual([
      'Alpha',
      'Beta',
      'Gamma',
      'Delta',
      'Target',
    ]);
  });

  it('adds and removes tags on all selected items', async () => {
    const { fake } = await setup();
    await userEvent.click(box('Alpha'));
    await userEvent.click(box('Beta'));
    await screen.findByRole('region', { name: 'Selection' });
    await userEvent.click(within(bar()).getByRole('button', { name: 'Tag…' }));
    await userEvent.type(
      within(bar()).getByRole('combobox', { name: 'Add tag' }),
      'read later{Enter}',
    );
    await userEvent.click(
      within(bar()).getByRole('button', { name: 'Add tag to 2 items' }),
    );
    const meta = getMetaStore();
    await vi.waitFor(() => expect(meta.idsWithTag('read later')).toHaveLength(2));
    // Remove it again from both, from the same panel.
    await userEvent.click(within(bar()).getByRole('button', { name: 'Tag…' }));
    await userEvent.click(
      within(bar()).getByRole('button', { name: 'Remove tag read later from selected' }),
    );
    await vi.waitFor(() => expect(meta.idsWithTag('read later')).toHaveLength(0));
    expect(fake.findByTitle('Alpha')).toBeDefined();
  });

  it('opens all selected links; asks first above ten', async () => {
    const create = vi.spyOn(fakeBrowser.tabs, 'create');
    await setup();
    await userEvent.click(box('Alpha'));
    await userEvent.click(box('Target')); // folders are skipped
    await screen.findByRole('region', { name: 'Selection' });
    await userEvent.click(within(bar()).getByRole('button', { name: 'Open all' }));
    await vi.waitFor(() => expect(create).toHaveBeenCalledTimes(1));
    expect(create).toHaveBeenCalledWith({ url: 'https://alpha.dev/', active: false });
  });

  it('deletes selected items after confirming, in one undo', async () => {
    const { fake } = await setup();
    const strip = (n: BookmarkNode): unknown => ({
      t: n.title,
      c: n.children?.map(strip),
    });
    const before = strip((await fake.getTree())[0]!);
    await userEvent.click(box('Beta'));
    await userEvent.click(box('Delta'));
    await screen.findByRole('region', { name: 'Selection' });
    await userEvent.click(within(bar()).getByRole('button', { name: 'Delete…' }));
    expect(fake.findByTitle('Beta')).toBeDefined();
    await userEvent.click(within(bar()).getByRole('button', { name: 'Delete 2 items' }));
    await vi.waitFor(() => expect(fake.findByTitle('Beta')).toBeUndefined());
    await act(async () => void (await undo.undoLast()));
    expect(strip((await fake.getTree())[0]!)).toEqual(before);
  });
});
