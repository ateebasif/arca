import { ungroupFolder } from '@/src/features/editing/actions';
import * as undo from '@/src/features/undo/undo';
import type { BookmarkNode } from '@/src/lib/bookmarks';
import { BookmarkStore } from '@/src/store/bookmarkStore';
import { setBookmarkStoreForTests } from '@/src/store/useBookmarks';
import { installFakeBookmarks } from '../fakes/bookmarks';

const strip = (n: BookmarkNode): unknown => ({
  t: n.title,
  u: n.url,
  c: n.children?.map(strip),
});

describe('ungroup folder', () => {
  beforeEach(async () => {
    undo.clearUndoForTests();
  });

  it('moves everything up where the folder was, removes it, and undoes exactly', async () => {
    const fake = installFakeBookmarks({
      bar: [
        { title: 'Before', url: 'https://before.dev/' },
        {
          title: 'Group',
          children: [
            { title: 'A', url: 'https://a.dev/' },
            { title: 'Sub', children: [{ title: 'S1', url: 'https://s1.dev/' }] },
            { title: 'B', url: 'https://b.dev/' },
          ],
        },
        { title: 'After', url: 'https://after.dev/' },
      ],
    });
    const store = new BookmarkStore();
    setBookmarkStoreForTests(store);
    await store.start();
    const before = strip((await fake.getTree())[0]!);

    await ungroupFolder(fake.findByTitle('Group')!.id);
    const bar = fake.childIds('1').map((id) => fake.findById(id)!.title);
    expect(bar).toEqual(['Before', 'A', 'Sub', 'B', 'After']);
    expect(fake.findByTitle('Group')).toBeUndefined();
    // Subfolders come out whole.
    expect(fake.childIds(fake.findByTitle('Sub')!.id)).toHaveLength(1);

    expect(await undo.undoLast()).toBe(true);
    expect(strip((await fake.getTree())[0]!)).toEqual(before);
  });

  it('refuses browser root folders', async () => {
    installFakeBookmarks({ bar: [{ title: 'A', url: 'https://a.dev/' }] });
    const store = new BookmarkStore();
    setBookmarkStoreForTests(store);
    await store.start();
    await ungroupFolder('1');
    expect(undo.undoDepth()).toBe(0);
  });
});
