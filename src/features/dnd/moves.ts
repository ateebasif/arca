import * as bm from '@/src/lib/bookmarks';
import type { BookmarkSnapshot } from '@/src/store/bookmarkStore';
import { isWithin } from '@/src/store/selectors';
import { useOverlays } from '@/src/store/overlays';
import { errorMessage } from '../editing/actions';
import * as undo from '../undo/undo';

/** Why a drop isn't allowed, or null when it is. */
export function dropProblem(
  state: BookmarkSnapshot,
  nodeId: string,
  folderId: string,
): string | null {
  const node = state.nodes.get(nodeId);
  const folder = state.nodes.get(folderId);
  if (!node || !folder?.childIds) return 'That folder no longer exists.';
  if (node.isRoot) return "Browser folders like Bookmarks bar can't be moved.";
  if (folderId === '0') return 'Pick a folder inside Bookmarks bar or Other bookmarks.';
  if (node.childIds && isWithin(state, folderId, nodeId)) {
    return "A folder can't be moved into itself.";
  }
  if (node.parentId === folderId) return null;
  return null;
}

/** Moves a bookmark or folder to the end of another folder (with undo). */
export async function moveIntoFolder(
  state: BookmarkSnapshot,
  nodeId: string,
  folderId: string,
): Promise<boolean> {
  const problem = dropProblem(state, nodeId, folderId);
  const node = state.nodes.get(nodeId);
  if (problem || !node?.parentId) {
    if (problem) useOverlays.getState().toast(problem, 'error');
    return false;
  }
  if (node.parentId === folderId) return false;
  try {
    const from = await bm.getNode(nodeId);
    await bm.move(nodeId, { parentId: folderId });
    const target = state.nodes.get(folderId)?.title || 'folder';
    undo.record(
      undo.moved(
        nodeId,
        { parentId: node.parentId, index: from.index ?? 0 },
        `Moved “${node.title || 'Untitled'}” to “${target}”`,
      ),
    );
    return true;
  } catch (error) {
    useOverlays.getState().toast(errorMessage(error), 'error');
    return false;
  }
}

/**
 * Browser index to pass to bookmarks.move so `activeId` lands where `overId`
 * is now (dnd-kit "arrayMove" semantics). Chromium reads same-folder indexes
 * before removal, so moving down targets one past the item.
 */
export function reorderIndex(activeIndex: number, overIndex: number): number {
  return activeIndex < overIndex ? overIndex + 1 : overIndex;
}

/** Reorders `activeId` to `overId`'s position within their shared folder. */
export async function reorder(
  state: BookmarkSnapshot,
  activeId: string,
  overId: string,
): Promise<boolean> {
  const active = state.nodes.get(activeId);
  const over = state.nodes.get(overId);
  if (
    !active?.parentId ||
    !over ||
    active.parentId !== over.parentId ||
    activeId === overId
  ) {
    return false;
  }
  const siblings = state.nodes.get(active.parentId)?.childIds ?? [];
  const from = siblings.indexOf(activeId);
  const to = siblings.indexOf(overId);
  if (from === -1 || to === -1) return false;
  try {
    await bm.move(activeId, { parentId: active.parentId, index: reorderIndex(from, to) });
    undo.record(
      undo.moved(
        activeId,
        { parentId: active.parentId, index: from },
        `Moved “${active.title || 'Untitled'}”`,
      ),
      { toast: false },
    );
    return true;
  } catch (error) {
    useOverlays.getState().toast(errorMessage(error), 'error');
    return false;
  }
}
