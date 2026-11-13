import { idbStore, memoryStore, type KeyValueStore } from '@/src/lib/idb';

/**
 * Embedding cache in IndexedDB (private to Arca), keyed by model + a hash of
 * the exact text embedded, so only new or edited bookmarks are re-embedded.
 */

export function textHash(text: string): string {
  // FNV-1a, two 32-bit lanes → 16 hex chars.
  let h1 = 0x811c9dc5;
  let h2 = 0x01000193;
  for (let i = 0; i < text.length; i++) {
    const c = text.charCodeAt(i);
    h1 = Math.imul(h1 ^ c, 0x01000193) >>> 0;
    h2 = Math.imul(h2 ^ c, 0x5bd1e995) >>> 0;
  }
  return h1.toString(16).padStart(8, '0') + h2.toString(16).padStart(8, '0');
}

let shared: KeyValueStore<unknown> | null = null;
export function embeddingStore(): KeyValueStore<unknown> {
  shared ??=
    typeof indexedDB === 'undefined' ? memoryStore() : idbStore('arca-ai', 'embeddings');
  return shared;
}
export function setEmbeddingStoreForTests(store: KeyValueStore<unknown> | null): void {
  shared = store;
  memoryVectors.clear();
}

/**
 * Normalized vectors already read this session, so repeat questions don't
 * re-read thousands of IndexedDB entries. Cleared with the stored cache.
 */
export const memoryVectors = new Map<string, Float32Array>();
const MEMORY_MAX = 20_000;
export function rememberVector(key: string, vector: Float32Array): void {
  if (memoryVectors.size >= MEMORY_MAX) {
    const oldest = memoryVectors.keys().next().value;
    if (oldest !== undefined) memoryVectors.delete(oldest);
  }
  memoryVectors.set(key, vector);
}

export const cacheKey = (model: string, text: string) => `${model}|${textHash(text)}`;

/** Reads a cached vector, validating that it's a non-empty number array. */
export async function readCached(model: string, text: string): Promise<number[] | null> {
  const raw = await embeddingStore()
    .get(cacheKey(model, text))
    .catch(() => undefined);
  if (raw instanceof Float32Array) return Array.from(raw);
  if (Array.isArray(raw) && raw.length > 0 && raw.every((x) => typeof x === 'number')) {
    return raw as number[];
  }
  return null;
}

export async function writeCached(
  model: string,
  text: string,
  vector: number[],
): Promise<void> {
  await embeddingStore()
    .put(cacheKey(model, text), Float32Array.from(vector))
    .catch(() => {});
}

export async function clearEmbeddings(): Promise<void> {
  memoryVectors.clear();
  await embeddingStore()
    .clear()
    .catch(() => {});
}
