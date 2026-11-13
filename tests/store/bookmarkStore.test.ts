import * as bm from '@/src/lib/bookmarks';
import { BookmarkStore, buildNodes } from '@/src/store/bookmarkStore';
import {
  allBookmarks,
  countBookmarks,
  getChildren,
  getPath,
  isWithin,
  recentlyAdded,
} from '@/src/store/selectors';
import { installFakeBookmarks, type FakeBookmarks } from '../fakes/bookmarks';

let fake: FakeBookmarks;
let store: BookmarkStore;

const titleId = (title: string) => fake.findByTitle(title)!.id;

/** The store must equal a fresh load of the browser tree. */
async function expectInSync() {
  const expected = buildNodes((await fake.getTree())[0]!);
  expect(new Map(store.getSnapshot().nodes)).toEqual(expected);
}

beforeEach(async () => {
  fake = installFakeBookmarks({
    bar: [
      { title: 'GitHub', url: 'https://github.com/' },
      {
        title: 'Dev',
        children: [
          { title: 'MDN', url: 'https://developer.mozilla.org/' },
          { title: 'Nested', children: [{ title: 'Deep', url: 'https://deep.dev/' }] },
        ],
      },
    ],
    other: [{ title: 'Read later', url: 'https://later.dev/' }],
  });
  store = new BookmarkStore();
  await store.start();
});

afterEach(() => store.stop());

describe('loading', () => {
  it('loads the tree into a normalized map', () => {
    const state = store.getSnapshot();
    expect(state.ready).toBe(true);
    expect(state.rootIds).toEqual(['1', '2']);
    expect(getChildren(state, '1').map((n) => n.title)).toEqual(['GitHub', 'Dev']);
    expect(state.nodes.get('1')?.isRoot).toBe(true);
    expect(state.nodes.get(titleId('Dev'))?.isRoot).toBe(false);
    expect(state.nodes.get(titleId('GitHub'))?.childIds).toBeNull();
  });
});

describe('live sync', () => {
  it('applies create, change, move and remove without reloading', async () => {
    const getTree = vi.spyOn(fake, 'getTree');
    const created = await bm.create({
      parentId: titleId('Dev'),
      title: 'New',
      url: 'https://n.dev/',
      index: 0,
    });
    await bm.update(created.id, { title: 'Renamed' });
    await bm.move(titleId('GitHub'), { parentId: titleId('Nested'), index: 0 });
    await bm.remove(titleId('Read later'));
    await bm.remove(titleId('Dev'));
    expect(getTree).not.toHaveBeenCalled();
    await expectInSync();
  });

  it('reorders within a folder using the final index from onMoved', async () => {
    await bm.create({ parentId: '1', title: 'C', url: 'https://c.dev/' });
    await bm.move(titleId('GitHub'), { parentId: '1', index: 2 });
    expect(getChildren(store.getSnapshot(), '1').map((n) => n.title)).toEqual([
      'Dev',
      'GitHub',
      'C',
    ]);
    await expectInSync();
  });

  it('applies onChildrenReordered', async () => {
    const ids = fake.childIds('1');
    fake.onChildrenReordered.fire('1', { childIds: [...ids].reverse() });
    expect(store.getSnapshot().nodes.get('1')?.childIds).toEqual([...ids].reverse());
  });

  it('notifies subscribers once per change with a new snapshot', async () => {
    const before = store.getSnapshot();
    const listener = vi.fn();
    store.subscribe(listener);
    await bm.update(titleId('GitHub'), { title: 'GH' });
    expect(listener).toHaveBeenCalledTimes(1);
    const after = store.getSnapshot();
    expect(after).not.toBe(before);
    expect(after.version).toBe(before.version + 1);
    // Untouched nodes keep identity so memoized rows don't re-render.
    expect(after.nodes.get(titleId('Dev'))).toBe(before.nodes.get(titleId('Dev')));
  });

  it('batches browser imports into a single reload', async () => {
    const listener = vi.fn();
    store.subscribe(listener);
    await fake.simulateImport('2', [
      { title: 'Imported', children: [{ title: 'A', url: 'https://a.dev/' }] },
      { title: 'B', url: 'https://b.dev/' },
    ]);
    await vi.waitFor(() => expect(listener).toHaveBeenCalledTimes(1));
    await expectInSync();
  });

  it('reloads when an event does not fit the current tree', async () => {
    fake.onCreated.fire('999', {
      id: '999',
      parentId: '12345',
      title: 'orphan',
      syncing: false,
    });
    await vi.waitFor(() => expectInSync());
  });

  it('stays in sync through a long random sequence of edits', async () => {
    let seed = 42;
    const rand = (n: number) => {
      seed = (seed * 1103515245 + 12345) % 2 ** 31;
      return seed % n;
    };
    for (let step = 0; step < 300; step++) {
      const state = store.getSnapshot();
      const all = [...state.nodes.values()].filter((n) => !n.isRoot);
      const folders = [...state.nodes.values()].filter((n) => n.childIds && n.id !== '0');
      const target = folders[rand(folders.length)]!;
      const pick = all[rand(all.length)];
      const op = rand(5);
      try {
        if (op === 0 || !pick) {
          await bm.create({
            parentId: target.id,
            title: `n${step}`,
            url: rand(3) ? `https://${step}.dev/` : undefined,
            index: rand((target.childIds?.length ?? 0) + 1),
          });
        } else if (op === 1) {
          await bm.update(pick.id, { title: `t${step}` });
        } else if (op === 2 || op === 3) {
          await bm.move(pick.id, {
            parentId: target.id,
            index: rand((target.childIds?.length ?? 0) + 1),
          });
        } else {
          await bm.remove(pick.id);
        }
      } catch (error) {
        // Invalid moves (folder into itself) are expected and rejected.
        expect(error).toMatchObject({ code: 'INVALID_MOVE' });
      }
    }
    await expectInSync();
  });
});

describe('selectors', () => {
  it('computes paths, containment and counts', () => {
    const state = store.getSnapshot();
    expect(getPath(state, titleId('Deep')).map((n) => n.title)).toEqual([
      'Bookmarks bar',
      'Dev',
      'Nested',
      'Deep',
    ]);
    expect(isWithin(state, titleId('Deep'), titleId('Dev'))).toBe(true);
    expect(isWithin(state, titleId('GitHub'), titleId('Dev'))).toBe(false);
    expect(countBookmarks(state, '1')).toBe(3);
    expect(allBookmarks(state).map((n) => n.title)).toEqual([
      'GitHub',
      'MDN',
      'Deep',
      'Read later',
    ]);
    expect(recentlyAdded(state, 2).map((n) => n.title)).toEqual(['Read later', 'Deep']);
  });
});

describe('performance', () => {
  it('loads 5,000 bookmarks and applies an event quickly', async () => {
    const folders = Array.from({ length: 50 }, (_, f) => ({
      title: `Folder ${f}`,
      children: Array.from({ length: 100 }, (_, i) => ({
        title: `Bookmark ${f}-${i}`,
        url: `https://site${f}-${i}.dev/`,
      })),
    }));
    fake = installFakeBookmarks({ bar: folders });
    const big = new BookmarkStore();
    let start = performance.now();
    await big.start();
    const loadMs = performance.now() - start;
    start = performance.now();
    await bm.update(fake.findByTitle('Bookmark 10-10')!.id, { title: 'x' });
    const eventMs = performance.now() - start;
    big.stop();
    expect(big.getSnapshot().nodes.size).toBe(5000 + 50 + 3);
    expect(loadMs).toBeLessThan(150);
    expect(eventMs).toBeLessThan(20);
  });
});
