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

/**
 * True for hosts on this machine or the local network: localhost, *.local,
 * loopback / private / link-local / CGNAT IPv4, and loopback, unique-local
 * and link-local IPv6. Used so a web page can't steer Arca's background
 * requests (link previews) at a router or a local dev server.
 */
export function isPrivateHost(url: string): boolean {
  let host: string;
  try {
    host = new URL(url).hostname.toLowerCase();
  } catch {
    return false;
  }
  if (!host) return false;
  if (
    host === 'localhost' ||
    /\.(localhost|local|internal|lan|home\.arpa)$/.test(host) ||
    (!host.includes('.') && !host.startsWith('[')) // single-label names resolve on the LAN
  ) {
    return true;
  }
  if (host.startsWith('[')) return isPrivateV6(host);
  // The URL parser normalises every IPv4 spelling (0x7f.1, 2130706433) to dotted form.
  const v4 = /^(\d+)\.(\d+)\.(\d+)\.(\d+)$/.exec(host);
  if (!v4) return false;
  const [a, b] = [Number(v4[1]), Number(v4[2])];
  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 100 && b >= 64 && b <= 127)
  );
}

function isPrivateV6(bracketed: string): boolean {
  const h = bracketed.slice(1, -1);
  if (h === '::1' || h === '::') return true;
  // IPv4-mapped (::ffff:7f00:1) — the parser emits hex groups.
  const mapped = /^::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/.exec(h);
  if (mapped) {
    const n = parseInt(mapped[1] ?? '0', 16);
    return isPrivateHost(`http://${n >> 8}.${n & 255}.0.0/`);
  }
  return /^f[cd][0-9a-f]{0,2}:/.test(h) || /^fe[89ab][0-9a-f]?:/.test(h);
}
