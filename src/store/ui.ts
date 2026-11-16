import { create } from 'zustand';
import { onStorageChange, storageGet, storageSet } from '@/src/lib/storage';
import { bool, idList, isRecord, num, oneOf, str } from '@/src/lib/validate';

/** UI-only state. Bookmarks themselves live in the bookmark store. */

export type ViewMode = 'grid' | 'list';
export type Density = 'comfortable' | 'compact';
export type SortMode = 'manual' | 'title' | 'date' | 'domain';
export type SortDirection = 'asc' | 'desc';
/** Folders = the open folder's own items; all = every link inside it, flattened. */
export type Scope = 'folders' | 'all';

/** Narrowing for search results (cleared with the query). */
export interface SearchFilters {
  tag: string | null;
  note: boolean;
  duplicates: boolean;
  broken: boolean;
}
export const NO_FILTERS: SearchFilters = {
  tag: null,
  note: false,
  duplicates: false,
  broken: false,
};

/** Preferences remembered across sessions. */
export interface UiPrefs {
  view: ViewMode;
  density: Density;
  sort: SortMode;
  sortDirection: SortDirection;
  scope: Scope;
  sidebarCollapsed: boolean;
  sidebarWidth: number;
  expanded: string[];
  lastFolderId: string;
  /** Open tabs panel shown on the right. */
  tabsPanel: boolean;
}

export const DEFAULT_PREFS: UiPrefs = {
  view: 'grid',
  density: 'comfortable',
  sort: 'manual',
  sortDirection: 'asc',
  scope: 'folders',
  sidebarCollapsed: false,
  sidebarWidth: 248,
  expanded: ['1'],
  lastFolderId: '1',
  tabsPanel: false,
};

export const SIDEBAR_MIN = 180;
export const SIDEBAR_MAX = 420;
const HISTORY_LIMIT = 50;

interface UiState extends UiPrefs {
  /** Folder shown in the main area. */
  currentFolderId: string;
  hydrated: boolean;
  /** Search box text; non-empty means results replace the folder view. */
  query: string;
  /** Limit search to the open folder. */
  searchInFolder: boolean;
  filters: SearchFilters;
  setFilters(patch: Partial<SearchFilters>): void;
  /** Highlighted search result. */
  activeResult: number;
  /** Item to scroll to and focus after "reveal in folder". */
  revealId: string | null;
  /** Folder history for back/forward (most recent last). Not persisted. */
  backStack: string[];
  forwardStack: string[];
  /** Showing every item with this tag (across folders) instead of a folder. */
  tagFilter: string | null;
  setTagFilter(tag: string | null): void;
  /** Showing Home (recently added, most visited) instead of a folder. */
  home: boolean;
  showHome(): void;
  openFolder(id: string): void;
  goBack(): void;
  goForward(): void;
  /** Switch folder without adding a history entry (e.g. after a deletion). */
  replaceFolder(id: string): void;
  setQuery(query: string): void;
  setSearchInFolder(on: boolean): void;
  setActiveResult(index: number): void;
  reveal(id: string, folderId: string): void;
  clearReveal(): void;
  setView(view: ViewMode): void;
  setDensity(density: Density): void;
  setSort(sort: SortMode, direction?: SortDirection): void;
  setScope(scope: Scope): void;
  toggleSidebar(): void;
  toggleTabsPanel(): void;
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
  filters: NO_FILTERS,
  setFilters: (patch) =>
    set((s) => ({ filters: { ...s.filters, ...patch }, activeResult: 0 })),
  activeResult: 0,
  revealId: null,
  backStack: [],
  forwardStack: [],
  tagFilter: null,
  home: false,
  setTagFilter: (tagFilter) => set({ tagFilter, home: false, query: '' }),
  showHome: () => set({ home: true, tagFilter: null, query: '' }),
  openFolder: (id) =>
    set((s) =>
      id === s.currentFolderId
        ? { tagFilter: null, home: false }
        : {
            tagFilter: null,
            home: false,
            currentFolderId: id,
            lastFolderId: id,
            backStack: [...s.backStack, s.currentFolderId].slice(-HISTORY_LIMIT),
            forwardStack: [],
          },
    ),
  replaceFolder: (id) => set({ currentFolderId: id, lastFolderId: id }),
  goBack: () =>
    set((s) => {
      // Back from Home returns to the folder you were in.
      if (s.home) return { home: false };
      const target = s.backStack.at(-1);
      if (target === undefined) return s;
      return {
        currentFolderId: target,
        lastFolderId: target,
        backStack: s.backStack.slice(0, -1),
        forwardStack: [...s.forwardStack, s.currentFolderId],
        query: '',
        tagFilter: null,
        home: false,
      };
    }),
  goForward: () =>
    set((s) => {
      const target = s.forwardStack.at(-1);
      if (target === undefined) return s;
      return {
        currentFolderId: target,
        lastFolderId: target,
        forwardStack: s.forwardStack.slice(0, -1),
        backStack: [...s.backStack, s.currentFolderId],
        query: '',
        tagFilter: null,
        home: false,
      };
    }),
  setQuery: (query) =>
    set((s) => ({
      query,
      activeResult: 0,
      // Filters belong to a search; a cleared search starts fresh.
      filters: query.trim() ? s.filters : NO_FILTERS,
    })),
  setSearchInFolder: (searchInFolder) => set({ searchInFolder, activeResult: 0 }),
  setActiveResult: (activeResult) => set({ activeResult }),
  reveal: (id, folderId) =>
    set((s) => ({
      revealId: id,
      query: '',
      tagFilter: null,
      home: false,
      currentFolderId: folderId,
      lastFolderId: folderId,
      backStack:
        folderId === s.currentFolderId
          ? s.backStack
          : [...s.backStack, s.currentFolderId].slice(-HISTORY_LIMIT),
      forwardStack: folderId === s.currentFolderId ? s.forwardStack : [],
    })),
  clearReveal: () => set({ revealId: null }),
  setView: (view) => set({ view }),
  setDensity: (density) => set({ density }),
  setSort: (sort, sortDirection = 'asc') => set({ sort, sortDirection }),
  setScope: (scope) => set({ scope }),
  toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
  toggleTabsPanel: () => set((s) => ({ tabsPanel: !s.tabsPanel })),
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

/** Layout prefs that follow you across open Arca tabs. */
const SHARED_PREFS = [
  'view',
  'density',
  'sort',
  'sortDirection',
  'scope',
  'sidebarCollapsed',
  'sidebarWidth',
] as const satisfies ReadonlyArray<keyof UiPrefs>;

function pickPrefs(state: UiPrefs): UiPrefs {
  return {
    view: state.view,
    density: state.density,
    sort: state.sort,
    sortDirection: state.sortDirection,
    scope: state.scope,
    sidebarCollapsed: state.sidebarCollapsed,
    sidebarWidth: state.sidebarWidth,
    expanded: state.expanded,
    lastFolderId: state.lastFolderId,
    tabsPanel: state.tabsPanel,
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
    scope: oneOf(r.scope, ['folders', 'all'], d.scope),
    sidebarCollapsed: bool(r.sidebarCollapsed, d.sidebarCollapsed),
    sidebarWidth: num(r.sidebarWidth, d.sidebarWidth, SIDEBAR_MIN, SIDEBAR_MAX),
    expanded: idList(r.expanded, d.expanded),
    lastFolderId: str(r.lastFolderId, d.lastFolderId, 64),
    tabsPanel: bool(r.tabsPanel, d.tabsPanel),
  };
}

/** Loads saved prefs, then saves changes (debounced). Call once per page. */
export async function hydrateUi(): Promise<void> {
  const prefs = parsePrefs(await storageGet<unknown>(PREFS_KEY, {}));
  useUi.setState({ ...prefs, currentFolderId: prefs.lastFolderId, hydrated: true });
  unsubscribePersist?.();
  const offSave = useUi.subscribe((state, prev) => {
    const next = pickPrefs(state);
    if (JSON.stringify(next) === JSON.stringify(pickPrefs(prev))) return;
    clearTimeout(persistTimer);
    persistTimer = setTimeout(() => void storageSet(PREFS_KEY, next), 250);
  });
  // Another Arca tab changed the layout: follow it. Where each tab is
  // (folder, expanded tree) stays per tab.
  const offSync = onStorageChange<unknown>(PREFS_KEY, (raw) => {
    const incoming = parsePrefs(raw);
    const s = useUi.getState();
    const patch: Partial<UiPrefs> = {};
    for (const key of SHARED_PREFS) {
      if (JSON.stringify(incoming[key]) !== JSON.stringify(s[key]))
        Object.assign(patch, { [key]: incoming[key] });
    }
    if (Object.keys(patch).length) useUi.setState(patch);
  });
  unsubscribePersist = () => {
    offSave();
    offSync();
  };
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
    filters: NO_FILTERS,
    activeResult: 0,
    revealId: null,
    backStack: [],
    forwardStack: [],
    tagFilter: null,
    home: false,
  });
}
