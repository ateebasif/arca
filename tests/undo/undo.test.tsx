import { act, fireEvent, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Dashboard } from '@/src/components/Dashboard';
import * as undo from '@/src/features/undo/undo';
import * as bm from '@/src/lib/bookmarks';
import { installFakeBookmarks, type FakeBookmarks } from '../fakes/bookmarks';
import { renderWithBookmarks, SAMPLE_SEED } from '../helpers/render';

/** Titles/urls of the whole tree, ignoring ids (which change on recreate). */
async function shape(fake: FakeBookmarks) {
  const strip = (n: bm.BookmarkNode): unknown => ({
    t: n.title,
    u: n.url,
    c: n.children?.map(strip),
  });
  return strip((await fake.getTree())[0]!);
}

describe('undo actions', () => {
  let fake: FakeBookmarks;
  beforeEach(() => {
    undo.clearUndoForTests();
    fake = installFakeBookmarks(SAMPLE_SEED);
  });

  it('restores a deleted folder with all children in place', async () => {
    const before = await shape(fake);
    const removed = await bm.remove(fake.findByTitle('Dev')!.id);
    undo.record(undo.deleted(removed), { toast: false });
    expect(await undo.undoLast()).toBe(true);
    expect(await shape(fake)).toEqual(before);
  });

  it('puts moved items back, including same-folder moves down and up', async () => {
    const before = await shape(fake);
    for (const [title, to] of [
      ['GitHub', { parentId: '1', index: 3 }],
      ['News', { parentId: '1', index: 0 }],
      ['MDN', { parentId: '2', index: 0 }],
    ] as const) {
      const node = await bm.getNode(fake.findByTitle(title)!.id);
      await bm.move(node.id, to);
      undo.record(
        undo.moved(node.id, { parentId: node.parentId!, index: node.index! }, ''),
        {
          toast: false,
        },
      );
      await undo.undoLast();
      expect(await shape(fake)).toEqual(before);
    }
  });

  it('reverts renames and combined edits in reverse order', async () => {
    const before = await shape(fake);
    const id = fake.findByTitle('GitHub')!.id;
    await bm.update(id, { title: 'GH', url: 'https://gh.dev/' });
    const step1 = undo.changed(id, { title: 'GitHub', url: 'https://github.com/' }, '');
    const node = await bm.getNode(id);
    await bm.move(id, { parentId: '2' });
    const step2 = undo.moved(id, { parentId: '1', index: node.index! }, '');
    undo.record(undo.combine('Edited', [step1, step2]), { toast: false });
    await undo.undoLast();
    expect(await shape(fake)).toEqual(before);
  });

  it('keeps only the last 20 actions', async () => {
    const calls: number[] = [];
    for (let i = 0; i < 25; i++) {
      undo.record(
        { label: `a${i}`, undo: async () => void calls.push(i) },
        { toast: false },
      );
    }
    expect(undo.undoDepth()).toBe(20);
    while (await undo.undoLast());
    expect(calls).toEqual([
      24, 23, 22, 21, 20, 19, 18, 17, 16, 15, 14, 13, 12, 11, 10, 9, 8, 7, 6, 5,
    ]);
  });

  it('reports a failed undo instead of throwing', async () => {
    undo.record(
      { label: 'x', undo: () => Promise.reject(new Error('gone')) },
      { toast: false },
    );
    expect(await undo.undoLast()).toBe(false);
  });
});

describe('undo in the UI', () => {
  it('offers Undo in the delete toast and restores the item', async () => {
    const { fake } = await renderWithBookmarks(
      <Dashboard surface="dashboard" />,
      SAMPLE_SEED,
    );
    const tile = [...document.querySelectorAll<HTMLElement>('[data-bookmark-id]')].find(
      (el) => el.textContent?.includes('GitHub'),
    )!;
    tile.focus();
    await userEvent.keyboard('{Delete}');
    expect(fake.findByTitle('GitHub')).toBeUndefined();
    await userEvent.click(screen.getByRole('button', { name: 'Undo' }));
    await vi.waitFor(() => expect(fake.findByTitle('GitHub')).toBeDefined());
    expect(
      fake
        .childIds('1')
        .map((id) => fake.findByTitle('GitHub')!.id === id)
        .indexOf(true),
    ).toBe(0);
  });

  it('undoes with ⌘Z / Ctrl+Z, but not while typing', async () => {
    const { fake } = await renderWithBookmarks(
      <Dashboard surface="dashboard" />,
      SAMPLE_SEED,
    );
    await act(async () => {
      const removed = await bm.remove(fake.findByTitle('News')!.id);
      undo.record(undo.deleted(removed));
    });
    const input = screen.getByRole('combobox', { name: 'Search bookmarks' });
    input.focus();
    fireEvent.keyDown(input, { key: 'z', ctrlKey: true });
    expect(fake.findByTitle('News')).toBeUndefined();
    input.blur();
    fireEvent.keyDown(window, { key: 'z', ctrlKey: true });
    await vi.waitFor(() => expect(fake.findByTitle('News')).toBeDefined());
  });

  it('undoes renames and dialog edits', async () => {
    const { fake } = await renderWithBookmarks(
      <Dashboard surface="dashboard" />,
      SAMPLE_SEED,
    );
    const tile = () =>
      [...document.querySelectorAll<HTMLElement>('[data-bookmark-id]')].find((el) =>
        el.textContent?.includes('GitHub'),
      )!;
    tile().focus();
    await userEvent.keyboard('{F2}{Control>}a{/Control}Renamed{Enter}');
    expect(fake.findByTitle('Renamed')).toBeDefined();
    fireEvent.keyDown(window, { key: 'z', ctrlKey: true });
    await vi.waitFor(() => expect(fake.findByTitle('GitHub')).toBeDefined());
  });
});
