import { useEffect, useSyncExternalStore } from 'react';
import { BookmarkStore, type BookmarkSnapshot } from './bookmarkStore';

let shared: BookmarkStore | null = null;

/** The page-wide bookmark store. Created lazily; tests can inject their own. */
export function getBookmarkStore(): BookmarkStore {
  shared ??= new BookmarkStore();
  return shared;
}

export function setBookmarkStoreForTests(store: BookmarkStore | null): void {
  shared = store;
}

/** Current bookmark snapshot; re-renders on every bookmark change. */
export function useBookmarks(): BookmarkSnapshot {
  const store = getBookmarkStore();
  useEffect(() => {
    void store.start();
  }, [store]);
  return useSyncExternalStore(store.subscribe, store.getSnapshot);
}
