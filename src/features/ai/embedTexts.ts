import { embed } from '@/src/lib/ollama';
import {
  cacheKey,
  memoryVectors,
  readManyCached,
  rememberVector,
  writeCached,
} from './embedCache';
import { normalize } from './kmeans';

/**
 * Embeds texts with a local Ollama model, reusing cached vectors (memory, then
 * IndexedDB) and sending only the missing ones, in small batches.
 */

const EMBED_BATCH = 32;

export interface EmbedProgress {
  done: number;
  total: number;
  /** Items served from the cache. */
  cached: number;
  /** Indexes (into texts) of the batch being embedded now. */
  batch?: number[];
}

export interface EmbedTextsOptions {
  base: string;
  model: string;
  signal?: AbortSignal;
  onProgress?(p: EmbedProgress): void;
  /**
   * Save new vectors in IndexedDB (default). Off for search queries and
   * questions: what you typed is kept in memory only, never on disk.
   */
  persist?: boolean;
}

function throwIfAborted(signal?: AbortSignal) {
  if (signal?.aborted) throw new DOMException('Cancelled', 'AbortError');
}

/** Unit-length vectors, one per text, in order. */
export async function embedTexts(
  texts: string[],
  opts: EmbedTextsOptions,
): Promise<Float32Array[]> {
  const { base, model, persist = true } = opts;
  const out: (Float32Array | null)[] = persist
    ? await readManyCached(model, texts, normalize)
    : // Memory only: a repeat query this session is free, nothing touches disk.
      texts.map((t) => memoryVectors.get(cacheKey(model, t)) ?? null);
  const missing = out.flatMap((v, i) => (v ? [] : [i]));
  const cached = texts.length - missing.length;
  let done = cached;
  for (let start = 0; start < missing.length; start += EMBED_BATCH) {
    throwIfAborted(opts.signal);
    const batch = missing.slice(start, start + EMBED_BATCH);
    opts.onProgress?.({ done, total: texts.length, cached, batch });
    const batchTexts = batch.map((i) => texts[i] ?? '');
    const result = await embed(base, model, batchTexts, opts.signal);
    batch.forEach((i, j) => {
      const raw = result[j];
      if (!raw) return;
      const text = batchTexts[j] ?? '';
      const v = normalize(raw);
      out[i] = v;
      rememberVector(cacheKey(model, text), v);
      if (persist) void writeCached(model, text, raw);
    });
    done += batch.length;
  }
  opts.onProgress?.({ done, total: texts.length, cached });
  return out.map((v) => v ?? new Float32Array(0));
}

/** Cosine similarity of two unit vectors (0 when sizes differ). */
export function similarity(a: Float32Array, b: Float32Array): number {
  if (a.length !== b.length || a.length === 0) return 0;
  let s = 0;
  for (let i = 0; i < a.length; i++) s += (a[i] ?? 0) * (b[i] ?? 0);
  return s;
}
