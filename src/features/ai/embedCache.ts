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
  forgetMemoryVectors();
}

/**
 * Normalized vectors already read this session, so repeat questions don't
 * re-read thousands of IndexedDB entries. Cleared with the stored cache.
 */
export const memoryVectors = new Map<string, Float32Array>();
/** Cap by size, not count: big models have 2,560 numbers per vector. */
const MEMORY_MAX_BYTES = 96 * 1024 * 1024;
let memoryBytes = 0;
export function rememberVector(key: string, vector: Float32Array): void {
  const old = memoryVectors.get(key);
  if (old) {
    memoryBytes -= old.byteLength;
    memoryVectors.delete(key);
  }
  while (memoryBytes + vector.byteLength > MEMORY_MAX_BYTES && memoryVectors.size) {
    const [oldestKey, oldest] = memoryVectors.entries().next().value as [
      string,
      Float32Array,
    ];
    memoryVectors.delete(oldestKey);
    memoryBytes -= oldest.byteLength;
  }
  memoryVectors.set(key, vector);
  memoryBytes += vector.byteLength;
}

/** Drops every vector held in memory (AI turned off, cache cleared). */
export function forgetMemoryVectors(): void {
  memoryVectors.clear();
  memoryBytes = 0;
  knownMissing.clear();
}

export const cacheKey = (model: string, text: string) => `${model}|${textHash(text)}`;

/**
 * Keys known to be absent from IndexedDB this session, so a library that
 * hasn't been read yet isn't re-scanned on every search keystroke.
 */
const knownMissing = new Set<string>();
// Another Arca tab may save readings meanwhile; re-check after a minute.
let missingSince = 0;
const MISSING_TTL_MS = 60_000;

function validVector(raw: unknown): number[] | null {
  if (raw instanceof Float32Array) return Array.from(raw);
  if (Array.isArray(raw) && raw.length > 0 && raw.every((x) => typeof x === 'number')) {
    return raw as number[];
  }
  return null;
}

/**
 * Vectors for many texts: memory first, then one IndexedDB transaction for
 * the rest. Returns unit vectors (or null where nothing is cached).
 */
export async function readManyCached(
  model: string,
  texts: readonly string[],
  normalizeVector: (v: number[]) => Float32Array,
): Promise<(Float32Array | null)[]> {
  if (Date.now() - missingSince > MISSING_TTL_MS) {
    knownMissing.clear();
    missingSince = Date.now();
  }
  const keys = texts.map((t) => cacheKey(model, t));
  const out: (Float32Array | null)[] = keys.map((k) => memoryVectors.get(k) ?? null);
  const todo = keys.flatMap((k, i) => (out[i] || knownMissing.has(k) ? [] : [i]));
  const raws = await embeddingStore()
    .getMany(todo.map((i) => keys[i] ?? ''))
    .catch(() => todo.map(() => undefined));
  todo.forEach((i, j) => {
    const key = keys[i] ?? '';
    const stored = validVector(raws[j]);
    if (!stored) {
      knownMissing.add(key);
      return;
    }
    const v = normalizeVector(stored);
    rememberVector(key, v);
    out[i] = v;
  });
  return out;
}

/** Reads a cached vector, validating that it's a non-empty number array. */
export async function readCached(model: string, text: string): Promise<number[] | null> {
  const raw = await embeddingStore()
    .get(cacheKey(model, text))
    .catch(() => undefined);
  return validVector(raw);
}

export async function writeCached(
  model: string,
  text: string,
  vector: number[],
): Promise<void> {
  const key = cacheKey(model, text);
  knownMissing.delete(key);
  await embeddingStore()
    .put(key, Float32Array.from(vector))
    .catch(() => {});
}

export async function clearEmbeddings(): Promise<void> {
  forgetMemoryVectors();
  await embeddingStore()
    .clear()
    .catch(() => {});
}
