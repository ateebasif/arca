import * as bm from '@/src/lib/bookmarks';
import { ArcaError } from '@/src/lib/errors';
import { getBookmarkStore } from '@/src/store/useBookmarks';
import { useOverlays } from '@/src/store/overlays';
import * as undo from '../undo/undo';

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
      case 'BLOCKED_URL':
        return "For safety, Arca doesn't open or save javascript:, data: and similar links.";
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

export async function renameNode(id: string, title: string) {
  const before = getBookmarkStore().getSnapshot().nodes.get(id);
  const result = await run(() => bm.update(id, { title }));
  if (result && before) {
    undo.record(
      undo.changed(id, { title: before.title, url: before.url }, `Renamed to “${title}”`),
    );
  }
  return result;
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
  if (removed) undo.record(undo.deleted(removed));
}

/**
 * Ungroups a folder (like ungrouping tabs in Ardia): everything inside moves
 * up into the parent folder, in order, where the folder was, and the empty
 * folder is removed. One undo puts it all back.
 */
/**
 * Moves a folder's contents up into its parent where the folder was and
 * removes the folder. Returns undo steps in the order `combine` needs:
 * undoing recreates the folder, then moves items back first-to-last.
 * On a partial failure the steps so far are attached to the error.
 */
export async function ungroupSteps(
  id: string,
): Promise<{ steps: undo.UndoAction[]; title: string; count: number }> {
  const folder = await bm.getNode(id);
  if (bm.isRootFolder(folder)) throw new ArcaError('ROOT_FOLDER', '');
  if (folder.url !== undefined || !folder.parentId)
    throw new ArcaError('NOT_A_FOLDER', '');
  const parentId = folder.parentId;
  const start = folder.index ?? 0;
  const children = await bm.getChildren(id);
  const moves: undo.UndoAction[] = [];
  try {
    for (const [k, child] of children.entries()) {
      await bm.move(child.id, { parentId, index: start + k });
      moves.push(undo.moved(child.id, { parentId: id, index: child.index ?? k }, ''));
    }
  } catch (error) {
    throw Object.assign(error instanceof Error ? error : new Error(String(error)), {
      partialSteps: moves.reverse(),
    });
  }
  const removed = await bm.remove(id);
  return {
    steps: [...moves.reverse(), undo.deleted(removed)],
    title: folder.title || 'Untitled',
    count: children.length,
  };
}

/**
 * Ungroups a folder (like ungrouping tabs in Ardia): everything inside moves
 * up into the parent folder, in order, where the folder was, and the empty
 * folder is removed. One undo puts it all back.
 */
export async function ungroupFolder(id: string): Promise<void> {
  await run(async () => {
    try {
      const { steps, title, count } = await ungroupSteps(id);
      undo.record(
        undo.combine(
          `Ungrouped “${title}” (${count} ${count === 1 ? 'item' : 'items'})`,
          steps,
        ),
      );
    } catch (error) {
      const partial = (error as { partialSteps?: undo.UndoAction[] }).partialSteps;
      if (partial?.length)
        undo.record(undo.combine('Ungrouped part of a folder', partial));
      throw error;
    }
  });
}

/** Creates a folder (undoable) and returns its id, or null if it failed. */
export async function createFolder(
  parentId: string,
  title: string,
): Promise<string | null> {
  const name = title.trim().slice(0, 200) || 'New folder';
  const node = await run(() => bm.create({ parentId, title: name }));
  if (!node) return null;
  undo.record(undo.created(node), { toast: false });
  return node.id;
}
