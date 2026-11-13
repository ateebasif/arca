import { act, fireEvent, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { Dashboard } from '@/src/components/Dashboard';
import { Popup } from '@/src/components/Popup';
import { setDragActive } from '@/src/features/dnd/ids';
import { siteGroups } from '@/src/features/tidy/analyze';
import { groupBySite, sortFolder } from '@/src/features/tidy/apply';
import * as undo from '@/src/features/undo/undo';
import * as bm from '@/src/lib/bookmarks';
import { BookmarkStore } from '@/src/store/bookmarkStore';
import { useOverlays } from '@/src/store/overlays';
import { useUi } from '@/src/store/ui';
import { installFakeBookmarks, type FakeBookmarks } from '../fakes/bookmarks';
import { renderWithBookmarks, SAMPLE_SEED } from '../helpers/render';

async function shape(fake: FakeBookmarks) {
  const strip = (n: bm.BookmarkNode): unknown => ({
    t: n.title,
    u: n.url,
    c: n.children?.map(strip),
  });
  return strip((await fake.getTree())[0]!);
}

describe('review finding 1: undo restores bookmarklets and data: URLs', () => {
  beforeEach(() => undo.clearUndoForTests());

  it('restores a deleted folder that contains a bookmarklet, fully', async () => {
    const fake = installFakeBookmarks({
      bar: [
        {
          title: 'Tools',
          children: [
            { title: 'Before', url: 'https://a.dev/' },
            { title: 'Bookmarklet', url: 'javascript:void(0)' },
            { title: 'After', url: 'https://b.dev/' },
          ],
        },
      ],
    });
    const before = await shape(fake);
    undo.record(undo.deleted(await bm.remove(fake.findByTitle('Tools')!.id)), {
      toast: false,
    });
    expect(await undo.undoLast()).toBe(true);
    expect(await shape(fake)).toEqual(before);
  });

  it('undoes a rename of a bookmarklet', async () => {
    const fake = installFakeBookmarks({
      bar: [{ title: 'BM', url: 'javascript:void(0)' }],
    });
    const id = fake.findByTitle('BM')!.id;
    await bm.update(id, { title: 'Renamed' });
    undo.record(undo.changed(id, { title: 'BM', url: 'javascript:void(0)' }, ''), {
      toast: false,
    });
    expect(await undo.undoLast()).toBe(true);
    expect(fake.findByTitle('BM')).toMatchObject({ url: 'javascript:void(0)' });
  });
});

describe('review finding 2: undo across recreated ids', () => {
  beforeEach(() => undo.clearUndoForTests());

  it('child deleted, then parent deleted: both undo correctly', async () => {
    const fake = installFakeBookmarks(SAMPLE_SEED);
    const before = await shape(fake);
    undo.record(undo.deleted(await bm.remove(fake.findByTitle('MDN')!.id)), {
      toast: false,
    });
    undo.record(undo.deleted(await bm.remove(fake.findByTitle('Dev')!.id)), {
      toast: false,
    });
    expect(await undo.undoLast()).toBe(true);
    expect(await undo.undoLast()).toBe(true);
    expect(await shape(fake)).toEqual(before);
  });

  it('rename then delete: both undo correctly', async () => {
    const fake = installFakeBookmarks(SAMPLE_SEED);
    const before = await shape(fake);
    const id = fake.findByTitle('GitHub')!.id;
    await bm.update(id, { title: 'GH' });
    undo.record(undo.changed(id, { title: 'GitHub', url: 'https://github.com/' }, ''), {
      toast: false,
    });
    undo.record(undo.deleted(await bm.remove(id)), { toast: false });
    await undo.undoLast();
    await undo.undoLast();
    expect(await shape(fake)).toEqual(before);
  });

  it('undoing an added folder keeps it if the user filled it since', async () => {
    const fake = installFakeBookmarks(SAMPLE_SEED);
    const folder = await bm.create({ parentId: '1', title: 'New' });
    undo.record(undo.created(folder), { toast: false });
    await bm.create({ parentId: folder.id, title: 'Keep me', url: 'https://k.dev/' });
    expect(await undo.undoLast()).toBe(false);
    expect(fake.findByTitle('Keep me')).toBeDefined();
  });
});

describe('review finding 6: tidy with stale state', () => {
  let fake: FakeBookmarks;
  let store: BookmarkStore;
  beforeEach(async () => {
    undo.clearUndoForTests();
    fake = installFakeBookmarks({
      bar: [
        { title: 'Z', url: 'https://z.dev/' },
        { title: 'A', url: 'https://a.dev/' },
        { title: 'Gh 1', url: 'https://github.com/1' },
        { title: 'Gh 2', url: 'https://github.com/2' },
        { title: 'Gh 3', url: 'https://github.com/3' },
      ],
    });
    store = new BookmarkStore();
    await store.start();
  });
  afterEach(() => store.stop());

  it('undoing a sort leaves items that were moved away since', async () => {
    await sortFolder(store.getSnapshot(), '1', 'title');
    await bm.move(fake.findByTitle('Z')!.id, { parentId: '2' });
    expect(await undo.undoLast()).toBe(true);
    expect(fake.findByTitle('Z')!.parentId).toBe('2');
  });

  it('group by site skips links moved since the panel was opened', async () => {
    const groups = siteGroups(store.getSnapshot(), '1');
    await bm.move(fake.findByTitle('Gh 1')!.id, { parentId: '2' });
    await groupBySite('1', groups);
    expect(fake.findByTitle('Gh 1')!.parentId).toBe('2');
    expect(fake.childIds(fake.findByTitle('github.com')!.id)).toHaveLength(2);
  });
});

describe('review finding 3: Tidy never removes every copy', () => {
  it('ignores a remembered "keep" choice that is no longer in the group', async () => {
    const { fake } = await renderWithBookmarks(<Dashboard surface="dashboard" />, {
      bar: [
        {
          title: 'Here',
          children: [
            { title: 'P', url: 'https://p.dev/' },
            { title: 'P', url: 'https://p.dev/?utm_source=x' },
          ],
        },
        { title: 'P outside', url: 'https://www.p.dev/' },
      ],
    });
    act(() => useUi.getState().openFolder(fake.findByTitle('Here')!.id));
    act(() => useOverlays.getState().setTidyOpen(true));
    const panel = await screen.findByRole('dialog', { name: 'Tidy up' });
    // Keep the copy outside "Here", then narrow the scope to "Here".
    const outside = within(panel)
      .getAllByRole('radio')
      .find(
        (r) =>
          r.closest('label')?.textContent?.startsWith('Bookmarks bar') &&
          !r.closest('label')?.textContent?.includes('Here'),
      )!;
    await userEvent.click(outside);
    await userEvent.selectOptions(within(panel).getByRole('combobox'), 'folder');
    await userEvent.click(
      within(panel).getByRole('button', { name: 'Remove 1 duplicates' }),
    );
    await userEvent.click(
      within(panel).getByRole('button', { name: 'Confirm: remove 1' }),
    );
    await vi.waitFor(() =>
      expect(fake.childIds(fake.findByTitle('Here')!.id)).toHaveLength(1),
    );
  });
});

describe('review finding 5: keys during a keyboard drag', () => {
  afterEach(() => setDragActive(false));
  it('Enter, F2 and Delete do nothing while dragging', async () => {
    const { fake } = await renderWithBookmarks(
      <Dashboard surface="dashboard" />,
      SAMPLE_SEED,
    );
    act(() => useUi.getState().setView('list'));
    const row = document.querySelector<HTMLElement>(
      `[data-folder-row="${fake.findByTitle('Dev')!.id}"]`,
    )!;
    row.focus();
    setDragActive(true);
    fireEvent.keyDown(row, { key: 'Enter' });
    fireEvent.keyDown(row, { key: 'F2' });
    fireEvent.keyDown(row, { key: 'Delete' });
    expect(useUi.getState().currentFolderId).toBe('1');
    expect(screen.queryByRole('textbox', { name: 'Name' })).toBeNull();
    expect(fake.findByTitle('Dev')).toBeDefined();
  });
});

describe('review finding 8: Escape in popup search', () => {
  it('brings the popup sections back', async () => {
    vi.spyOn(window, 'close').mockImplementation(() => {});
    vi.spyOn(fakeBrowser.tabs, 'query').mockResolvedValue([
      { id: 1, url: 'https://x.dev/', title: 'X', active: true },
    ] as never);
    await renderWithBookmarks(<Popup />, SAMPLE_SEED);
    const input = screen.getByRole('combobox', { name: 'Search bookmarks' });
    await userEvent.type(input, 'git');
    expect(screen.queryByRole('region', { name: 'Recently added' })).toBeNull();
    await userEvent.keyboard('{Escape}');
    expect(
      await screen.findByRole('region', { name: 'Recently added' }),
    ).toBeInTheDocument();
  });
});
