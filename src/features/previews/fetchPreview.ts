import { parsePreviewHtml, type PreviewMeta } from './parse';

/**
 * Network side of link previews. Hardened for untrusted sites:
 * - only http(s) GETs, no cookies or credentials, no referrer;
 * - timeouts, and hard caps on how much HTML / image data is read;
 * - only HTML is parsed; only raster images are accepted (no SVG), and they are
 *   decoded and re-encoded to a small WebP, so what's stored is plain pixels.
 */

export const PAGE_TIMEOUT_MS = 8000;
export const IMAGE_TIMEOUT_MS = 8000;
export const MAX_HTML_BYTES = 768 * 1024;
export const MAX_IMAGE_BYTES = 3 * 1024 * 1024;
export const THUMB_WIDTH = 480;
const IMAGE_TYPES = /^image\/(png|jpe?g|webp|gif|avif)$/;

export interface FetchedPreview extends Omit<PreviewMeta, 'imageUrl'> {
  /** data: URL of the re-encoded thumbnail, or '' when there's no image. */
  image: string;
  /** Final URL after redirects. */
  finalUrl: string;
}

export class PreviewError extends Error {}

const REQUEST: RequestInit = {
  method: 'GET',
  credentials: 'omit',
  referrerPolicy: 'no-referrer',
  redirect: 'follow',
  cache: 'default',
  mode: 'cors',
};

/** Reads at most `max` bytes of a response body. */
async function readCapped(res: Response, max: number): Promise<Uint8Array<ArrayBuffer>> {
  const declared = Number(res.headers.get('content-length') ?? 0);
  if (declared > max * 4) throw new PreviewError('Response too large');
  const reader = res.body?.getReader();
  if (!reader) return new Uint8Array(await res.arrayBuffer()).slice(0, max);
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (total < max) {
    const { done, value } = await reader.read();
    if (done || !value) break;
    chunks.push(value);
    total += value.byteLength;
  }
  void reader.cancel().catch(() => {});
  const out = new Uint8Array(Math.min(total, max));
  let offset = 0;
  for (const chunk of chunks) {
    const take = Math.min(chunk.byteLength, out.length - offset);
    out.set(chunk.subarray(0, take), offset);
    offset += take;
    if (offset >= out.length) break;
  }
  return out;
}

function withTimeout(ms: number, parent?: AbortSignal): AbortSignal {
  return parent
    ? AbortSignal.any([parent, AbortSignal.timeout(ms)])
    : AbortSignal.timeout(ms);
}

function isHttp(url: string): boolean {
  try {
    const { protocol } = new URL(url);
    return protocol === 'https:' || protocol === 'http:';
  } catch {
    return false;
  }
}

export type ImageEncoder = (blob: Blob) => Promise<string>;

/** Decodes an image and re-encodes it as a small WebP data: URL. */
export const encodeThumbnail: ImageEncoder = async (blob) => {
  const bitmap = await createImageBitmap(blob);
  try {
    const scale = Math.min(1, THUMB_WIDTH / bitmap.width);
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));
    const canvas = new OffscreenCanvas(width, height);
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new PreviewError('No canvas');
    ctx.drawImage(bitmap, 0, 0, width, height);
    const webp = await canvas.convertToBlob({ type: 'image/webp', quality: 0.78 });
    return await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(webp);
    });
  } finally {
    bitmap.close();
  }
};

async function fetchImage(
  url: string,
  encode: ImageEncoder,
  signal?: AbortSignal,
): Promise<string> {
  if (!url) return '';
  try {
    const res = await fetch(url, {
      ...REQUEST,
      headers: { Accept: 'image/avif,image/webp,image/png,image/jpeg,image/gif' },
      signal: withTimeout(IMAGE_TIMEOUT_MS, signal),
    });
    const type =
      (res.headers.get('content-type') ?? '').split(';')[0]?.trim().toLowerCase() ?? '';
    if (!res.ok || !IMAGE_TYPES.test(type)) return '';
    const bytes = await readCapped(res, MAX_IMAGE_BYTES);
    if (bytes.byteLength >= MAX_IMAGE_BYTES) return '';
    return await encode(new Blob([bytes], { type }));
  } catch {
    // A missing image shouldn't fail the whole preview.
    return '';
  }
}

export async function fetchPreview(
  url: string,
  {
    encode = encodeThumbnail,
    signal,
  }: { encode?: ImageEncoder; signal?: AbortSignal } = {},
): Promise<FetchedPreview> {
  if (!isHttp(url)) throw new PreviewError('Only web pages have previews');
  const res = await fetch(url, {
    ...REQUEST,
    headers: { Accept: 'text/html,application/xhtml+xml' },
    signal: withTimeout(PAGE_TIMEOUT_MS, signal),
  });
  if (!res.ok) throw new PreviewError(`HTTP ${res.status}`);
  const finalUrl = isHttp(res.url) ? res.url : url;
  const type = (res.headers.get('content-type') ?? '').toLowerCase();
  if (!/text\/html|application\/xhtml\+xml/.test(type)) {
    throw new PreviewError('Not an HTML page');
  }
  const bytes = await readCapped(res, MAX_HTML_BYTES);
  const html = new TextDecoder('utf-8', { fatal: false }).decode(bytes);
  const meta = parsePreviewHtml(html, finalUrl);
  const image = await fetchImage(meta.imageUrl, encode, signal);
  return {
    title: meta.title,
    description: meta.description,
    siteName: meta.siteName,
    excerpt: meta.excerpt,
    headings: meta.headings,
    image,
    finalUrl,
  };
}
