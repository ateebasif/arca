import { act, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Dashboard } from '@/src/components/Dashboard';
import {
  findDuplicates,
  findEmptyFolders,
  siteGroups,
  sortedOrder,
} from '@/src/features/tidy/analyze';
import { groupBySite, removeAll, sortFolder } from '@/src/features/tidy/apply';
import * as undo from '@/src/features/undo/undo';
import type { BookmarkNode } from '@/src/lib/bookmarks';
import { BookmarkStore } from '@/src/store/bookmarkStore';
import { useOverlays } from '@/src/store/overlays';
import {
  installFakeBookmarks,
  type FakeBookmarks,
  type FakeBookmarksSeed,
} from '../fakes/bookmarks';
import { renderWithBookmarks } from '../helpers/render';

const LIBRARY: FakeBookmarksSeed = {
  bar: [
    { title: 'AniRena', url: 'https://anirena.com/' },
    {
      title: 'Imported',
      children: [
        {
          title: 'Trash',
          children: [
            { title: 'AniRena', url: 'https://www.anirena.com/?utm_source=x' },
            { title: 'Old empty', children: [{ title: 'Deeper empty', children: [] }] },
          ],
        },
        {
          title: 'Copy',
          children: [{ title: 'AniRena again', url: 'https://anirena.com' }],
        },
      ],
    },
    { title: 'Zebra', url: 'https://zebra.dev/' },
    { title: 'Gh 1', url: 'https://github.com/a' },
    { title: 'Gh 2', url: 'https://docs.github.com/b' },
    { title: 'Apple', url: 'https://apple.com/' },
    { title: 'Gh 3', url: 'https://github.com/c' },
  ],
  other: [{ title: 'Nothing here', children: [] }],
};

let fake: FakeBookmarks;
let store: BookmarkStore;
const snap = () => store.getSnapshot();
async function shape() {
  const strip = (n: BookmarkNode): unknown => ({
    t: n.title,
    u: n.url,
    c: n.children?.map(strip),
  });
  return strip((await fake.getTree())[0]!);
}
const titles = (folderId: string) =>
  fake.childIds(folderId).map((id) => snap().nodes.get(id)?.title);

beforeEach(async () => {
  undo.clearUndoForTests();
  fake = installFakeBookmarks(LIBRARY);
  store = new BookmarkStore();
  await store.start();
});
afterEach(() => store.stop());

describe('analysis', () => {
  it('groups duplicates and keeps the shallowest copy outside Trash', () => {
    const groups = findDuplicates(snap());
    expect(groups).toHaveLength(1);
    expect(groups[0]!.items.map((n) => n.title)).toEqual([
      'AniRena',
      'AniRena again',
      'AniRena',
    ]);
    expect(groups[0]!.items[0]!.parentId).toBe('1');
  });

  it('finds only the outermost empty folders, never root folders', () => {
    expect(findEmptyFolders(snap()).map((f) => f.title)).toEqual([
      'Old empty',
      'Nothing here',
    ]);
  });

  it('sorts folders first, then links', () => {
    const order = sortedOrder(snap(), '1', 'title').map(
      (id) => snap().nodes.get(id)?.title,
    );
    expect(order).toEqual([
      'Imported',
      'AniRena',
      'Apple',
      'Gh 1',
      'Gh 2',
      'Gh 3',
      'Zebra',
    ]);
  });

  it('suggests site folders for 3+ links from one site', () => {
    const groups = siteGroups(snap(), '1');
    expect(groups.map((g) => [g.domain, g.items.length])).toEqual([['github.com', 3]]);
  });
});

describe('apply + undo', () => {
  it('removes duplicates and restores them exactly on undo', async () => {
    const before = await shape();
    const g = findDuplicates(snap())[0]!;
    await removeAll(
      g.items.slice(1).map((n) => n.id),
      'dups',
    );
    expect(findDuplicates(snap())).toHaveLength(0);
    await undo.undoLast();
    expect(await shape()).toEqual(before);
  });

  it('sorts a folder for real and undoes it', async () => {
    const before = await shape();
    await sortFolder(snap(), '1', 'title');
    expect(titles('1')).toEqual([
      'Imported',
      'AniRena',
      'Apple',
      'Gh 1',
      'Gh 2',
      'Gh 3',
      'Zebra',
    ]);
    await undo.undoLast();
    expect(await shape()).toEqual(before);
  });

  it('groups by site and undoes it', async () => {
    const before = await shape();
    await groupBySite('1', siteGroups(snap(), '1'));
    expect(titles('1')).toContain('github.com');
    const gh = fake.findByTitle('github.com')!.id;
    expect(titles(gh)).toEqual(['Gh 1', 'Gh 2', 'Gh 3']);
    await undo.undoLast();
    expect(await shape()).toEqual(before);
  });

  it('removes empty folders and undoes it', async () => {
    const before = await shape();
    await removeAll(
      findEmptyFolders(snap()).map((f) => f.id),
      'empty',
    );
    expect(findEmptyFolders(snap())).toEqual([]);
    await undo.undoLast();
    expect(await shape()).toEqual(before);
  });
});

describe('Tidy up panel', () => {
  it('removes duplicates after a confirm step, with Undo', async () => {
    const { fake } = await renderWithBookmarks(
      <Dashboard surface="dashboard" />,
      LIBRARY,
    );
    await userEvent.click(screen.getByRole('button', { name: /Tidy up/ }));
    const panel = await screen.findByRole('dialog', { name: 'Tidy up' });
    expect(within(panel).getAllByText(/copies/)[0]).toBeInTheDocument();
    const remove = within(panel).getByRole('button', { name: 'Remove 2 duplicates' });
    await userEvent.click(remove);
    expect(fake.findByTitle('AniRena again')).toBeDefined(); // nothing yet
    await userEvent.click(
      within(panel).getByRole('button', { name: 'Confirm: remove 2' }),
    );
    await vi.waitFor(() => expect(fake.findByTitle('AniRena again')).toBeUndefined());
    expect(within(panel).getByText(/No duplicates found/)).toBeInTheDocument();
    await act(() => undo.undoLast());
    await vi.waitFor(() => expect(fake.findByTitle('AniRena again')).toBeDefined());
  });

  it('lets you choose which copy to keep', async () => {
    const { fake } = await renderWithBookmarks(
      <Dashboard surface="dashboard" />,
      LIBRARY,
    );
    act(() => useOverlays.getState().setTidyOpen(true));
    const panel = await screen.findByRole('dialog', { name: 'Tidy up' });
    const radios = within(panel).getAllByRole('radio');
    await userEvent.click(radios[1]!); // keep "AniRena again"
    await userEvent.click(
      within(panel).getByRole('button', { name: 'Remove 2 duplicates' }),
    );
    await userEvent.click(
      within(panel).getByRole('button', { name: 'Confirm: remove 2' }),
    );
    await vi.waitFor(() => expect(fake.findByTitle('AniRena')).toBeUndefined());
    expect(fake.findByTitle('AniRena again')).toBeDefined();
  });
});
