import { act, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Dashboard } from '@/src/components/Dashboard';
import { archiveAll, ARCHIVE_TITLE } from '@/src/features/tidy/apply';
import { purgeReasons } from '@/src/features/tidy/purge';
import * as undo from '@/src/features/undo/undo';
import type { BookmarkNode } from '@/src/lib/bookmarks';
import type { BNode } from '@/src/store/bookmarkStore';
import { useOverlays } from '@/src/store/overlays';
import { resetPurgeForTests } from '@/src/store/purgeRun';
import { useSettings } from '@/src/store/settings';
import { installFakeBookmarks } from '../fakes/bookmarks';
import { renderWithBookmarks } from '../helpers/render';

const NOW = Date.UTC(2026, 10, 14);
const node = (title: string, url: string, yearsAgo = 0): BNode => ({
  id: 'x',
  parentId: '1',
  title,
  url,
  dateAdded: NOW - yearsAgo * 365 * 86_400_000 - 1000,
  childIds: null,
  isRoot: false,
});

afterEach(() => {
  resetPurgeForTests();
  vi.unstubAllGlobals();
});

describe('what looks disposable', () => {
  it.each([
    ['tokyo ghoul - Kickass', 'https://kat.sx/search.php?q=tokyo+ghoul', ['search']],
    [
      'react hooks - Google Search',
      'https://www.google.com/search?q=react+hooks',
      ['search'],
    ],
    ['AniRena', 'https://anirena.com/?s=god+eater', ['search']],
    ['YouTube', 'https://www.youtube.com/results?search_query=lofi', ['search']],
    ['My app', 'http://localhost:3000/dashboard', ['local']],
    ['Tunnel', 'https://ab12.ngrok-free.app/', ['local']],
    ['Preview', 'https://myapp-git-feature-x8k2ab.vercel.app/', ['local']],
    [
      'Reset your password',
      'https://accounts.example.com/reset-password?token=1',
      ['one-time'],
    ],
    ['Checkout', 'https://shop.example.com/checkout', ['one-time']],
    ['page', 'https://stripe.com/docs/api/coupons', ['vague']],
    ['', 'https://example.com/', ['vague']],
  ])('%s → %j', (title, url, expected) => {
    expect(purgeReasons(node(title, url), NOW)).toEqual(expected);
  });

  it('keeps useful things, and flags very old saves by age', () => {
    expect(
      purgeReasons(
        node('Stripe Docs - Payments', 'https://docs.stripe.com/payments'),
        NOW,
      ),
    ).toEqual([]);
    expect(purgeReasons(node('Blog page 2', 'https://blog.dev/posts?p=2'), NOW)).toEqual(
      [],
    );
    expect(purgeReasons(node('MDN', 'https://developer.mozilla.org/', 4), NOW)).toEqual([
      'old',
    ]);
  });
});

describe('archive', () => {
  it('moves links into "Archived by Arca" and undoes in one step', async () => {
    undo.clearUndoForTests();
    const fake = installFakeBookmarks({
      bar: [
        { title: 'A', url: 'https://a.dev/' },
        { title: 'B', url: 'https://b.dev/' },
      ],
    });
    const strip = (n: BookmarkNode): unknown => ({
      t: n.title,
      c: n.children?.map(strip),
    });
    const before = strip((await fake.getTree())[0]!);
    await archiveAll([fake.findByTitle('A')!.id, fake.findByTitle('B')!.id]);
    const archive = fake.findByTitle(ARCHIVE_TITLE)!;
    expect(archive.parentId).toBe('2');
    expect(fake.childIds(archive.id)).toHaveLength(2);
    expect(await undo.undoLast()).toBe(true);
    expect(strip((await fake.getTree())[0]!)).toEqual(before);
  });
});

describe('Clean out panel', () => {
  const seed = {
    bar: [
      { title: 'tokyo ghoul - Kickass', url: 'https://kat.sx/search.php?q=tokyo+ghoul' },
      { title: 'Dev server', url: 'http://localhost:5173/' },
      {
        title: 'John Wick 2014 YTS Torrent',
        url: 'https://yifyddl.movie/movie/john-wick-2014',
      },
      { title: 'React docs', url: 'https://react.dev/' },
    ],
  };

  it('groups suggestions, archives the picked ones, and adds an AI second opinion', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_u: string, init?: RequestInit) => {
        const list = JSON.parse(String(init?.body)).messages[1].content as string;
        const items = list.split('\n').map((line, i) => ({
          n: i + 1,
          kind: /john wick/i.test(line) ? 'specific-download' : 'reference',
        }));
        return Response.json({ message: { content: JSON.stringify({ items }) } });
      }),
    );
    const { fake } = await renderWithBookmarks(<Dashboard surface="dashboard" />, seed);
    await act(() => useSettings.getState().update({ aiEnabled: true }));
    act(() => useOverlays.getState().setTidyOpen(true));
    const panel = await screen.findByRole('dialog', { name: 'Tidy up' });
    await userEvent.click(within(panel).getByRole('tab', { name: 'Clean out' }));

    const search = within(panel).getByRole('region', { name: 'Search result pages' });
    expect(within(search).getByText('tokyo ghoul - Kickass')).toBeVisible();
    expect(
      within(panel).getByRole('region', { name: 'Local and temporary links' }),
    ).toBeVisible();
    expect(within(search).queryByText('React docs')).toBeNull();

    // AI second opinion surfaces what the rules miss.
    await userEvent.click(
      within(panel).getByRole('button', { name: 'Ask AI for a second opinion' }),
    );
    const ai = await within(panel).findByRole('region', {
      name: 'The AI thinks these were one-off saves',
    });
    expect(within(ai).getByText('John Wick 2014 YTS Torrent')).toBeVisible();
    expect(within(ai).getByText(/Download of one specific thing/)).toBeVisible();

    // Pick a whole group plus one AI pick, then archive.
    await userEvent.click(within(search).getByRole('checkbox', { name: /Select all/ }));
    await userEvent.click(within(ai).getByRole('checkbox', { name: /Select John Wick/ }));
    await userEvent.click(within(panel).getByRole('button', { name: 'Archive 2' }));
    await vi.waitFor(() =>
      expect(fake.childIds(fake.findByTitle(ARCHIVE_TITLE)!.id)).toHaveLength(2),
    );
    expect(fake.findByTitle('React docs')!.parentId).toBe('1');
  });

  it('asks before deleting', async () => {
    const { fake } = await renderWithBookmarks(<Dashboard surface="dashboard" />, seed);
    act(() => useOverlays.getState().setTidyOpen(true));
    const panel = await screen.findByRole('dialog', { name: 'Tidy up' });
    await userEvent.click(within(panel).getByRole('tab', { name: 'Clean out' }));
    await userEvent.click(
      // (An item can be in two groups; either checkbox selects it.)
      within(panel).getAllByRole('checkbox', { name: /Select Dev server/ })[0]!,
    );
    await userEvent.click(within(panel).getByRole('button', { name: 'Delete…' }));
    expect(fake.findByTitle('Dev server')).toBeDefined();
    await userEvent.click(
      within(panel).getByRole('button', { name: 'Delete 1 for real' }),
    );
    await vi.waitFor(() => expect(fake.findByTitle('Dev server')).toBeUndefined());
  });
});
