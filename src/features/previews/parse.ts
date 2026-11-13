/**
 * Extracts preview metadata from untrusted HTML.
 *
 * DOMParser builds an inert document: scripts never run and no subresources
 * load. Only a few attribute/text values are read, and every value is cleaned
 * and length-capped before it's stored. Nothing here is ever rendered as HTML.
 */

export interface PreviewMeta {
  title: string;
  description: string;
  siteName: string;
  /** Absolute http(s) URL of the preview image, if any. */
  imageUrl: string;
}

export const LIMITS = { title: 200, description: 400, siteName: 80, url: 2048 };

/** Control, zero-width and bidi-override characters that could disguise text. */
function isHiddenChar(code: number): boolean {
  return (
    code <= 0x1f ||
    (code >= 0x7f && code <= 0x9f) ||
    (code >= 0x200b && code <= 0x200f) ||
    (code >= 0x202a && code <= 0x202e) ||
    (code >= 0x2066 && code <= 0x2069)
  );
}

/** Collapses whitespace, strips hidden characters and caps the length. */
export function cleanText(value: string | null | undefined, max: number): string {
  if (!value) return '';
  let out = '';
  for (const char of value) out += isHiddenChar(char.codePointAt(0) ?? 0) ? ' ' : char;
  const cleaned = out.replace(/\s+/g, ' ').trim();
  return cleaned.length > max ? `${cleaned.slice(0, max - 1).trimEnd()}…` : cleaned;
}

/** Resolves `value` against `base`; returns it only if it's an http(s) URL. */
export function safeHttpUrl(value: string | null | undefined, base: string): string {
  if (!value) return '';
  try {
    const url = new URL(value.trim(), base);
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return '';
    return url.href.length <= LIMITS.url ? url.href : '';
  } catch {
    return '';
  }
}

function meta(doc: Document, ...keys: string[]): string | null {
  for (const key of keys) {
    const el =
      doc.querySelector(`meta[property="${key}"]`) ??
      doc.querySelector(`meta[name="${key}"]`);
    const content = el?.getAttribute('content');
    if (content?.trim()) return content;
  }
  return null;
}

export function parsePreviewHtml(html: string, pageUrl: string): PreviewMeta {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  // A <base href> could re-point relative URLs; only trust the real page URL.
  const base = pageUrl;
  return {
    title: cleanText(meta(doc, 'og:title', 'twitter:title') ?? doc.title, LIMITS.title),
    description: cleanText(
      meta(doc, 'og:description', 'twitter:description', 'description'),
      LIMITS.description,
    ),
    siteName: cleanText(meta(doc, 'og:site_name', 'application-name'), LIMITS.siteName),
    imageUrl: safeHttpUrl(
      meta(
        doc,
        'og:image:secure_url',
        'og:image',
        'og:image:url',
        'twitter:image',
        'twitter:image:src',
      ),
      base,
    ),
  };
}
