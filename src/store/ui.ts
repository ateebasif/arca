import { create } from 'zustand';
import { storageGet, storageSet } from '@/src/lib/storage';
import { bool, idList, isRecord, num, oneOf, str } from '@/src/lib/validate';

/** UI-only state. Bookmarks themselves live in the bookmark store. */

export type ViewMode = 'grid' | 'list';
export type Density = 'comfortable' | 'compact';
export type SortMode = 'manual' | 'title' | 'date' | 'domain';
export type SortDirection = 'asc' | 'desc';

/** Preferences remembered across sessions. */
export interface UiPrefs {
  view: ViewMode;
  density: Density;
  sort: SortMode;
  sortDirection: SortDirection;
  sidebarCollapsed: boolean;
  sidebarWidth: number;
  expanded: string[];
  lastFolderId: string;
}

export const DEFAULT_PREFS: UiPrefs = {
  view: 'grid',
  density: 'comfortable',
  sort: 'manual',
  sortDirection: 'asc',
  sidebarCollapsed: false,
  sidebarWidth: 248,
  expanded: ['1'],
  lastFolderId: '1',
};

export const SIDEBAR_MIN = 180;
export const SIDEBAR_MAX = 420;

interface UiState extends UiPrefs {
  /** Folder shown in the main area. */
  currentFolderId: string;
  hydrated: boolean;
  /** Search box text; non-empty means results replace the folder view. */
  query: string;
  /** Limit search to the open folder. */
  searchInFolder: boolean;
  /** Highlighted search result. */
  activeResult: number;
  /** Item to scroll to and focus after "reveal in folder". */
  revealId: string | null;
  openFolder(id: string): void;
  setQuery(query: string): void;
  setSearchInFolder(on: boolean): void;
  setActiveResult(index: number): void;
  reveal(id: string, folderId: string): void;
  clearReveal(): void;
  setView(view: ViewMode): void;
  setDensity(density: Density): void;
  setSort(sort: SortMode, direction?: SortDirection): void;
  toggleSidebar(): void;
  setSidebarWidth(width: number): void;
  setExpanded(id: string, expanded: boolean): void;
  expandAll(ids: readonly string[]): void;
}

const PREFS_KEY = 'ui';

export const useUi = create<UiState>()((set) => ({
  ...DEFAULT_PREFS,
  currentFolderId: DEFAULT_PREFS.lastFolderId,
  hydrated: false,
  query: '',
  searchInFolder: false,
  activeResult: 0,
  revealId: null,
  openFolder: (id) => set({ currentFolderId: id, lastFolderId: id }),
  setQuery: (query) => set({ query, activeResult: 0 }),
  setSearchInFolder: (searchInFolder) => set({ searchInFolder, activeResult: 0 }),
  setActiveResult: (activeResult) => set({ activeResult }),
  reveal: (id, folderId) =>
    set({ revealId: id, query: '', currentFolderId: folderId, lastFolderId: folderId }),
  clearReveal: () => set({ revealId: null }),
  setView: (view) => set({ view }),
  setDensity: (density) => set({ density }),
  setSort: (sort, sortDirection = 'asc') => set({ sort, sortDirection }),
  toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
  setSidebarWidth: (width) =>
    set({
      sidebarWidth: Math.round(Math.min(SIDEBAR_MAX, Math.max(SIDEBAR_MIN, width))),
    }),
  setExpanded: (id, expanded) =>
    set((s) => {
      const has = s.expanded.includes(id);
      if (expanded === has) return s;
      return {
        expanded: expanded ? [...s.expanded, id] : s.expanded.filter((e) => e !== id),
      };
    }),
  expandAll: (ids) => set((s) => ({ expanded: [...new Set([...s.expanded, ...ids])] })),
}));

function pickPrefs(state: UiPrefs): UiPrefs {
  return {
    view: state.view,
    density: state.density,
    sort: state.sort,
    sortDirection: state.sortDirection,
    sidebarCollapsed: state.sidebarCollapsed,
    sidebarWidth: state.sidebarWidth,
    expanded: state.expanded,
    lastFolderId: state.lastFolderId,
  };
}

let persistTimer: ReturnType<typeof setTimeout> | undefined;
let unsubscribePersist: (() => void) | undefined;

/** Checks every saved field; anything invalid falls back to its default. */
export function parsePrefs(raw: unknown): UiPrefs {
  const r = isRecord(raw) ? raw : {};
  const d = DEFAULT_PREFS;
  return {
    view: oneOf(r.view, ['grid', 'list'], d.view),
    density: oneOf(r.density, ['comfortable', 'compact'], d.density),
    sort: oneOf(r.sort, ['manual', 'title', 'date', 'domain'], d.sort),
    sortDirection: oneOf(r.sortDirection, ['asc', 'desc'], d.sortDirection),
    sidebarCollapsed: bool(r.sidebarCollapsed, d.sidebarCollapsed),
    sidebarWidth: num(r.sidebarWidth, d.sidebarWidth, SIDEBAR_MIN, SIDEBAR_MAX),
    expanded: idList(r.expanded, d.expanded),
    lastFolderId: str(r.lastFolderId, d.lastFolderId, 64),
  };
}

/** Loads saved prefs, then saves changes (debounced). Call once per page. */
export async function hydrateUi(): Promise<void> {
  const prefs = parsePrefs(await storageGet<unknown>(PREFS_KEY, {}));
  useUi.setState({ ...prefs, currentFolderId: prefs.lastFolderId, hydrated: true });
  unsubscribePersist?.();
  unsubscribePersist = useUi.subscribe((state, prev) => {
    const next = pickPrefs(state);
    if (JSON.stringify(next) === JSON.stringify(pickPrefs(prev))) return;
    clearTimeout(persistTimer);
    persistTimer = setTimeout(() => void storageSet(PREFS_KEY, next), 250);
  });
}

/** Test helper: restore defaults and stop persisting. */
export function resetUiForTests(): void {
  unsubscribePersist?.();
  unsubscribePersist = undefined;
  clearTimeout(persistTimer);
  useUi.setState({
    ...DEFAULT_PREFS,
    currentFolderId: DEFAULT_PREFS.lastFolderId,
    hydrated: false,
    query: '',
    searchInFolder: false,
    activeResult: 0,
    revealId: null,
  });
}
