import { useEffect, useSyncExternalStore } from 'react';
import { MetaStore, ORPHAN_GRACE_MS, type MetaSnapshot } from '@/src/features/tags/meta';
import type { BookmarkSnapshot } from './bookmarkStore';

let store = new MetaStore();

export function getMetaStore(): MetaStore {
  return store;
}

export function setMetaStoreForTests(next: MetaStore): void {
  store.stop();
  store = next;
}

/** Current tags (re-renders when they change in any Arca page). */
export function useMeta(): MetaSnapshot {
  useEffect(() => {
    void store.start();
  }, []);
  return useSyncExternalStore(store.subscribe, store.getSnapshot);
}

let relinked = false;
/** Once per page: re-link tags by URL if bookmark ids changed (import/sync). */
export async function relinkMetaOnce(state: BookmarkSnapshot): Promise<void> {
  if (relinked || !state.ready) return;
  relinked = true;
  await store.start();
  const nodes = new Map<string, string>();
  for (const [id, node] of state.nodes) nodes.set(id, node.url ?? '');
  await store.relink(nodes);
}

let cleanupTimer: ReturnType<typeof setTimeout> | undefined;
let finalTimer: ReturnType<typeof setTimeout> | undefined;

function relinkNow(state: BookmarkSnapshot, keepGone: boolean) {
  const nodes = new Map<string, string>();
  for (const [id, node] of state.nodes) nodes.set(id, node.url ?? '');
  void store.relink(nodes, { keepGone });
}

/**
 * After bookmarks are deleted: mark their tags and notes as gone (so tag
 * counts drop right away), then remove them once the grace period has passed
 * and this page can no longer undo a deletion (PRD §8.7).
 */
export function scheduleMetaCleanup(
  getState: () => BookmarkSnapshot,
  canRestore: () => boolean,
  { markAfterMs = 2000, dropAfterMs = ORPHAN_GRACE_MS + 60_000 } = {},
): void {
  clearTimeout(cleanupTimer);
  cleanupTimer = setTimeout(() => {
    relinkNow(getState(), canRestore());
    clearTimeout(finalTimer);
    finalTimer = setTimeout(() => relinkNow(getState(), canRestore()), dropAfterMs);
  }, markAfterMs);
}

export function resetMetaForTests(): void {
  clearTimeout(cleanupTimer);
  clearTimeout(finalTimer);
  relinked = false;
  setMetaStoreForTests(new MetaStore());
}

const NO_TAGS: readonly string[] = [];
/** An item's tags (stable empty array when it has none). */
export function useTags(id: string): readonly string[] {
  const meta = useMeta();
  return meta.byId.get(id)?.tags ?? NO_TAGS;
}

/** Tag colours chosen in the tag manager (re-renders when they change). */
export function useTagColors(): ReadonlyMap<string, number> {
  return useMeta().colors;
}
