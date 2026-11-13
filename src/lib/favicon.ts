import { browser } from 'wxt/browser';
import { displayHost } from './url';

export type FaviconSize = 16 | 32 | 64;

/**
 * URL for the browser's cached favicon of `pageUrl`, served by the MV3
 * `_favicon` endpoint (needs the "favicon" permission). No network request.
 */
export function faviconUrl(pageUrl: string, size: FaviconSize = 32): string {
  const query = new URLSearchParams({ pageUrl, size: String(size) });
  // `_favicon` is a browser-provided path, not one of our public files, so it
  // isn't in WXT's PublicPath union.
  const getURL = browser.runtime.getURL as (path: string) => string;
  return getURL(`/_favicon/?${query.toString()}`);
}

export interface LetterTile {
  letter: string;
  /** 0–359; stable per host so the same site always gets the same colour. */
  hue: number;
}

/** Fallback tile shown when a favicon is missing or fails to load. */
export function letterTile(title: string, url?: string): LetterTile {
  const host = url ? displayHost(url) : '';
  const source = title.trim() || host;
  const match = source.match(/[\p{L}\p{N}]/u);
  return {
    letter: match ? match[0].toLocaleUpperCase() : '?',
    hue: hashHue(host || source),
  };
}

function hashHue(text: string): number {
  let hash = 0;
  for (const char of text) {
    hash = (hash * 31 + (char.codePointAt(0) ?? 0)) >>> 0;
  }
  return hash % 360;
}
