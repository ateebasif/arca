import { create } from 'zustand';
import type { ReviewItem, Verdict } from '@/src/features/ai/purgeReview';

/**
 * "Clean out" state that should survive switching Tidy tabs or closing the
 * panel: the AI's opinions (so a long review isn't lost) and what's selected.
 * Never persisted.
 */
interface PurgeState {
  selected: Set<string>;
  verdicts: Map<string, Verdict>;
  review: { done: number; total: number } | null;
  reviewError: string | null;
  toggle(id: string, on: boolean): void;
  setMany(ids: readonly string[], on: boolean): void;
  clearSelection(): void;
  startReview(
    items: ReviewItem[],
    opts: { base: string; chatModel: string },
  ): Promise<void>;
  cancelReview(): void;
}

let controller: AbortController | null = null;

export const usePurge = create<PurgeState>()((set, get) => ({
  selected: new Set(),
  verdicts: new Map(),
  review: null,
  reviewError: null,
  toggle: (id, on) =>
    set((s) => {
      const selected = new Set(s.selected);
      if (on) selected.add(id);
      else selected.delete(id);
      return { selected };
    }),
  setMany: (ids, on) =>
    set((s) => {
      const selected = new Set(s.selected);
      for (const id of ids) {
        if (on) selected.add(id);
        else selected.delete(id);
      }
      return { selected };
    }),
  clearSelection: () => set({ selected: new Set() }),

  async startReview(items, opts) {
    if (get().review) return;
    controller = new AbortController();
    const signal = controller.signal;
    const todo = items.filter((it) => !get().verdicts.has(it.id));
    set({ review: { done: 0, total: todo.length }, reviewError: null });
    try {
      const { reviewForPurge } = await import('@/src/features/ai/purgeReview');
      const verdicts = await reviewForPurge(todo, {
        ...opts,
        signal,
        onProgress: (done, total) => !signal.aborted && set({ review: { done, total } }),
      });
      set((s) => ({ verdicts: new Map([...s.verdicts, ...verdicts]) }));
    } catch (e) {
      if (!(e instanceof DOMException && e.name === 'AbortError')) {
        set({ reviewError: e instanceof Error ? e.message : String(e) });
      }
    } finally {
      if (!signal.aborted) set({ review: null });
      if (controller?.signal === signal) controller = null;
    }
  },
  cancelReview() {
    controller?.abort();
    controller = null;
    set({ review: null });
  },
}));

export function resetPurgeForTests(): void {
  controller?.abort();
  controller = null;
  usePurge.setState({
    selected: new Set(),
    verdicts: new Map(),
    review: null,
    reviewError: null,
  });
}
