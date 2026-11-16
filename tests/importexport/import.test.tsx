import { act, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Dashboard } from '@/src/components/Dashboard';
import { toArcaBackup, toNetscapeHtml } from '@/src/features/importexport/export';
import {
  countDuplicates,
  importInto,
  ImportError,
  parseArcaBackup,
  parseImportFile,
  parseNetscapeHtml,
} from '@/src/features/importexport/import';
import * as undo from '@/src/features/undo/undo';
import { useOverlays } from '@/src/store/overlays';
import { resetFolderIconsForTests, useFolderIcons } from '@/src/store/folderIcons';
import { getMetaStore, resetMetaForTests } from '@/src/store/useMeta';
import { installFakeBookmarks } from '../fakes/bookmarks';
import { renderWithBookmarks } from '../helpers/render';

// What Chrome / Firefox export (uppercase tags, unclosed DT/p, nested DL).
const CHROME = `<!DOCTYPE NETSCAPE-Bookmark-file-1>
<META HTTP-EQUIV="Content-Type" CONTENT="text/html; charset=UTF-8">
<TITLE>Bookmarks</TITLE>
<H1>Bookmarks</H1>
<DL><p>
    <DT><H3 ADD_DATE="1" PERSONAL_TOOLBAR_FOLDER="true">Bookmarks bar</H3>
    <DL><p>
        <DT><A HREF="https://react.dev/" ADD_DATE="1" TAGS="dev,React">React &amp; docs</A>
        <DT><H3>Recipes</H3>
        <DL><p>
            <DT><A HREF="https://ramen.dev/">Ramen</A>
            <DT><A HREF="javascript:alert(1)">Bookmarklet</A>
        </DL><p>
    </DL><p>
    <DT><A HREF="https://vuejs.org/">Vue<script>alert(1)</script></A>
</DL><p>`;

beforeEach(() => {
  undo.clearUndoForTests();
  resetMetaForTests();
});

describe('import parsing', () => {
  it('reads a browser export: folders, links, tags; skips code links', () => {
    const p = parseNetscapeHtml(CHROME);
    expect(p).toMatchObject({ kind: 'html', links: 3, folders: 2, blocked: 1 });
    const bar = p.roots[0]!;
    expect(bar.title).toBe('Bookmarks bar');
    expect(bar.children![0]).toEqual({
      title: 'React & docs',
      url: 'https://react.dev/',
      tags: ['dev', 'react'],
    });
    expect(bar.children![1]!.children!.map((c) => c.title)).toEqual(['Ramen']);
    // Markup inside a title is just text, never run.
    expect(p.roots[1]!.title).toBe('Vuealert(1)');
  });

  it("round-trips Arca's own HTML export and JSON backup", async () => {
    const fake = installFakeBookmarks({
      bar: [{ title: 'Work', children: [{ title: 'Jira', url: 'https://jira.dev/' }] }],
      other: [{ title: 'Vue', url: 'https://vuejs.org/' }],
    });
    const [tree] = await fake.getTree();
    const jira = fake.findByTitle('Jira')!.id;
    const tagsOf = (id: string) => (id === jira ? ['work'] : []);
    for (const parsed of [
      parseImportFile('b.html', toNetscapeHtml(tree!, tagsOf)),
      parseImportFile('b.json', JSON.stringify(toArcaBackup(tree!, tagsOf))),
    ]) {
      expect(parsed.links).toBe(2);
      const work = parsed.roots[0]!.children![0]!;
      expect(work.children![0]).toMatchObject({ title: 'Jira', tags: ['work'] });
    }
  });

  it('rejects files that are not bookmarks', () => {
    expect(() => parseArcaBackup('{"format":"other"}')).toThrow(ImportError);
    expect(() => parseArcaBackup('nope')).toThrow(ImportError);
    expect(() => parseNetscapeHtml('<p>hello</p>')).toThrow(ImportError);
  });
});

describe('importInto', () => {
  it('adds everything in one new folder, skips duplicates, tags, one undo', async () => {
    const fake = installFakeBookmarks({
      other: [{ title: 'Have', url: 'https://ramen.dev' }],
    });
    const meta = getMetaStore();
    await meta.start();
    const parsed = parseNetscapeHtml(CHROME);
    const have = ['https://ramen.dev'];
    expect(countDuplicates(parsed, have)).toBe(1);
    const result = await importInto('2', parsed, {
      skipDuplicates: true,
      existingUrls: have,
      now: new Date('2026-11-14T10:00:00Z'),
    });
    expect(result).toMatchObject({ links: 2, skipped: 1 });
    const top = fake.findByTitle('Imported 2026-11-14')!;
    expect(top.parentId).toBe('2');
    expect(fake.childIds(top.id).map((id) => fake.findById(id)?.title)).toEqual([
      'Bookmarks bar',
      'Vuealert(1)',
    ]);
    const react = fake.findByTitle('React & docs')!;
    expect(meta.tagsOf(react.id)).toEqual(['dev', 'react']);
    expect(fake.findByTitle('Bookmarklet')).toBeUndefined();

    expect(await undo.undoLast()).toBe(true);
    expect(fake.findByTitle('Imported 2026-11-14')).toBeUndefined();
    expect(meta.tagsOf(react.id)).toEqual([]);
    expect(fake.findByTitle('Have')).toBeDefined();
  });
});

describe('folder extras in the Arca backup', () => {
  it('keeps folder icons, tags and notes through backup and import', async () => {
    resetFolderIconsForTests();
    const fake = installFakeBookmarks({
      bar: [
        { title: 'Design', children: [{ title: 'Figma', url: 'https://figma.com/' }] },
      ],
    });
    const [tree] = await fake.getTree();
    const design = fake.findByTitle('Design')!.id;
    const backup = toArcaBackup(
      tree!,
      (id) => (id === design ? ['ui'] : []),
      new Date(),
      (id) => (id === design ? 'Inspiration' : ''),
      (id) => (id === design ? '🎨' : undefined),
    );
    const parsed = parseImportFile('b.json', JSON.stringify(backup));
    expect(parsed.roots[0]!.children![0]).toMatchObject({
      title: 'Design',
      tags: ['ui'],
      note: 'Inspiration',
      icon: '🎨',
    });
    const meta = getMetaStore();
    await meta.start();
    await importInto('2', parsed);
    const copies = [
      ...(await fake.getTree())[0]!.children!.find((r) => r.id === '2')!.children!,
    ];
    const imported = copies[0]!.children![0]!.children![0]!;
    expect(imported.title).toBe('Design');
    expect(meta.tagsOf(imported.id)).toEqual(['ui']);
    expect(meta.noteOf(imported.id)).toBe('Inspiration');
    expect(useFolderIcons.getState().icons.get(imported.id)).toBe('🎨');
  });
});

describe('import in Settings', () => {
  it('previews a file, then imports it into the chosen folder', async () => {
    const { fake } = await renderWithBookmarks(<Dashboard surface="dashboard" />, {
      other: [{ title: 'Have', url: 'https://ramen.dev/' }],
    });
    act(() => useOverlays.getState().openSettings());
    const dialog = await screen.findByRole('dialog', { name: 'Settings' });
    const file = new File([CHROME], 'bookmarks.html', { type: 'text/html' });
    await userEvent.upload(
      within(dialog).getByLabelText('Choose a bookmarks file'),
      file,
    );
    const preview = await within(dialog).findByText(/links in 2 folders/);
    expect(preview).toHaveTextContent(
      'bookmarks.html: 3 links in 2 folders, 1 you already have.',
    );
    expect(dialog).toHaveTextContent(/1 link that could run code/);
    await userEvent.click(within(dialog).getByRole('button', { name: 'Import' }));
    expect(
      await within(dialog).findByText(/Imported 2 bookmarks \(1 duplicates skipped\)/),
    ).toBeVisible();
    await vi.waitFor(() => expect(fake.findByTitle('React & docs')).toBeDefined());
  });
});
