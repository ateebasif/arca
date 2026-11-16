import { idbStore, memoryStore, type KeyValueStore } from '@/src/lib/idb';

/**
 * Dead-link finder (PRD §8.9), opt-in. Each bookmark gets a HEAD request (GET
 * when a site refuses HEAD) with no cookies, no referrer, an 8 s timeout and
 * the body never read. At most 6 requests run at once, 2 per site. Results
 * are cached for two weeks; nothing runs unless the user starts it.
 */

export type LinkStatus = 'ok' | 'moved' | 'broken' | 'unknown';

export interface LinkResult {
  status: LinkStatus;
  /** HTTP status, or 0 when the site couldn't be reached. */
  code: number;
  /** Where a moved link ends up. */
  finalUrl?: string;
  checkedAt: number;
}

export const TIMEOUT_MS = 8000;
export const CONCURRENCY = 6;
const PER_HOST = 2;
export const CACHE_TTL_MS = 14 * 24 * 60 * 60 * 1000;

let shared: KeyValueStore<LinkResult> | null = null;
function store(): KeyValueStore<LinkResult> {
  shared ??=
    typeof indexedDB === 'undefined'
      ? memoryStore()
      : idbStore('arca-linkcheck', 'results');
  return shared;
}
export function setLinkStoreForTests(s: KeyValueStore<LinkResult> | null): void {
  shared = s;
}
export async function clearLinkResults(): Promise<void> {
  await store()
    .clear()
    .catch(() => {});
}

/**
 * Every fresh cached result, read in one go. Results older than two weeks
 * are deleted here, so the list of checked addresses doesn't pile up.
 */
async function loadResults(now: number): Promise<Map<string, LinkResult>> {
  const fresh = new Map<string, LinkResult>();
  const entries = await store()
    .entries()
    .catch(() => [] as Array<[string, LinkResult]>);
  for (const [url, raw] of entries) {
    const result = parseCached(raw);
    if (result && now - result.checkedAt < CACHE_TTL_MS) fresh.set(url, result);
    else
      void store()
        .delete(url)
        .catch(() => {});
  }
  return fresh;
}

/** Addresses the last check found broken (within the two-week window). */
export async function brokenUrls(now = Date.now()): Promise<Set<string>> {
  const out = new Set<string>();
  for (const [url, r] of await loadResults(now)) if (r.status === 'broken') out.add(url);
  return out;
}

/** Same page ignoring http→https, www., a trailing slash and the fragment. */
export function samePage(a: string, b: string): boolean {
  const norm = (u: string) => {
    try {
      const x = new URL(u);
      return `${x.hostname.replace(/^www\./, '')}${x.pathname.replace(/\/+$/, '')}${x.search}`;
    } catch {
      return u;
    }
  };
  return norm(a) === norm(b);
}

export function classify(code: number, url: string, finalUrl: string): LinkStatus {
  if (code === 0) return 'broken';
  if (code === 404 || code === 410 || (code >= 500 && code !== 503 && code < 600))
    return 'broken';
  if (code === 401 || code === 403 || code === 429 || code === 503) return 'unknown';
  if (code >= 200 && code < 400) return samePage(url, finalUrl) ? 'ok' : 'moved';
  return 'unknown';
}

/** Validates a cached result (IndexedDB is ours, but read defensively). */
function parseCached(raw: unknown): LinkResult | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  if (!['ok', 'moved', 'broken', 'unknown'].includes(r.status as string)) return null;
  if (typeof r.code !== 'number' || typeof r.checkedAt !== 'number') return null;
  const finalUrl =
    typeof r.finalUrl === 'string' && /^https?:\/\//i.test(r.finalUrl)
      ? r.finalUrl
      : undefined;
  return {
    status: r.status as LinkStatus,
    code: r.code,
    finalUrl,
    checkedAt: r.checkedAt,
  };
}

async function request(url: string, method: 'HEAD' | 'GET', signal?: AbortSignal) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  const onAbort = () => ctrl.abort();
  signal?.addEventListener('abort', onAbort);
  try {
    const res = await fetch(url, {
      method,
      credentials: 'omit',
      referrerPolicy: 'no-referrer',
      redirect: 'follow',
      cache: 'no-store',
      signal: ctrl.signal,
    });
    // Status and final address are all we need; never download the page.
    void res.body?.cancel().catch(() => {});
    return { code: res.status, finalUrl: res.url || url };
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', onAbort);
  }
}

/** Checks one URL (no cache). Throws AbortError if cancelled. */
export async function checkUrl(
  url: string,
  signal?: AbortSignal,
  now = Date.now(),
): Promise<LinkResult> {
  let code: number;
  let finalUrl: string;
  try {
    ({ code, finalUrl } = await request(url, 'HEAD', signal));
    // Some servers reject or mishandle HEAD; ask again with GET.
    if (code === 405 || code === 501 || code === 404 || code === 403) {
      ({ code, finalUrl } = await request(url, 'GET', signal));
    }
  } catch (e) {
    if (signal?.aborted) throw new DOMException('Cancelled', 'AbortError');
    const timedOut = e instanceof DOMException && e.name === 'AbortError';
    if (timedOut) return { status: 'unknown', code: 0, checkedAt: now };
    try {
      ({ code, finalUrl } = await request(url, 'GET', signal));
    } catch {
      if (signal?.aborted) throw new DOMException('Cancelled', 'AbortError');
      // DNS failure, refused connection, bad certificate…: the site is gone.
      return { status: 'broken', code: 0, checkedAt: now };
    }
  }
  const status = classify(code, url, finalUrl);
  return { status, code, ...(status === 'moved' ? { finalUrl } : {}), checkedAt: now };
}

export interface CheckItem {
  id: string;
  url: string;
}

/**
 * Checks many links (cached results reused unless `fresh`), calling back as
 * each finishes. Returns when all are done or the signal aborts.
 */
export async function checkAll(
  items: readonly CheckItem[],
  opts: {
    fresh?: boolean;
    signal?: AbortSignal;
    onResult(id: string, result: LinkResult): void;
    now?: () => number;
  },
): Promise<void> {
  const now = opts.now ?? Date.now;
  const known = await loadResults(now());
  const queue: CheckItem[] = [];
  for (const item of items) {
    if (opts.signal?.aborted) return;
    if (!/^https?:\/\//i.test(item.url)) continue;
    const cached = opts.fresh ? undefined : known.get(item.url);
    if (cached) opts.onResult(item.id, cached);
    else queue.push(item);
  }
  const perHost = new Map<string, number>();
  const host = (u: string) => {
    try {
      return new URL(u).hostname;
    } catch {
      return u;
    }
  };
  const take = (): CheckItem | undefined => {
    const i = queue.findIndex((it) => (perHost.get(host(it.url)) ?? 0) < PER_HOST);
    return i < 0 ? undefined : queue.splice(i, 1)[0];
  };
  const worker = async () => {
    while (queue.length && !opts.signal?.aborted) {
      const item = take();
      if (!item) {
        await new Promise((r) => setTimeout(r, 50));
        continue;
      }
      const h = host(item.url);
      perHost.set(h, (perHost.get(h) ?? 0) + 1);
      try {
        const result = await checkUrl(item.url, opts.signal, now());
        void store()
          .put(item.url, result)
          .catch(() => {});
        opts.onResult(item.id, result);
      } catch (e) {
        if (opts.signal?.aborted) return;
        throw e;
      } finally {
        perHost.set(h, (perHost.get(h) ?? 1) - 1);
      }
    }
  };
  await Promise.all(Array.from({ length: CONCURRENCY }, worker));
}
