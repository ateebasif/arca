import { create } from 'zustand';
import type { CheckItem, LinkResult } from '@/src/features/deadlinks/check';
import { hasSiteAccess } from '@/src/lib/permissions';

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
  /** Deletes every stored result (the list of checked addresses). */
  forget(): Promise<void>;
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
      // Without site access every request fails and would look "broken".
      if (!(await hasSiteAccess())) {
        set({ error: 'Arca no longer has permission to contact sites.' });
        return;
      }
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
      // A run cancelled and restarted quickly must not clear the new run's controller.
      if (controller?.signal === signal) controller = null;
    }
  },
  cancel() {
    controller?.abort();
    controller = null;
    set({ progress: null });
  },
  async forget() {
    get().cancel();
    const { clearLinkResults } = await import('@/src/features/deadlinks/check');
    await clearLinkResults();
    set({ results: new Map(), error: null });
  },
}));

export function resetLinkCheckForTests(): void {
  controller?.abort();
  controller = null;
  useLinkCheck.setState({ results: new Map(), progress: null, error: null });
}
