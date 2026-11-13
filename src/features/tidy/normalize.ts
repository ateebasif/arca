/**
 * Canonical form of a URL for duplicate detection (PRD §8.8):
 * scheme-insensitive (http = https), lowercase host without "www.", default
 * port, trailing slash, tracking parameters and fragment removed, remaining
 * query parameters sorted. Non-web URLs are compared as-is.
 */

const TRACKING =
  /^(utm_[a-z]+|fbclid|gclid|dclid|msclkid|mc_eid|mc_cid|igshid|_hsenc|_hsmi|ref_src)$/i;

export function normalizeUrl(raw: string): string {
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    return raw.trim();
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return url.href;
  const host = url.hostname.toLowerCase().replace(/^www\./, '');
  const port = url.port && url.port !== '80' && url.port !== '443' ? `:${url.port}` : '';
  const params = [...url.searchParams.entries()]
    .filter(([key]) => !TRACKING.test(key))
    .sort(([a, av], [b, bv]) => (a === b ? av.localeCompare(bv) : a.localeCompare(b)));
  const query = params.length ? `?${new URLSearchParams(params).toString()}` : '';
  let path = url.pathname.replace(/\/+$/, '');
  try {
    path = decodeURI(path);
  } catch {
    // keep encoded
  }
  return `${host}${port}${path}${query}`;
}

/**
 * Shortens a long folder path for display: keeps the first segment and the
 * last two, e.g. "Imported / … / Trash / Bookmarks Bar (Chrome) (2)".
 */
export function compactPath(path: string, keepEnd = 2): string {
  const parts = path.split(' / ').filter(Boolean);
  if (parts.length <= keepEnd + 2) return parts.join(' / ');
  return [parts[0], '…', ...parts.slice(-keepEnd)].join(' / ');
}
