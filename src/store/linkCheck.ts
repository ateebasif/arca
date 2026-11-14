import { create } from 'zustand';
import type { CheckItem, LinkResult } from '@/src/features/deadlinks/check';

/**
 * Dead-link check state: results by bookmark id and progress. Lives outside
 * the panel so a long check keeps going when you switch tabs or close it.
 */
interface LinkCheckState {
  results: Map<string, LinkResult>;
  progress: { done: number; total: number } | null;
  error: string | null;
  start(items: CheckItem[], fresh?: boolean): Promise<void>;
  cancel(): void;
}

let controller: AbortController | null = null;

export const useLinkCheck = create<LinkCheckState>()((set, get) => ({
  results: new Map(),
  progress: null,
  error: null,
  async start(items, fresh = false) {
    if (get().progress) return;
    controller = new AbortController();
    const signal = controller.signal;
    let done = 0;
    set({ progress: { done: 0, total: items.length }, error: null });
    // Results arrive one by one; batch the re-renders.
    let pending = new Map<string, LinkResult>();
    let timer: ReturnType<typeof setTimeout> | null = null;
    const flush = () => {
      timer = null;
      if (signal.aborted || pending.size === 0) return;
      const batch = pending;
      pending = new Map();
      set((s) => ({
        results: new Map([...s.results, ...batch]),
        progress: { done, total: items.length },
      }));
    };
    try {
      const { checkAll } = await import('@/src/features/deadlinks/check');
      await checkAll(items, {
        fresh,
        signal,
        onResult: (id, result) => {
          done++;
          pending.set(id, result);
          timer ??= setTimeout(flush, 120);
        },
      });
      flush();
    } catch (e) {
      if (!signal.aborted) set({ error: e instanceof Error ? e.message : String(e) });
    } finally {
      if (timer) clearTimeout(timer);
      flush();
      if (!signal.aborted) set({ progress: null });
      controller = null;
    }
  },
  cancel() {
    controller?.abort();
    controller = null;
    set({ progress: null });
  },
}));

export function resetLinkCheckForTests(): void {
  controller?.abort();
  controller = null;
  useLinkCheck.setState({ results: new Map(), progress: null, error: null });
}
