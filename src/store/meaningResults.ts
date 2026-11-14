import { create } from 'zustand';
import type { SearchResult } from '@/src/features/search/search';

/**
 * "Related by meaning" rows currently shown under the keyword results, so the
 * search box's ↑↓ / Enter can move into them as one list.
 */
export const useMeaningResults = create<{
  results: SearchResult[];
  set(results: SearchResult[]): void;
}>()((set) => ({
  results: [],
  set: (results) => set({ results }),
}));
