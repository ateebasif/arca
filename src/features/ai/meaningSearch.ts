import { cacheKey, memoryVectors, readCached, rememberVector } from './embedCache';
import { embedTexts, similarity } from './embedTexts';
import { docText, keepClose, queryText, type AskItem } from './ask';
import { normalize } from './kmeans';

/**
 * Meaning matches for the normal search box. Uses only bookmark readings that
 * are already cached (from Ask Arca or AI organize) and embeds just the query,
 * so it never starts reading the whole library from a keystroke.
 */

export interface MeaningOptions {
  base: string;
  embedModel: string;
  signal?: AbortSignal;
}

/** Cached vectors for these items (memory first, then IndexedDB; no network). */
export async function cachedVectors(
  items: readonly AskItem[],
  model: string,
): Promise<{ vectors: (Float32Array | null)[]; missing: number }> {
  let missing = 0;
  const vectors = await Promise.all(
    items.map(async (it) => {
      const text = docText(model, it);
      const key = cacheKey(model, text);
      const hit = memoryVectors.get(key);
      if (hit) return hit;
      const stored = await readCached(model, text);
      if (!stored) {
        missing++;
        return null;
      }
      const v = normalize(stored);
      rememberVector(key, v);
      return v;
    }),
  );
  return { vectors, missing };
}

/**
 * Ids of items close in meaning to `query`, best first (at most `limit`),
 * leaving out `exclude` (e.g. the keyword results already shown).
 */
export async function meaningMatches(
  items: readonly AskItem[],
  query: string,
  opts: MeaningOptions,
  exclude: ReadonlySet<string> = new Set(),
  limit = 8,
): Promise<{ ids: string[]; covered: number }> {
  const { vectors, missing } = await cachedVectors(items, opts.embedModel);
  const covered = items.length ? (items.length - missing) / items.length : 0;
  if (missing === items.length) return { ids: [], covered: 0 };
  const [q] = await embedTexts([queryText(opts.embedModel, query)], {
    base: opts.base,
    model: opts.embedModel,
    signal: opts.signal,
  });
  if (!q) return { ids: [], covered };
  const scores = new Float32Array(items.length);
  vectors.forEach((v, i) => (scores[i] = v ? similarity(v, q) : -1));
  const order = [...scores.keys()]
    .filter((i) => vectors[i])
    .sort((a, b) => (scores[b] ?? 0) - (scores[a] ?? 0))
    .slice(0, 40);
  // Only clearly-related ones (relative to how alike a typical bookmark is).
  const close = keepClose(order, scores, new Set());
  const ids = close
    .map((i) => items[i]?.id ?? '')
    .filter((id) => id && !exclude.has(id))
    .slice(0, limit);
  return { ids, covered };
}
