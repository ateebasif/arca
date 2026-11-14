import { act, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Dashboard } from '@/src/components/Dashboard';
import {
  exportFileName,
  toArcaBackup,
  toNetscapeHtml,
} from '@/src/features/importexport/export';
import { getMetaStore } from '@/src/store/useMeta';
import { installFakeBookmarks } from '../fakes/bookmarks';
import { renderWithBookmarks } from '../helpers/render';

const seed = {
  bar: [
    { title: 'A & B <docs>', url: 'https://a.dev/?x=1&y="2"' },
    { title: 'Work', children: [{ title: 'Jira', url: 'https://jira.dev/' }] },
  ],
  other: [{ title: 'Vue', url: 'https://vuejs.org/' }],
};

describe('export', () => {
  it('writes Netscape HTML any browser can import, escaped, with tags', async () => {
    const fake = installFakeBookmarks(seed);
    const [tree] = await fake.getTree();
    const jira = fake.findByTitle('Jira')!.id;
    const html = toNetscapeHtml(tree!, (id) => (id === jira ? ['work', 'daily'] : []));
    expect(html.startsWith('<!DOCTYPE NETSCAPE-Bookmark-file-1>')).toBe(true);
    expect(html).toContain('PERSONAL_TOOLBAR_FOLDER="true">Bookmarks bar</H3>');
    expect(html).toContain('HREF="https://a.dev/?x=1&amp;y=&quot;2&quot;"');
    expect(html).toContain('>A &amp; B &lt;docs&gt;</A>');
    expect(html).toContain('TAGS="work,daily">Jira</A>');
    expect(html).not.toContain('<docs>');
    // Folders nest with <DL>; Other bookmarks is its own folder.
    expect(html).toMatch(
      /<H3[^>]*>Work<\/H3>\n\s*<DL><p>\n\s*<DT><A HREF="https:\/\/jira\.dev\/"/,
    );
    expect(html).toMatch(/<H3[^>]*>Other bookmarks<\/H3>/);
  });

  it('writes a JSON backup with the full tree and tags', async () => {
    const fake = installFakeBookmarks(seed);
    const [tree] = await fake.getTree();
    const vue = fake.findByTitle('Vue')!.id;
    const backup = toArcaBackup(
      tree!,
      (id) => (id === vue ? ['frontend'] : []),
      new Date('2026-11-14T00:00:00Z'),
    );
    expect(backup).toMatchObject({
      format: 'arca-backup',
      version: 1,
      exportedAt: '2026-11-14T00:00:00.000Z',
    });
    const [bar, other] = backup.roots;
    expect(bar!.title).toBe('Bookmarks bar');
    expect(bar!.children!.map((c) => c.title)).toEqual(['A & B <docs>', 'Work']);
    expect(other!.children![0]).toMatchObject({
      title: 'Vue',
      url: 'https://vuejs.org/',
      tags: ['frontend'],
    });
    expect(JSON.parse(JSON.stringify(backup))).toEqual(backup);
    expect(exportFileName('html', new Date('2026-11-14T10:00:00Z'))).toBe(
      'arca-bookmarks-2026-11-14.html',
    );
  });

  it('Settings → Backup saves files through a download link', async () => {
    const blobs: Blob[] = [];
    URL.createObjectURL = vi.fn((b: Blob) => {
      blobs.push(b);
      return 'blob:arca/1';
    }) as typeof URL.createObjectURL;
    URL.revokeObjectURL = vi.fn();
    const click = vi
      .spyOn(HTMLAnchorElement.prototype, 'click')
      .mockImplementation(() => {});
    const { fake } = await renderWithBookmarks(<Dashboard surface="dashboard" />, seed);
    await act(() =>
      getMetaStore().setTags(fake.findByTitle('Vue')!.id, 'https://vuejs.org/', [
        'frontend',
      ]),
    );
    act(() => {
      screen.getByRole('button', { name: 'Settings' }).click();
    });
    await userEvent.click(
      await screen.findByRole('button', { name: 'Export bookmarks (HTML)' }),
    );
    await vi.waitFor(() => expect(click).toHaveBeenCalledTimes(1));
    expect(await blobs[0]!.text()).toContain('TAGS="frontend">Vue</A>');
    await userEvent.click(
      screen.getByRole('button', { name: 'Export backup with tags (JSON)' }),
    );
    await vi.waitFor(() => expect(click).toHaveBeenCalledTimes(2));
    expect(JSON.parse(await blobs[1]!.text()).format).toBe('arca-backup');
    expect(
      screen.getByText(/Saved arca-backup-.*\.json to your downloads/),
    ).toBeVisible();
  });
});
