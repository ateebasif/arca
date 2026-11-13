import {
  ERROR_TTL_MS,
  OK_TTL_MS,
  PreviewCache,
  parseStored,
} from '@/src/features/previews/cache';
import { memoryStore } from '@/src/lib/idb';

const ok = (title: string) => ({
  title,
  description: 'd',
  siteName: 's',
  image: 'data:image/webp;base64,AAAA',
  finalUrl: 'https://a.dev/',
});

describe('PreviewCache', () => {
  it('fetches once and serves later requests from cache', async () => {
    const fetcher = vi.fn(async () => ok('A'));
    const cache = new PreviewCache({ store: memoryStore(), fetcher });
    const [a, b] = await Promise.all([
      cache.get('https://a.dev/'),
      cache.get('https://a.dev/'),
    ]);
    await cache.get('https://a.dev/');
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(a).toEqual(b);
    expect(a).toMatchObject({ status: 'ok', title: 'A' });
  });

  it('survives a reload via the persistent store', async () => {
    const store = memoryStore<unknown>();
    const fetcher = vi.fn(async () => ok('A'));
    await new PreviewCache({ store, fetcher }).get('https://a.dev/');
    const fresh = new PreviewCache({ store, fetcher });
    expect(await fresh.peek('https://a.dev/')).toMatchObject({ title: 'A' });
    await fresh.get('https://a.dev/');
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it('refetches after the TTL; failures retry sooner', async () => {
    let now = 1_000_000;
    const fetcher = vi.fn(async () => ok('A'));
    const failing = vi.fn(async () => {
      throw new Error('down');
    });
    const cache = new PreviewCache({ store: memoryStore(), fetcher, now: () => now });
    const bad = new PreviewCache({
      store: memoryStore(),
      fetcher: failing,
      now: () => now,
    });

    await cache.get('https://a.dev/');
    expect(await bad.get('https://b.dev/')).toMatchObject({ status: 'error' });
    now += ERROR_TTL_MS + 1;
    await cache.get('https://a.dev/');
    await bad.get('https://b.dev/');
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(failing).toHaveBeenCalledTimes(2);
    now += OK_TTL_MS;
    await cache.get('https://a.dev/');
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it('runs at most 3 fetches at a time', async () => {
    let running = 0;
    let peak = 0;
    const fetcher = vi.fn(async () => {
      running++;
      peak = Math.max(peak, running);
      await new Promise((r) => setTimeout(r, 5));
      running--;
      return ok('x');
    });
    const cache = new PreviewCache({ store: memoryStore(), fetcher });
    await Promise.all(
      Array.from({ length: 10 }, (_, i) => cache.get(`https://${i}.dev/`)),
    );
    expect(fetcher).toHaveBeenCalledTimes(10);
    expect(peak).toBe(3);
  });

  it('prunes to the newest entries and can be cleared', async () => {
    const store = memoryStore<unknown>();
    for (let i = 0; i < 2005; i++) {
      await store.put(`https://${i}.dev/`, { status: 'error', fetchedAt: i });
    }
    const cache = new PreviewCache({ store });
    await cache.prune();
    const keys = (await store.entries()).map(([k]) => k);
    expect(keys).toHaveLength(2000);
    expect(keys).not.toContain('https://0.dev/');
    await cache.clear();
    expect(await store.entries()).toEqual([]);
  });
});

describe('parseStored (tampered cache entries)', () => {
  it('drops anything that is not our own WebP thumbnail', () => {
    for (const image of [
      'javascript:alert(1)',
      'data:image/svg+xml;base64,PHN2Zz4=',
      'https://tracker.example/pixel.gif',
      'data:text/html;base64,PHNjcmlwdD4=',
    ]) {
      expect(
        parseStored({ status: 'ok', fetchedAt: 1, title: 't', image }, 'u'),
      ).toMatchObject({
        image: '',
      });
    }
  });

  it('re-cleans text and rejects malformed entries', () => {
    expect(
      parseStored({ status: 'ok', fetchedAt: 1, title: 'a‮b', description: 7 }, 'u'),
    ).toMatchObject({ title: 'a b', description: '' });
    expect(parseStored({ status: 'ok' }, 'u')).toBeUndefined();
    expect(parseStored('junk', 'u')).toBeUndefined();
    expect(parseStored({ status: 'pwned', fetchedAt: 1 }, 'u')).toBeUndefined();
  });
});
