import * as bm from '@/src/lib/bookmarks';
import { ArcaError } from '@/src/lib/errors';
import { getBookmarkStore } from '@/src/store/useBookmarks';
import { useOverlays } from '@/src/store/overlays';

/**
 * User-facing edit actions. They call the bookmarks wrapper (the store picks
 * up the resulting events) and report failures as toasts.
 */

export function errorMessage(error: unknown): string {
  if (error instanceof ArcaError) {
    switch (error.code) {
      case 'ROOT_FOLDER':
        return "Browser folders like Bookmarks bar can't be changed.";
      case 'INVALID_MOVE':
        return "A folder can't be moved into itself.";
      case 'NOT_FOUND':
        return 'That item no longer exists.';
      case 'NOT_A_FOLDER':
        return 'Pick a folder as the destination.';
      default:
        return error.message;
    }
  }
  return error instanceof Error ? error.message : String(error);
}

async function run<T>(fn: () => Promise<T>): Promise<T | undefined> {
  try {
    return await fn();
  } catch (error) {
    useOverlays.getState().toast(errorMessage(error), 'error');
    return undefined;
  }
}

export function renameNode(id: string, title: string) {
  return run(() => bm.update(id, { title }));
}

/** Deletes immediately unless it's a non-empty folder, which asks first. */
export function requestDelete(id: string): void {
  const node = getBookmarkStore().getSnapshot().nodes.get(id);
  if (!node) return;
  if (node.isRoot) {
    useOverlays.getState().toast(errorMessage(new ArcaError('ROOT_FOLDER', '')), 'error');
    return;
  }
  if (node.childIds && node.childIds.length > 0) {
    useOverlays.getState().askDelete(id);
    return;
  }
  void deleteNode(id);
}

export async function deleteNode(id: string): Promise<void> {
  const removed = await run(() => bm.remove(id));
  if (removed) useOverlays.getState().toast(`Deleted “${removed.title || 'Untitled'}”`);
}
