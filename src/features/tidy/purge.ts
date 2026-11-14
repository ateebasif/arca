import type { BNode, BookmarkSnapshot } from '@/src/store/bookmarkStore';
import { linksWithin } from '@/src/store/selectors';

/**
 * "Clean out": finds bookmarks that were probably saved on impulse and aren't
 * worth keeping. Everything here is a suggestion; nothing is removed without
 * review, and the default action archives rather than deletes.
 *
 * Signals are read from the bookmark itself (no browsing history):
 * search-result pages, local/temporary addresses, one-time pages (sign-in,
 * checkout, password reset…), titles that say nothing, and age.
 */

export type PurgeReason = 'broken' | 'search' | 'local' | 'one-time' | 'vague' | 'old';

export interface PurgeItem {
  node: BNode;
  folder: string;
  reasons: PurgeReason[];
}

export interface PurgeGroup {
  reason: PurgeReason;
  label: string;
  hint: string;
  items: PurgeItem[];
}

const YEAR = 365 * 24 * 60 * 60 * 1000;
export const OLD_AFTER_YEARS = 3;

export const LABELS: Record<PurgeReason, { label: string; hint: string }> = {
  broken: {
    label: 'Broken links',
    hint: 'The page is gone (404/410), the server errors, or the site no longer exists.',
  },
  search: {
    label: 'Search result pages',
    hint: 'Saved searches go stale; search again when you need it.',
  },
  local: {
    label: 'Local and temporary links',
    hint: 'localhost, tunnels and preview deploys rarely work later.',
  },
  'one-time': {
    label: 'One-time pages',
    hint: 'Sign-in, checkout, password reset, order tracking and similar.',
  },
  vague: {
    label: "Titles that don't say what it is",
    hint: 'No title, just the address, or "page" / "untitled".',
  },
  old: {
    label: `Saved over ${OLD_AFTER_YEARS} years ago`,
    hint: "Your browser doesn't record when bookmarks were last opened, so age is the best hint here.",
  },
};

const SEARCH_PATH = /(^|\/)(search|results?|find|query)(\/|\.|$)/i;
const SEARCH_PARAMS = [
  'q',
  'query',
  'search',
  's',
  'k',
  'keyword',
  'keywords',
  'search_query',
  'term',
];
const SEARCH_HOSTS =
  /(^|\.)(google|bing|duckduckgo|yahoo|yandex|baidu|ecosia|startpage|kagi)\./i;

const LOCAL_HOST =
  /^(localhost|127\.\d+\.\d+\.\d+|0\.0\.0\.0|\[::1\]|10\.\d+\.\d+\.\d+|192\.168\.\d+\.\d+|.+\.local|.+\.test)$/i;
const TUNNEL_HOST =
  /(ngrok(-free)?\.(io|app|dev)|trycloudflare\.com|loca\.lt|localtunnel\.me|serveo\.net)$/i;
// Preview deploys with a random-looking hash, e.g. app-git-branch-x8k2.vercel.app.
const PREVIEW_HOST =
  /-[a-z0-9]{6,}(-[a-z0-9-]+)?\.(vercel\.app|netlify\.app|pages\.dev)$/i;

const ONE_TIME_PATH =
  /(^|[/_-])(log-?in|sign-?in|sign-?up|register|logout|checkout|cart|basket|payment|pay|verify|verification|confirm|activate|reset-?password|forgot-?password|password-?reset|unsubscribe|oauth|callback|authorize|invoice|receipt|order-?status|track(ing)?|thank-?you|success)([/_.?-]|$)/i;

const VAGUE_TITLES =
  /^(page|untitled|new tab|index|home|document|loading\.*|redirecting\.*|\d+)$/i;

function parse(url: string): URL | null {
  try {
    return new URL(url);
  } catch {
    return null;
  }
}

/** Why a bookmark looks disposable (empty when it looks worth keeping). */
export function purgeReasons(node: BNode, now = Date.now()): PurgeReason[] {
  const reasons: PurgeReason[] = [];
  const url = node.url ?? '';
  const u = parse(url);
  if (!u) return reasons;
  const host = u.hostname;

  const searchParam = SEARCH_PARAMS.some(
    (p) => (u.searchParams.get(p) ?? '').trim().length > 1,
  );
  if (
    (SEARCH_HOSTS.test(host) && (u.pathname.startsWith('/search') || searchParam)) ||
    (searchParam &&
      (SEARCH_PATH.test(u.pathname) || u.pathname === '/' || u.pathname === '')) ||
    (host.endsWith('youtube.com') && u.pathname.startsWith('/results'))
  ) {
    reasons.push('search');
  }
  if (
    u.protocol === 'file:' ||
    LOCAL_HOST.test(host) ||
    TUNNEL_HOST.test(host) ||
    PREVIEW_HOST.test(host)
  ) {
    reasons.push('local');
  }
  if (ONE_TIME_PATH.test(u.pathname)) reasons.push('one-time');

  const title = node.title.trim();
  if (!title || title === url || title === host || VAGUE_TITLES.test(title))
    reasons.push('vague');

  if (node.dateAdded && now - node.dateAdded > OLD_AFTER_YEARS * YEAR)
    reasons.push('old');
  return reasons;
}

/** Groups the web links under `baseId` by reason (an item can be in several). */
export function analyzePurge(
  state: BookmarkSnapshot,
  baseId: string,
  now = Date.now(),
): PurgeGroup[] {
  const groups = new Map<PurgeReason, PurgeItem[]>();
  for (const link of linksWithin(state, baseId)) {
    if (!link.node.url || !/^(https?|file):/i.test(link.node.url)) continue;
    const reasons = purgeReasons(link.node, now);
    for (const reason of reasons) {
      const list = groups.get(reason) ?? [];
      list.push({ node: link.node, folder: link.folderLabel, reasons });
      groups.set(reason, list);
    }
  }
  const order: PurgeReason[] = ['search', 'local', 'one-time', 'vague', 'old'];
  return order.flatMap((reason) => {
    const items = groups.get(reason);
    if (!items?.length) return [];
    items.sort((a, b) => a.node.dateAdded - b.node.dateAdded);
    return [{ reason, ...LABELS[reason], items }];
  });
}
