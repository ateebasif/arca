import { useEffect } from 'react';
import { create } from 'zustand';

/**
 * Multi-select in the main view. Items render with `data-select-id`; the
 * order for ⇧-click ranges is the order they appear on the page. UI state
 * only, never persisted.
 */
interface SelectionState {
  ids: ReadonlySet<string>;
  /** Last item clicked, the start of a ⇧-click range. */
  anchor: string | null;
  /**
   * Every item in the current view, in order (published by the view; big
   * lists only render what's on screen, so the page alone isn't enough).
   */
  viewIds: readonly string[];
  setViewIds(ids: readonly string[]): void;
  toggle(id: string): void;
  /** Selects everything between the anchor and `id` (in page order). */
  extendTo(id: string, order: readonly string[]): void;
  selectAll(ids: readonly string[]): void;
  remove(ids: readonly string[]): void;
  clear(): void;
}

export const useSelection = create<SelectionState>()((set) => ({
  ids: new Set(),
  anchor: null,
  viewIds: [],
  setViewIds: (viewIds) => set({ viewIds }),
  toggle: (id) =>
    set((s) => {
      const ids = new Set(s.ids);
      if (ids.has(id)) ids.delete(id);
      else ids.add(id);
      return { ids, anchor: id };
    }),
  extendTo: (id, order) =>
    set((s) => {
      const from = s.anchor ? order.indexOf(s.anchor) : -1;
      const to = order.indexOf(id);
      if (from < 0 || to < 0) {
        const ids = new Set(s.ids).add(id);
        return { ids, anchor: id };
      }
      const [a, b] = from < to ? [from, to] : [to, from];
      const ids = new Set(s.ids);
      for (const x of order.slice(a, b + 1)) ids.add(x);
      return { ids, anchor: id };
    }),
  selectAll: (all) => set({ ids: new Set(all), anchor: all.at(-1) ?? null }),
  remove: (gone) =>
    set((s) => {
      if (!gone.some((id) => s.ids.has(id))) return s;
      const ids = new Set(s.ids);
      gone.forEach((id) => ids.delete(id));
      return { ids };
    }),
  clear: () => set((s) => (s.ids.size ? { ids: new Set(), anchor: null } : s)),
}));

/** Ids of every selectable item in the current view, in order. */
export function pageOrder(root: ParentNode = document): string[] {
  const published = useSelection.getState().viewIds;
  if (published.length) return [...published];
  return [...root.querySelectorAll<HTMLElement>('[data-select-id]')]
    .map((el) => el.dataset.selectId ?? '')
    .filter(Boolean);
}

/** Views call this with their items so select-all and ranges see all of them. */
export function useViewIds(ids: readonly string[], enabled = true): void {
  const key = enabled ? ids.join(',') : null;
  useEffect(() => {
    if (key === null) return;
    useSelection.getState().setViewIds(ids);
    return () => useSelection.getState().setViewIds([]);
    // Re-publish only when the list actually changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
}
