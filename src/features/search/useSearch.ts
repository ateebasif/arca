import { useMemo } from 'react';
import { cleanTag } from '@/src/features/tags/meta';
import { useMeta } from '@/src/store/useMeta';
import { useBookmarks } from '@/src/store/useBookmarks';
import { useUi } from '@/src/store/ui';
import { buildIndex, search, tokenize, type SearchResult } from './search';

export const RESULT_LIMIT = 50;
export const RESULTS_ID = 'arca-search-results';
export const resultId = (index: number) => `arca-result-${index}`;

/**
 * Results for the current query, recomputed only when the query, tree or tags
 * change. "#tag" lists everything with a matching tag; otherwise tags count as
 * matches too, after the title/URL/folder results.
 */
export function useSearchResults(): SearchResult[] {
  const state = useBookmarks();
  const meta = useMeta();
  const query = useUi((s) => s.query);
  const inFolder = useUi((s) => s.searchInFolder);
  const folderId = useUi((s) => s.currentFolderId);
  return useMemo(() => {
    const withinFolderId = inFolder ? folderId : undefined;
    const tagged = (match: (tag: string) => boolean): SearchResult[] =>
      buildIndex(state)
        .filter(
          (e) =>
            (!withinFolderId || e.ancestorIds.includes(withinFolderId)) &&
            (meta.byId.get(e.node.id)?.tags ?? []).some(match),
        )
        .map((entry) => ({ entry, score: 1, copies: [] }));

    if (query.trim().startsWith('#')) {
      const t = cleanTag(query);
      return tagged((tag) => !t || tag.startsWith(t)).slice(0, RESULT_LIMIT);
    }
    const results = search(state, query, { limit: RESULT_LIMIT, withinFolderId });
    if (meta.byId.size === 0 || results.length >= RESULT_LIMIT) return results;
    const words = tokenize(query).filter((w) => w.length >= 2);
    if (!words.length) return results;
    const seen = new Set(results.map((r) => r.entry.node.id));
    const extra = tagged((tag) => words.some((w) => tag.startsWith(w))).filter(
      (r) => !seen.has(r.entry.node.id),
    );
    return [...results, ...extra].slice(0, RESULT_LIMIT);
  }, [state, meta, query, inFolder, folderId]);
}
