import { create } from 'zustand';
import { onStorageChange, storageGet, storageSet } from '@/src/lib/storage';
import { NO_FILTERS, type SearchFilters } from './ui';

/** A search you saved: its text and filters, re-run from the sidebar. */
export interface SavedSearch {
  id: string;
  name: string;
  query: string;
  filters: SearchFilters;
}

const KEY = 'savedSearches';
export const SAVED_MAX = 30;

/** Validates what's stored; anything malformed is dropped. */
export function parseSaved(raw: unknown): SavedSearch[] {
  if (!Array.isArray(raw)) return [];
  const out: SavedSearch[] = [];
  for (const v of raw.slice(0, SAVED_MAX)) {
    if (!v || typeof v !== 'object') continue;
    const r = v as Record<string, unknown>;
    const f = (r.filters && typeof r.filters === 'object' ? r.filters : {}) as Record<
      string,
      unknown
    >;
    if (typeof r.id !== 'string' || !/^[\w-]{1,40}$/.test(r.id)) continue;
    if (typeof r.query !== 'string' || !r.query.trim()) continue;
    out.push({
      id: r.id,
      name: (typeof r.name === 'string' ? r.name : r.query)
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, 60),
      query: r.query.slice(0, 200),
      filters: {
        tag: typeof f.tag === 'string' ? f.tag.slice(0, 32) : null,
        note: f.note === true,
        duplicates: f.duplicates === true,
        broken: f.broken === true,
      },
    });
  }
  return out;
}

interface SavedState {
  list: SavedSearch[];
  loaded: boolean;
  load(): Promise<void>;
  save(name: string, query: string, filters: SearchFilters): Promise<void>;
  remove(id: string): Promise<void>;
}

let off: (() => void) | null = null;

export const useSavedSearches = create<SavedState>()((set, get) => ({
  list: [],
  loaded: false,
  async load() {
    if (get().loaded) return;
    set({ list: parseSaved(await storageGet<unknown>(KEY, [])), loaded: true });
    // Other Arca tabs save and remove too.
    off ??= onStorageChange<unknown>(KEY, (raw) => set({ list: parseSaved(raw) }));
  },
  async save(name, query, filters) {
    await get().load(); // never overwrite a list we haven't read
    const item: SavedSearch = {
      id: Math.random().toString(36).slice(2, 10),
      name: name.trim() || query.trim(),
      query: query.trim(),
      filters: { ...NO_FILTERS, ...filters },
    };
    // Same search saved again replaces the old one; newest first.
    const same = (s: SavedSearch) =>
      s.query === item.query &&
      JSON.stringify(s.filters) === JSON.stringify(item.filters);
    const list = [item, ...get().list.filter((s) => !same(s))].slice(0, SAVED_MAX);
    set({ list });
    await storageSet(KEY, list);
  },
  async remove(id) {
    await get().load();
    const list = get().list.filter((s) => s.id !== id);
    set({ list });
    await storageSet(KEY, list);
  },
}));

export function resetSavedSearchesForTests(): void {
  off?.();
  off = null;
  useSavedSearches.setState({ list: [], loaded: false });
}
