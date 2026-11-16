import { act, fireEvent, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { Dashboard } from '@/src/components/Dashboard';
import { deleteNode } from '@/src/features/editing/actions';
import {
  cleanTag,
  cleanTags,
  MetaStore,
  ORPHAN_GRACE_MS,
  parseMeta,
} from '@/src/features/tags/meta';
import * as undo from '@/src/features/undo/undo';
import { getMetaStore } from '@/src/store/useMeta';
import { useUi } from '@/src/store/ui';
import { renderWithBookmarks } from '../helpers/render';

const seed = {
  bar: [
    { title: 'React docs', url: 'https://react.dev/' },
    { title: 'Ramen', url: 'https://ramen.dev/' },
    {
      title: 'Work',
      children: [{ title: 'Jira', url: 'https://jira.dev/' }],
    },
  ],
  other: [{ title: 'Vue docs', url: 'https://vuejs.org/' }],
};

describe('tag data', () => {
  it('cleans tags like any untrusted input', () => {
    expect(cleanTag('  #Read Later ')).toBe('read later');
    expect(cleanTag('a‮b')).toBe('a b');
    expect(cleanTag('x'.repeat(50))).toHaveLength(32);
    expect(cleanTags(['Dev', 'dev', '', 7, 'ui,ux'])).toEqual(['dev', 'ui ux']);
  });

  it('drops malformed stored metadata', () => {
    const meta = parseMeta({
      '12': { tags: ['Dev', 5], url: 'https://a.dev/' },
      'bad id!': { tags: ['x'] },
      '13': { tags: [] },
      '14': 'junk',
    });
    expect([...meta]).toEqual([['12', { tags: ['dev'], url: 'https://a.dev/' }]]);
    expect(parseMeta(null).size).toBe(0);
  });

  it('re-links tags by URL when ids change; keeps deleted ones a while for undo', async () => {
    const store = new MetaStore();
    await store.start();
    await store.setTags('old1', 'https://a.dev/', ['dev']);
    await store.setTags('gone', 'https://nowhere.dev/', ['x']);
    const nodes = new Map([
      ['new1', 'https://a.dev/'],
      ['f', ''],
    ]);
    await store.relink(nodes, { now: 1000 });
    expect(store.tagsOf('new1')).toEqual(['dev']);
    // Marked gone (not counted), but kept so Undo can restore it.
    expect(store.getSnapshot().byId.get('gone')?.goneAt).toBe(1000);
    expect(store.allTags().map((t) => t.tag)).toEqual(['dev']);
    // A page that can still undo the deletion keeps it past the grace period.
    await store.relink(nodes, { now: 1000 + ORPHAN_GRACE_MS + 1, keepGone: true });
    expect(store.getSnapshot().byId.has('gone')).toBe(true);
    await store.relink(nodes, { now: 1000 + ORPHAN_GRACE_MS + 1 });
    expect(store.getSnapshot().byId.has('gone')).toBe(false);
    // Saved for other pages.
    expect((await fakeBrowser.storage.local.get('meta')).meta).toEqual({
      new1: { tags: ['dev'], url: 'https://a.dev/' },
    });
    store.stop();
  });

  it("keeps another page's edit that this page hasn't heard about yet", async () => {
    const page = new MetaStore();
    await page.start();
    // Stop listening so the other page's write never reaches this snapshot.
    page.stop();
    await fakeBrowser.storage.local.set({
      meta: { '20': { tags: ['popup'], url: 'https://p.dev/' } },
    });
    await page.setTags('21', 'https://d.dev/', ['dashboard']);
    expect((await fakeBrowser.storage.local.get('meta')).meta).toEqual({
      '20': { tags: ['popup'], url: 'https://p.dev/' },
      '21': { tags: ['dashboard'], url: 'https://d.dev/' },
    });
  });

  it('tags many items with one storage write', async () => {
    const store = new MetaStore();
    await store.start();
    const set = vi.spyOn(fakeBrowser.storage.local, 'set');
    await store.setTagsMany(
      Array.from({ length: 50 }, (_, i) => ({
        id: String(100 + i),
        url: `https://${i}.dev/`,
        tags: ['bulk'],
      })),
    );
    expect(set).toHaveBeenCalledTimes(1);
    expect(store.allTags()).toEqual([{ tag: 'bulk', count: 50 }]);
    store.stop();
  });
});

describe('tags in the dashboard', () => {
  it('adds tags in Edit, shows them, filters by tag across folders', async () => {
    const { fake } = await renderWithBookmarks(<Dashboard surface="dashboard" />, seed);
    act(() => useUi.getState().openFolder('1'));

    const tagVia = async (title: string, tags: string[]) => {
      const tile = await screen.findByText(title, { selector: 'a *' });
      fireEvent.contextMenu(tile.closest('a')!);
      await userEvent.click(await screen.findByRole('menuitem', { name: 'Edit…' }));
      const dialog = await screen.findByRole('dialog');
      const input = within(dialog).getByRole('combobox', { name: 'Add tag' });
      for (const t of tags) await userEvent.type(input, `${t}{Enter}`);
      await userEvent.click(within(dialog).getByRole('button', { name: 'Save' }));
      await vi.waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    };
    await tagVia('React docs', ['Frontend', 'docs']);
    await tagVia('Ramen', ['food']);
    // A folder and a link in another root get the same tag.
    await act(() => getMetaStore().setTags(fake.findByTitle('Work')!.id, '', ['docs']));
    await act(() =>
      getMetaStore().setTags(fake.findByTitle('Vue docs')!.id, 'https://vuejs.org/', [
        'frontend',
      ]),
    );

    // Chips on the tile.
    const reactTile = screen.getByText('React docs', { selector: 'a *' }).closest('a')!;
    expect(within(reactTile).getByText('#frontend')).toBeVisible();

    // Sidebar tag list with counts → tag view across folders.
    const tags = screen.getByRole('region', { name: 'Tags' });
    expect(within(tags).getByRole('button', { name: /frontend\s*2/ })).toBeVisible();
    await userEvent.click(within(tags).getByRole('button', { name: /docs\s*2/ }));
    expect(useUi.getState().tagFilter).toBe('docs');
    expect(screen.getByRole('button', { name: 'Clear tag filter' })).toBeVisible();
    const view = document.querySelector('[data-tag-view="docs"]')!;
    expect(within(view as HTMLElement).getByText('React docs')).toBeVisible();
    expect(
      within(view as HTMLElement).getByRole('button', { name: /^Work,/ }),
    ).toBeVisible();
    expect(within(view as HTMLElement).queryByText('Ramen')).toBeNull();

    // Clearing goes back to the folder.
    await userEvent.click(screen.getByRole('button', { name: 'Clear tag filter' }));
    expect(useUi.getState().tagFilter).toBeNull();
  });

  it('"#tag" in search finds tagged items; plain words match tags too', async () => {
    const { fake } = await renderWithBookmarks(<Dashboard surface="dashboard" />, seed);
    await act(() =>
      getMetaStore().setTags(fake.findByTitle('Ramen')!.id, 'https://ramen.dev/', [
        'cooking',
      ]),
    );
    act(() => useUi.getState().setQuery('#cook'));
    const results = await screen.findByRole('listbox', { name: 'Search results' });
    expect(within(results).getAllByRole('option')).toHaveLength(1);
    expect(within(results).getByText('Ramen')).toBeVisible();
    act(() => useUi.getState().setQuery('cooking'));
    expect(
      within(await screen.findByRole('listbox', { name: 'Search results' })).getByText(
        'Ramen',
      ),
    ).toBeVisible();
  });

  it('tag edits undo, and tags come back when undo restores a deleted bookmark', async () => {
    const { fake } = await renderWithBookmarks(<Dashboard surface="dashboard" />, seed);
    const id = fake.findByTitle('Ramen')!.id;
    await act(() => getMetaStore().setTags(id, 'https://ramen.dev/', ['food']));
    await act(() => deleteNode(id));
    expect(fake.findByTitle('Ramen')).toBeUndefined();
    await act(async () => void (await undo.undoLast()));
    const restored = fake.findByTitle('Ramen')!.id;
    expect(restored).not.toBe(id);
    await vi.waitFor(() => expect(getMetaStore().tagsOf(restored)).toEqual(['food']));
  });
});
