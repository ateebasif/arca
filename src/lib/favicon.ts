import { browser } from 'wxt/browser';
import { rgbToHsl, type CoverTone } from './color';
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

// -- default-icon detection ----------------------------------------------------
//
// For pages it has no icon for, Chrome's _favicon endpoint returns a generic
// globe instead of failing. We fingerprint that globe once and treat any
// favicon that matches it as missing, so the letter tile shows instead.

const SIGNATURE_SIZE = 16;
const defaultSignatures = new Map<string, Promise<string | null>>();

function signatureOf(img: HTMLImageElement): string | null {
  try {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = SIGNATURE_SIZE;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return null;
    ctx.drawImage(img, 0, 0, SIGNATURE_SIZE, SIGNATURE_SIZE);
    const { data } = ctx.getImageData(0, 0, SIGNATURE_SIZE, SIGNATURE_SIZE);
    let hash = 0;
    for (let i = 0; i < data.length; i++) hash = (hash * 31 + (data[i] ?? 0)) >>> 0;
    return `${hash}`;
  } catch {
    return null;
  }
}

/** Signature of the placeholder at a given requested size (it differs per size). */
function loadDefaultSignature(size: string): Promise<string | null> {
  let pending = defaultSignatures.get(size);
  if (!pending) {
    pending = new Promise((resolve) => {
      const img = new Image();
      img.onload = () => resolve(signatureOf(img));
      img.onerror = () => resolve(null);
      // A reserved, never-resolvable host, so this is always the placeholder.
      const query = new URLSearchParams({
        pageUrl: 'https://arca-default-icon.invalid/',
        size,
      });
      img.src = (browser.runtime.getURL as (path: string) => string)(
        `/_favicon/?${query.toString()}`,
      );
    });
    defaultSignatures.set(size, pending);
  }
  return pending;
}

/** True if a loaded favicon <img> is the browser's generic placeholder. */
export async function isDefaultFavicon(img: HTMLImageElement): Promise<boolean> {
  const size = new URL(img.src).searchParams.get('size') ?? '32';
  const reference = await loadDefaultSignature(size);
  if (!reference || !img.complete || img.naturalWidth === 0) return false;
  return signatureOf(img) === reference;
}

// -- brand colour ---------------------------------------------------------------

const toneCache = new Map<string, Promise<CoverTone>>();

/** Stable fallback hue for sites without a usable favicon (matches the letter tile). */
export function fallbackTone(title: string, url: string): CoverTone {
  return { hue: letterTile(title, url).hue, saturation: 62 };
}

/**
 * The favicon's dominant hue, read from the browser's favicon cache (no
 * network). Monochrome icons give `hue: null`; placeholders and failures give
 * the fallback hue. Cached per host.
 */
export function faviconTone(url: string, title: string): Promise<CoverTone> {
  const host = displayHost(url) || url;
  let pending = toneCache.get(host);
  if (pending) return pending;
  pending = new Promise<CoverTone>((resolve) => {
    const fallback = fallbackTone(title, url);
    if (typeof Image === 'undefined') return resolve(fallback);
    const img = new Image();
    img.onerror = () => resolve(fallback);
    img.onload = async () => {
      if (await isDefaultFavicon(img)) return resolve(fallback);
      try {
        const canvas = document.createElement('canvas');
        canvas.width = canvas.height = 16;
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        if (!ctx) return resolve(fallback);
        ctx.drawImage(img, 0, 0, 16, 16);
        const { data } = ctx.getImageData(0, 0, 16, 16);
        let x = 0;
        let y = 0;
        let weight = 0;
        let sat = 0;
        let opaque = 0;
        for (let i = 0; i < data.length; i += 4) {
          if ((data[i + 3] ?? 0) < 128) continue;
          opaque++;
          const { h, s, l } = rgbToHsl(data[i] ?? 0, data[i + 1] ?? 0, data[i + 2] ?? 0);
          if (s < 25 || l < 12 || l > 92) continue;
          const w = s / 100;
          x += Math.cos((h * Math.PI) / 180) * w;
          y += Math.sin((h * Math.PI) / 180) * w;
          sat += s * w;
          weight += w;
        }
        // Mostly black/white/grey pixels: a monochrome brand.
        if (opaque === 0 || weight < opaque * 0.08) {
          return resolve({ hue: null, saturation: 0 });
        }
        const hue = ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
        resolve({ hue, saturation: sat / weight });
      } catch {
        resolve(fallback);
      }
    };
    img.src = faviconUrl(url, 32);
  });
  toneCache.set(host, pending);
  return pending;
}
