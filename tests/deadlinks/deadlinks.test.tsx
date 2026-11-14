import { act, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { Dashboard } from '@/src/components/Dashboard';
import { updateUrls } from '@/src/features/deadlinks/apply';
import {
  CACHE_TTL_MS,
  checkAll,
  checkUrl,
  classify,
  samePage,
  setLinkStoreForTests,
  type LinkResult,
} from '@/src/features/deadlinks/check';
import * as undo from '@/src/features/undo/undo';
import { memoryStore } from '@/src/lib/idb';
import { resetLinkCheckForTests } from '@/src/store/linkCheck';
import { useOverlays } from '@/src/store/overlays';
import { installFakeBookmarks } from '../fakes/bookmarks';
import { renderWithBookmarks } from '../helpers/render';

/** Fake web: path → status (and optional redirect target). */
function fakeWeb(routes: Record<string, number | [number, string] | 'down'>) {
  const calls: Array<{ url: string; method: string; init?: RequestInit }> = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, init?: RequestInit) => {
      calls.push({ url, method: init?.method ?? 'GET', init });
      const route = routes[url];
      if (route === 'down' || route === undefined) throw new TypeError('Failed to fetch');
      const [status, finalUrl] = Array.isArray(route) ? route : [route, url];
      const res = new Response(null, { status });
      Object.defineProperty(res, 'url', { value: finalUrl });
      return res;
    }),
  );
  return calls;
}

beforeEach(() => setLinkStoreForTests(memoryStore()));
afterEach(() => {
  vi.unstubAllGlobals();
  resetLinkCheckForTests();
});

describe('link status', () => {
  it('classifies like PRD §8.9', () => {
    expect(classify(200, 'https://a.dev/', 'https://a.dev/')).toBe('ok');
    expect(classify(200, 'http://a.dev/x/', 'https://www.a.dev/x')).toBe('ok');
    expect(classify(200, 'https://a.dev/old', 'https://b.dev/new')).toBe('moved');
    expect(classify(404, 'u', 'u')).toBe('broken');
    expect(classify(410, 'u', 'u')).toBe('broken');
    expect(classify(500, 'u', 'u')).toBe('broken');
    expect(classify(0, 'u', 'u')).toBe('broken');
    for (const code of [401, 403, 429, 503])
      expect(classify(code, 'u', 'u')).toBe('unknown');
    expect(samePage('https://a.dev/p#x', 'http://www.a.dev/p/')).toBe(true);
  });

  it('sends no cookies or referrer, falls back to GET, and spots dead sites', async () => {
    const calls = fakeWeb({
      'https://ok.dev/': 200,
      'https://nohead.dev/': 405,
      'https://gone.dev/': 'down',
    });
    expect((await checkUrl('https://ok.dev/')).status).toBe('ok');
    expect(calls[0]!.init).toMatchObject({
      method: 'HEAD',
      credentials: 'omit',
      referrerPolicy: 'no-referrer',
    });
    await checkUrl('https://nohead.dev/');
    expect(
      calls.filter((c) => c.url === 'https://nohead.dev/').map((c) => c.method),
    ).toEqual(['HEAD', 'GET']);
    expect(await checkUrl('https://gone.dev/')).toMatchObject({
      status: 'broken',
      code: 0,
    });
  });

  it('reuses results for two weeks, runs at most 2 per site, and can be stopped', async () => {
    const calls = fakeWeb(
      Object.fromEntries(
        Array.from({ length: 8 }, (_, i) => [`https://same.dev/${i}`, 200]),
      ),
    );
    const items = Array.from({ length: 8 }, (_, i) => ({
      id: String(i),
      url: `https://same.dev/${i}`,
    }));
    let running = 0;
    let peak = 0;
    const real = vi.mocked(fetch).getMockImplementation()!;
    vi.mocked(fetch).mockImplementation(async (u, init) => {
      running++;
      peak = Math.max(peak, running);
      await new Promise((r) => setTimeout(r, 5));
      running--;
      return real(u as string, init);
    });
    const seen: LinkResult[] = [];
    let now = 1_000_000;
    await checkAll(items, { onResult: (_, r) => seen.push(r), now: () => now });
    expect(seen).toHaveLength(8);
    expect(peak).toBeLessThanOrEqual(2);
    const before = calls.length;
    await checkAll(items, { onResult: () => {}, now: () => now });
    expect(calls.length).toBe(before); // cached
    now += CACHE_TTL_MS + 1;
    await checkAll(items.slice(0, 1), { onResult: () => {}, now: () => now });
    expect(calls.length).toBe(before + 1);

    const ctrl = new AbortController();
    ctrl.abort();
    const results: string[] = [];
    await checkAll(items, {
      fresh: true,
      signal: ctrl.signal,
      onResult: (id) => results.push(id),
    });
    expect(results).toEqual([]);
  });

  it('updates moved links in one undo', async () => {
    undo.clearUndoForTests();
    const fake = installFakeBookmarks({
      bar: [{ title: 'Old', url: 'https://old.dev/' }],
    });
    const id = fake.findByTitle('Old')!.id;
    await updateUrls([{ id, url: 'https://new.dev/' }]);
    expect(fake.findByTitle('Old')!.url).toBe('https://new.dev/');
    await undo.undoLast();
    expect(fake.findByTitle('Old')!.url).toBe('https://old.dev/');
  });
});

describe('broken links in Clean out', () => {
  it('asks for permission, checks, lists broken links for removal and fixes moved ones', async () => {
    fakeWeb({
      'https://fine.dev/': 200,
      'https://dead.dev/': 404,
      'https://gone.dev/': 'down',
      'https://moved.dev/': [200, 'https://new-home.dev/'],
    });
    let granted = false;
    vi.spyOn(fakeBrowser.permissions, 'contains').mockImplementation(async () => granted);
    const request = vi
      .spyOn(fakeBrowser.permissions, 'request')
      .mockImplementation(async () => {
        granted = true;
        return true;
      });
    const { fake } = await renderWithBookmarks(<Dashboard surface="dashboard" />, {
      bar: [
        { title: 'Fine', url: 'https://fine.dev/' },
        { title: 'Dead', url: 'https://dead.dev/' },
        { title: 'Gone', url: 'https://gone.dev/' },
        { title: 'Moved', url: 'https://moved.dev/' },
      ],
    });
    act(() => useOverlays.getState().setTidyOpen(true));
    const panel = await screen.findByRole('dialog', { name: 'Tidy up' });
    await userEvent.click(within(panel).getByRole('tab', { name: 'Clean out' }));
    await userEvent.click(within(panel).getByRole('button', { name: 'Check 4 links' }));
    expect(request).toHaveBeenCalledWith({ origins: ['<all_urls>'] });

    const broken = await within(panel).findByRole('region', { name: 'Broken links' });
    expect(within(broken).getByText('Dead')).toBeVisible();
    expect(within(broken).getByText('Gone')).toBeVisible();
    expect(within(broken).queryByText('Fine')).toBeNull();
    expect(within(panel).getByText(/2 broken/)).toBeVisible();

    await userEvent.click(within(panel).getByText(/1 moved link/));
    await userEvent.click(within(panel).getByRole('button', { name: 'Update all 1' }));
    await vi.waitFor(() =>
      expect(fake.findByTitle('Moved')!.url).toBe('https://new-home.dev/'),
    );
  });
});
