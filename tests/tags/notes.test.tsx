import { act, fireEvent, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Dashboard } from '@/src/components/Dashboard';
import { toArcaBackup, toNetscapeHtml } from '@/src/features/importexport/export';
import { parseImportFile } from '@/src/features/importexport/import';
import { cleanNote, MetaStore } from '@/src/features/tags/meta';
import * as undo from '@/src/features/undo/undo';
import { getMetaStore, resetMetaForTests } from '@/src/store/useMeta';
import { useUi } from '@/src/store/ui';
import { installFakeBookmarks } from '../fakes/bookmarks';
import { renderWithBookmarks } from '../helpers/render';

beforeEach(() => {
  undo.clearUndoForTests();
  resetMetaForTests();
});

describe('note data', () => {
  it('cleans notes like other untrusted text, keeping line breaks', () => {
    expect(cleanNote('  Read later‮\n\n\n\nfor the trip\u0007 ')).toBe(
      'Read later\n\nfor the trip',
    );
    expect(cleanNote('x'.repeat(5000))).toHaveLength(2000);
    expect(cleanNote(42)).toBe('');
  });

  it('notes and tags live side by side; clearing both removes the entry', async () => {
    const store = new MetaStore();
    await store.start();
    await store.setTags('7', 'https://a.dev/', ['dev']);
    await store.setNote('7', 'https://a.dev/', 'Great talk');
    expect(store.getSnapshot().byId.get('7')).toEqual({
      tags: ['dev'],
      note: 'Great talk',
      url: 'https://a.dev/',
    });
    await store.setTags('7', 'https://a.dev/', []);
    expect(store.noteOf('7')).toBe('Great talk');
    await store.setNote('7', 'https://a.dev/', '');
    expect(store.getSnapshot().byId.has('7')).toBe(false);
    store.stop();
  });
});

describe('notes in the dashboard', () => {
  it('adds a note in Edit, finds it in search, and undoes it', async () => {
    await renderWithBookmarks(<Dashboard surface="dashboard" />, {
      bar: [
        { title: 'React docs', url: 'https://react.dev/' },
        { title: 'Ramen', url: 'https://ramen.dev/' },
      ],
    });
    act(() => useUi.getState().openFolder('1'));
    const tile = await screen.findByText('Ramen', { selector: 'a *' });
    fireEvent.contextMenu(tile.closest('a')!);
    await userEvent.click(await screen.findByRole('menuitem', { name: 'Edit…' }));
    const dialog = await screen.findByRole('dialog');
    await userEvent.type(
      within(dialog).getByRole('textbox', { name: 'Note' }),
      'Recommended by Sam{Enter}tonkotsu broth',
    );
    await userEvent.click(within(dialog).getByRole('button', { name: 'Save' }));
    await vi.waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    const ramen = [...getMetaStore().getSnapshot().byId].find(([, m]) => m.note);
    expect(ramen?.[1].note).toBe('Recommended by Sam\ntonkotsu broth');

    // The note is searchable even though the title and URL don't match.
    act(() => useUi.getState().setQuery('tonkotsu'));
    const results = await screen.findByRole('listbox', { name: 'Search results' });
    expect(within(results).getByText('Ramen')).toBeVisible();

    expect(await undo.undoLast()).toBe(true);
    expect([...getMetaStore().getSnapshot().byId.values()].some((m) => m.note)).toBe(
      false,
    );
  });
});

describe('notes in export and import', () => {
  it('round-trips through HTML (<DD>) and the JSON backup', async () => {
    const fake = installFakeBookmarks({
      bar: [{ title: 'Ramen', url: 'https://ramen.dev/' }],
    });
    const [tree] = await fake.getTree();
    const id = fake.findByTitle('Ramen')!.id;
    const noteOf = (n: string) => (n === id ? 'Line one <b>\nLine two' : '');
    const html = toNetscapeHtml(tree!, () => [], noteOf);
    expect(html).toContain('<DD>Line one &lt;b&gt;<BR>Line two');
    for (const parsed of [
      parseImportFile('b.html', html),
      parseImportFile(
        'b.json',
        JSON.stringify(toArcaBackup(tree!, () => [], new Date(), noteOf)),
      ),
    ]) {
      const ramen = parsed.roots[0]!.children![0]!;
      expect(ramen).toMatchObject({ title: 'Ramen', note: 'Line one <b>\nLine two' });
    }
  });
});
