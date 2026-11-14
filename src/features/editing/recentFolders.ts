import { storageGet, storageSet } from '@/src/lib/storage';
import { idList } from '@/src/lib/validate';

/** Folders you saved or moved things into most recently (newest first). */
const KEY = 'recentFolders';
const MAX = 5;

export async function loadRecentFolders(): Promise<string[]> {
  return idList(await storageGet<unknown>(KEY, []), [], MAX);
}

export async function rememberFolder(id: string): Promise<void> {
  const current = await loadRecentFolders();
  await storageSet(KEY, [id, ...current.filter((x) => x !== id)].slice(0, MAX));
}
