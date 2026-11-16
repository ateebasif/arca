import { create } from 'zustand';

/**
 * Broken addresses from the last link check, loaded on demand for the
 * "Broken" search filter (the checker itself is only loaded then).
 */
export const useBrokenLinks = create<{
  urls: Set<string> | null;
  load(): Promise<void>;
}>()((set) => ({
  urls: null,
  async load() {
    const { brokenUrls } = await import('@/src/features/deadlinks/check');
    set({ urls: await brokenUrls().catch(() => new Set<string>()) });
  },
}));
