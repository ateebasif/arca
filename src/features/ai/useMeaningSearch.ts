import { useEffect, useState } from 'react';
import { askItems } from './askItems';
import { useSettings } from '@/src/store/settings';
import { useBookmarks } from '@/src/store/useBookmarks';

/**
 * "Related by meaning" for a search query (local AI on, 3+ characters).
 * Debounced; the AI module loads on first use. `ready` is false while
 * loading, and `covered` says how much of the library has been read.
 */
export function useMeaningSearch(
  query: string,
  exclude: readonly string[],
): { ids: string[]; loading: boolean; covered: number; on: boolean } {
  const state = useBookmarks();
  const ai = useSettings((s) => s.aiEnabled);
  const base = useSettings((s) => s.ollamaUrl);
  const model = useSettings((s) => s.embedModel);
  const [result, setResult] = useState<{ q: string; ids: string[]; covered: number }>({
    q: '',
    ids: [],
    covered: 1,
  });
  const q = query.trim();
  const on = ai && q.length >= 3 && !q.startsWith('#');
  const excludeKey = exclude.join(',');

  useEffect(() => {
    if (!on || !state.ready) return;
    const ctrl = new AbortController();
    const timer = setTimeout(() => {
      void import('./meaningSearch')
        .then(({ meaningMatches }) =>
          meaningMatches(
            askItems(state),
            q,
            { base, embedModel: model, signal: ctrl.signal },
            new Set(exclude),
          ),
        )
        .then((r) => !ctrl.signal.aborted && setResult({ q, ...r }))
        .catch(() => !ctrl.signal.aborted && setResult({ q, ids: [], covered: 1 }));
    }, 300);
    return () => {
      clearTimeout(timer);
      ctrl.abort();
    };
    // exclude is compared by its key.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [on, q, state, base, model, excludeKey]);

  const fresh = result.q === q;
  return {
    ids: on && fresh ? result.ids : [],
    loading: on && !fresh,
    covered: result.covered,
    on,
  };
}
