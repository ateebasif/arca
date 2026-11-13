import { idbStore, memoryStore, type KeyValueStore } from '@/src/lib/idb';
import { isRecord, str } from '@/src/lib/validate';
import { fetchPreview, type FetchedPreview } from './fetchPreview';
import { cleanText, LIMITS } from './parse';

/**
 * Preview cache: memory → IndexedDB → network, in that order.
 * - A preview is fetched at most once per TTL (7 days; failures 1 day), so
 *   hovering the same bookmark again is instant and costs no network.
 * - Concurrent requests for the same URL share one fetch.
 * - At most 3 fetches run at once; the store is pruned to the newest 2,000.
 */

export const OK_TTL_MS = 7 * 24 * 60 * 60 * 1000;
export const ERROR_TTL_MS = 24 * 60 * 60 * 1000;
export const MAX_ENTRIES = 2000;
const MAX_PARALLEL = 3;

export type Preview =
  | ({ status: 'ok'; url: string; fetchedAt: number } & Omit<FetchedPreview, 'finalUrl'>)
  | { status: 'error'; url: string; fetchedAt: number };

/** Re-validates whatever comes back from storage before it's used. */
export function parseStored(raw: unknown, url: string): Preview | undefined {
  if (!isRecord(raw) || typeof raw.fetchedAt !== 'number') return undefined;
  if (raw.status === 'error') return { status: 'error', url, fetchedAt: raw.fetchedAt };
  if (raw.status !== 'ok') return undefined;
  const image = str(raw.image, '', 400_000);
  return {
    status: 'ok',
    url,
    fetchedAt: raw.fetchedAt,
    title: cleanText(str(raw.title, ''), LIMITS.title),
    description: cleanText(str(raw.description, ''), LIMITS.description),
    siteName: cleanText(str(raw.siteName, ''), LIMITS.siteName),
    // Only our own re-encoded thumbnails are ever stored.
    image: image.startsWith('data:image/webp;base64,') ? image : '',
  };
}

export interface PreviewCacheOptions {
  store?: KeyValueStore<unknown>;
  fetcher?: typeof fetchPreview;
  now?: () => number;
}

export class PreviewCache {
  private memory = new Map<string, Preview>();
  private inflight = new Map<string, Promise<Preview>>();
  private queue: Array<() => void> = [];
  private running = 0;
  private writes = 0;
  private readonly store: KeyValueStore<unknown>;
  private readonly fetcher: typeof fetchPreview;
  private readonly now: () => number;

  constructor({
    store,
    fetcher = fetchPreview,
    now = Date.now,
  }: PreviewCacheOptions = {}) {
    this.store = store ?? safeIdbStore();
    this.fetcher = fetcher;
    this.now = now;
  }

  private fresh(preview: Preview): boolean {
    const ttl = preview.status === 'ok' ? OK_TTL_MS : ERROR_TTL_MS;
    return this.now() - preview.fetchedAt < ttl;
  }

  /** Cached preview if present and fresh, without touching the network. */
  async peek(url: string): Promise<Preview | undefined> {
    const mem = this.memory.get(url);
    if (mem && this.fresh(mem)) return mem;
    const stored = parseStored(await this.store.get(url).catch(() => undefined), url);
    if (stored && this.fresh(stored)) {
      this.memory.set(url, stored);
      return stored;
    }
    return undefined;
  }

  /** Cached preview, or fetch it once (deduplicated, rate-limited). */
  get(url: string): Promise<Preview> {
    const pending = this.inflight.get(url);
    if (pending) return pending;
    const promise = (async () => {
      const cached = await this.peek(url);
      if (cached) return cached;
      const preview = await this.limit(() => this.load(url));
      this.memory.set(url, preview);
      await this.store.put(url, preview).catch(() => {});
      if (++this.writes % 50 === 0) void this.prune();
      return preview;
    })().finally(() => this.inflight.delete(url));
    this.inflight.set(url, promise);
    return promise;
  }

  private async load(url: string): Promise<Preview> {
    const fetchedAt = this.now();
    try {
      const result = await this.fetcher(url);
      return {
        status: 'ok',
        url,
        fetchedAt,
        title: result.title,
        description: result.description,
        siteName: result.siteName,
        image: result.image,
      };
    } catch {
      return { status: 'error', url, fetchedAt };
    }
  }

  private limit<T>(task: () => Promise<T>): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const run = () => {
        this.running++;
        task()
          .then(resolve, reject)
          .finally(() => {
            this.running--;
            this.queue.shift()?.();
          });
      };
      if (this.running < MAX_PARALLEL) run();
      else this.queue.push(run);
    });
  }

  /** Keeps only the newest MAX_ENTRIES entries. */
  async prune(): Promise<void> {
    const entries = await this.store.entries().catch(() => []);
    if (entries.length <= MAX_ENTRIES) return;
    const byAge = entries
      .map(
        ([k, v]) =>
          [k, isRecord(v) && typeof v.fetchedAt === 'number' ? v.fetchedAt : 0] as const,
      )
      .sort((a, b) => b[1] - a[1]);
    for (const [key] of byAge.slice(MAX_ENTRIES)) {
      this.memory.delete(key);
      await this.store.delete(key).catch(() => {});
    }
  }

  async clear(): Promise<void> {
    this.memory.clear();
    await this.store.clear().catch(() => {});
  }
}

function safeIdbStore(): KeyValueStore<unknown> {
  return typeof indexedDB === 'undefined'
    ? memoryStore()
    : idbStore('arca-previews', 'previews');
}

let shared: PreviewCache | null = null;
export function getPreviewCache(): PreviewCache {
  shared ??= new PreviewCache();
  return shared;
}
export function setPreviewCacheForTests(cache: PreviewCache | null): void {
  shared = cache;
}
