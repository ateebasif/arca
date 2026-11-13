import { useMemo } from 'react';
import { useBookmarks } from '@/src/store/useBookmarks';
import { useUi } from '@/src/store/ui';
import { search, type SearchResult } from './search';

export const RESULT_LIMIT = 50;
export const RESULTS_ID = 'arca-search-results';
export const resultId = (index: number) => `arca-result-${index}`;

/** Results for the current query, recomputed only when the query or tree changes. */
export function useSearchResults(): SearchResult[] {
  const state = useBookmarks();
  const query = useUi((s) => s.query);
  const inFolder = useUi((s) => s.searchInFolder);
  const folderId = useUi((s) => s.currentFolderId);
  return useMemo(
    () =>
      search(state, query, {
        limit: RESULT_LIMIT,
        withinFolderId: inFolder ? folderId : undefined,
      }),
    [state, query, inFolder, folderId],
  );
}
