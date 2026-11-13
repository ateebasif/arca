import * as bm from '@/src/lib/bookmarks';
import { ArcaError } from '@/src/lib/errors';
import { installFakeBookmarks, type FakeBookmarks } from '../fakes/bookmarks';

let fake: FakeBookmarks;

const id = (title: string) => {
  const node = fake.findByTitle(title);
  if (!node) throw new Error(`no node titled ${title}`);
  return node.id;
};

const expectCode = (promise: Promise<unknown>, code: ArcaError['code']) =>
  expect(promise).rejects.toMatchObject({ name: 'ArcaError', code });

beforeEach(() => {
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
      { title: 'News', url: 'https://news.ycombinator.com/' },
    ],
    other: [{ title: 'Empty', children: [] }],
  });
});

describe('isRootFolder', () => {
  it('flags the invisible root and the three browser root folders', async () => {
    const root = await bm.getTree();
    expect(bm.isRootFolder(root)).toBe(true);
    for (const child of root.children ?? []) expect(bm.isRootFolder(child)).toBe(true);
  });

  it('flags folders with folderType even when the parent id differs', () => {
    expect(
      bm.isRootFolder({
        id: '9',
        parentId: '5',
        title: 'x',
        folderType: 'managed',
        syncing: false,
      }),
    ).toBe(true);
  });

  it('does not flag user folders or bookmarks', async () => {
    expect(bm.isRootFolder(await bm.getNode(id('Dev')))).toBe(false);
    expect(bm.isRootFolder(await bm.getNode(id('GitHub')))).toBe(false);
  });
});

describe('reads', () => {
  it('getTree returns the root with the three root folders', async () => {
    const root = await bm.getTree();
    expect(root.id).toBe(bm.ROOT_ID);
    expect(root.children?.map((c) => c.id)).toEqual(['1', '2', '3']);
    expect(root.children?.[0]?.children?.map((c) => c.title)).toEqual([
      'GitHub',
      'Dev',
      'News',
    ]);
  });

  it('getNode throws NOT_FOUND for unknown ids', async () => {
    await expectCode(bm.getNode('999'), 'NOT_FOUND');
  });

  it('getChildren and getSubTree return the folder contents', async () => {
    expect((await bm.getChildren(id('Dev'))).map((c) => c.title)).toEqual([
      'MDN',
      'Nested',
    ]);
    const sub = await bm.getSubTree(id('Nested'));
    expect(sub.children?.[0]?.title).toBe('Deep');
  });

  it('getAncestorIds walks up to the root', async () => {
    expect(await bm.getAncestorIds(id('Deep'))).toEqual([
      id('Nested'),
      id('Dev'),
      '1',
      '0',
    ]);
  });
});

describe('create', () => {
  it('creates bookmarks and folders at an index', async () => {
    const created = await bm.create({
      parentId: '1',
      title: 'Arca',
      url: 'https://arca.dev/',
      index: 1,
    });
    expect(created).toMatchObject({ parentId: '1', index: 1, url: 'https://arca.dev/' });
    const folder = await bm.create({ parentId: '1', title: 'Folder' });
    expect(bm.isFolder(folder)).toBe(true);
    expect(fake.childIds('1')).toEqual([
      id('GitHub'),
      created.id,
      id('Dev'),
      id('News'),
      folder.id,
    ]);
  });

  it('rejects the top-level root and non-folder parents', async () => {
    await expectCode(bm.create({ parentId: '0', title: 'x' }), 'ROOT_FOLDER');
    await expectCode(bm.create({ parentId: id('GitHub'), title: 'x' }), 'NOT_A_FOLDER');
    await expectCode(bm.create({ parentId: '999', title: 'x' }), 'NOT_FOUND');
  });
});

describe('update', () => {
  it('renames and changes URLs', async () => {
    await bm.update(id('GitHub'), { title: 'GH', url: 'https://github.com/arca' });
    expect(await bm.getNode(fake.findByTitle('GH')!.id)).toMatchObject({
      url: 'https://github.com/arca',
    });
  });

  it('refuses to touch root folders', async () => {
    await expectCode(bm.update('1', { title: 'Bar' }), 'ROOT_FOLDER');
    await expectCode(bm.update('0', { title: 'Root' }), 'ROOT_FOLDER');
  });

  it('refuses a URL on a folder', async () => {
    await expectCode(bm.update(id('Dev'), { url: 'https://x.dev' }), 'NOT_A_FOLDER');
  });
});

describe('move', () => {
  it('moves into another folder', async () => {
    const moved = await bm.move(id('News'), { parentId: id('Dev'), index: 0 });
    expect(moved).toMatchObject({ parentId: id('Dev'), index: 0 });
    expect(fake.childIds(id('Dev'))[0]).toBe(id('News'));
  });

  it('reorders within a folder using browser index semantics', async () => {
    // Moving GitHub (0) to "before News" means index 2 in the original list.
    await bm.move(id('GitHub'), { parentId: '1', index: 2 });
    expect(fake.childIds('1')).toEqual([id('Dev'), id('GitHub'), id('News')]);
  });

  it('blocks moving a folder into itself or a descendant', async () => {
    await expectCode(bm.move(id('Dev'), { parentId: id('Dev') }), 'INVALID_MOVE');
    await expectCode(bm.move(id('Dev'), { parentId: id('Nested') }), 'INVALID_MOVE');
  });

  it('blocks root folders, the top-level root and bookmark targets', async () => {
    await expectCode(bm.move('2', { parentId: '1' }), 'ROOT_FOLDER');
    await expectCode(bm.move(id('Dev'), { parentId: '0' }), 'INVALID_MOVE');
    await expectCode(bm.move(id('Dev'), { parentId: id('GitHub') }), 'NOT_A_FOLDER');
  });

  it('never loses or duplicates a bookmark', async () => {
    const before = fake.size;
    await bm.move(id('Deep'), { parentId: '2' });
    await bm.move(id('Nested'), { parentId: '3' });
    await bm.move(id('Deep'), { parentId: id('Nested'), index: 0 });
    expect(fake.size).toBe(before);
    expect(await bm.getAncestorIds(id('Deep'))).toEqual([id('Nested'), '3', '0']);
  });
});

describe('remove', () => {
  it('removes a bookmark and returns it', async () => {
    const removed = await bm.remove(id('GitHub'));
    expect(removed.title).toBe('GitHub');
    expect(fake.findByTitle('GitHub')).toBeUndefined();
  });

  it('removes a non-empty folder and returns the full subtree', async () => {
    const removed = await bm.remove(id('Dev'));
    expect(removed.children?.map((c) => c.title)).toEqual(['MDN', 'Nested']);
    expect(removed.children?.[1]?.children?.[0]?.title).toBe('Deep');
    expect(fake.findByTitle('Deep')).toBeUndefined();
  });

  it('removes an empty folder', async () => {
    await bm.remove(id('Empty'));
    expect(fake.childIds('2')).toEqual([]);
  });

  it('refuses root folders', async () => {
    await expectCode(bm.remove('1'), 'ROOT_FOLDER');
    await expectCode(bm.remove('0'), 'ROOT_FOLDER');
  });
});

describe('subscribe', () => {
  it('forwards events and unsubscribes cleanly', async () => {
    const onCreated = vi.fn();
    const onMoved = vi.fn();
    const onRemoved = vi.fn();
    const onChanged = vi.fn();
    const unsubscribe = bm.subscribe({ onCreated, onMoved, onRemoved, onChanged });

    const created = await bm.create({ parentId: '2', title: 'X', url: 'https://x.dev/' });
    await bm.update(created.id, { title: 'Y' });
    await bm.move(created.id, { parentId: '1', index: 0 });
    await bm.remove(created.id);

    expect(onCreated).toHaveBeenCalledWith(
      created.id,
      expect.objectContaining({ title: 'X' }),
    );
    expect(onChanged).toHaveBeenCalledWith(created.id, {
      title: 'Y',
      url: 'https://x.dev/',
    });
    expect(onMoved).toHaveBeenCalledWith(created.id, {
      parentId: '1',
      index: 0,
      oldParentId: '2',
      oldIndex: 1,
    });
    expect(onRemoved).toHaveBeenCalledWith(
      created.id,
      expect.objectContaining({ parentId: '1', index: 0 }),
    );

    unsubscribe();
    await bm.create({ parentId: '2', title: 'Z', url: 'https://z.dev/' });
    expect(onCreated).toHaveBeenCalledTimes(1);
  });

  it('reports browser imports as began/ended around the creates', async () => {
    const calls: string[] = [];
    bm.subscribe({
      onImportBegan: () => calls.push('began'),
      onCreated: (_id, node) => calls.push(`created:${node.title}`),
      onImportEnded: () => calls.push('ended'),
    });
    await fake.simulateImport('2', [
      { title: 'F', children: [{ title: 'A', url: 'https://a.dev/' }] },
    ]);
    expect(calls).toEqual(['began', 'created:F', 'created:A', 'ended']);
  });
});
