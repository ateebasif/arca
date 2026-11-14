import { useEffect, useSyncExternalStore } from 'react';
import { MetaStore, type MetaSnapshot } from '@/src/features/tags/meta';
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

export function resetMetaForTests(): void {
  relinked = false;
  setMetaStoreForTests(new MetaStore());
}

const NO_TAGS: readonly string[] = [];
/** An item's tags (stable empty array when it has none). */
export function useTags(id: string): readonly string[] {
  const meta = useMeta();
  return meta.byId.get(id)?.tags ?? NO_TAGS;
}
