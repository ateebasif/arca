import {
  dropProblem,
  moveIntoFolder,
  reorder,
  reorderIndex,
} from '@/src/features/dnd/moves';
import * as undo from '@/src/features/undo/undo';
import { BookmarkStore } from '@/src/store/bookmarkStore';
import { installFakeBookmarks, type FakeBookmarks } from '../fakes/bookmarks';
import { SAMPLE_SEED } from '../helpers/render';

let fake: FakeBookmarks;
let store: BookmarkStore;
const id = (t: string) => fake.findByTitle(t)!.id;
const titles = (folderId: string) => fake.childIds(folderId).map(titleOf);
function titleOf(nodeId: string) {
  return store.getSnapshot().nodes.get(nodeId)?.title;
}

beforeEach(async () => {
  undo.clearUndoForTests();
  fake = installFakeBookmarks({
    ...SAMPLE_SEED,
    bar: [
      ...SAMPLE_SEED.bar!,
      { title: 'A', url: 'https://a.dev/' },
      { title: 'B', url: 'https://b.dev/' },
    ],
  });
  store = new BookmarkStore();
  await store.start();
});
afterEach(() => store.stop());

describe('dropProblem', () => {
  it('blocks folders into themselves or descendants, root folders and the top root', () => {
    const s = store.getSnapshot();
    expect(dropProblem(s, id('Dev'), id('Dev'))).toMatch(/itself/);
    expect(dropProblem(s, id('Dev'), id('Nested'))).toMatch(/itself/);
    expect(dropProblem(s, '1', '2')).toMatch(/can't be moved/);
    expect(dropProblem(s, id('GitHub'), '0')).toMatch(/inside/);
    expect(dropProblem(s, id('GitHub'), id('Nested'))).toBeNull();
    expect(dropProblem(s, id('Nested'), '2')).toBeNull();
  });
});

describe('moveIntoFolder', () => {
  it('moves to the end of the folder and can be undone', async () => {
    expect(await moveIntoFolder(store.getSnapshot(), id('GitHub'), id('Recipes'))).toBe(
      true,
    );
    expect(fake.findByTitle('GitHub')!.parentId).toBe(id('Recipes'));
    expect(titles(id('Recipes'))).toEqual(['Pasta', 'GitHub']);
    await undo.undoLast();
    expect(titles('1')[0]).toBe('GitHub');
  });

  it('refuses invalid drops without touching bookmarks', async () => {
    expect(await moveIntoFolder(store.getSnapshot(), id('Dev'), id('Nested'))).toBe(
      false,
    );
    expect(fake.findByTitle('Dev')!.parentId).toBe('1');
  });
});

describe('reorder', () => {
  it('maps drag positions to Chromium indexes (down and up)', async () => {
    expect(reorderIndex(0, 2)).toBe(3);
    expect(reorderIndex(3, 1)).toBe(1);
    // bar: GitHub, Dev, News, A, B
    await reorder(store.getSnapshot(), id('GitHub'), id('News'));
    expect(titles('1')).toEqual(['Dev', 'News', 'GitHub', 'A', 'B']);
    await reorder(store.getSnapshot(), id('B'), id('Dev'));
    expect(titles('1')).toEqual(['B', 'Dev', 'News', 'GitHub', 'A']);
    await undo.undoLast();
    await undo.undoLast();
    expect(titles('1')).toEqual(['GitHub', 'Dev', 'News', 'A', 'B']);
  });

  it('ignores drops across folders or onto itself', async () => {
    expect(await reorder(store.getSnapshot(), id('GitHub'), id('Pasta'))).toBe(false);
    expect(await reorder(store.getSnapshot(), id('GitHub'), id('GitHub'))).toBe(false);
  });
});
