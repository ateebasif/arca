/** Hostname without a leading `www.`, or '' when the URL can't be parsed. */
export function displayHost(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return '';
  }
}

// Second-level labels used under country TLDs (example.co.uk, example.com.pk).
const SECOND_LEVEL = new Set(['co', 'com', 'net', 'org', 'gov', 'edu', 'ac', 'gen']);

/**
 * The main domain for display: "docs.github.com" → "github.com",
 * "shop.example.co.uk" → "example.co.uk". IPs and localhost are kept as-is.
 */
export function mainDomain(url: string): string {
  const host = displayHost(url);
  if (!host || /^[\d.]+$|^\[|^localhost$/.test(host)) return host;
  const labels = host.split('.');
  if (labels.length <= 2) return host;
  const take =
    SECOND_LEVEL.has(labels.at(-2) ?? '') && (labels.at(-1)?.length ?? 0) === 2 ? 3 : 2;
  return labels.slice(-take).join('.');
}

/**
 * How Arca may open a URL.
 * - `web`: normal pages; rendered as real links.
 * - `browser`: browser-internal pages (chrome://, file://…); opened through the
 *   tabs API because extension pages can't link to them directly.
 * - `blocked`: schemes that can run code or smuggle content (javascript:, data:,
 *   blob:, vbscript:, unknown). Arca never opens or links these.
 */
export type UrlKind = 'web' | 'browser' | 'blocked';

const WEB = new Set(['http:', 'https:', 'ftp:']);
const BROWSER = new Set([
  'chrome:',
  'edge:',
  'brave:',
  'opera:',
  'vivaldi:',
  'about:',
  'file:',
  'chrome-extension:',
  'view-source:',
]);

export function classifyUrl(url: string | undefined): UrlKind {
  if (!url) return 'blocked';
  let protocol: string;
  try {
    protocol = new URL(url.trim()).protocol.toLowerCase();
  } catch {
    return 'blocked';
  }
  if (WEB.has(protocol)) return 'web';
  if (BROWSER.has(protocol)) return 'browser';
  return 'blocked';
}

/** `href` to render for a bookmark, or undefined when it mustn't be a link. */
export function safeHref(url: string | undefined): string | undefined {
  return classifyUrl(url) === 'web' ? url : undefined;
}
