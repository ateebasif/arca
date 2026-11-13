import * as bm from '@/src/lib/bookmarks';
import type { BookmarkSnapshot } from '@/src/store/bookmarkStore';
import * as undo from '../undo/undo';
import type { SiteGroup, TidySort } from './analyze';
import { sortedOrder } from './analyze';

/**
 * Bookmark changes for Tidy up. Each operation records ONE undo action that
 * reverses everything it did, and reports progress for big libraries.
 */

export type Progress = (done: number, total: number) => void;

/** Deletes the given bookmarks/folders (whole subtrees). */
export async function removeAll(
  ids: readonly string[],
  label: string,
  onProgress?: Progress,
): Promise<number> {
  const steps: undo.UndoAction[] = [];
  let done = 0;
  for (const id of ids) {
    try {
      const removed = await bm.remove(id);
      steps.push(undo.deleted(removed));
    } catch {
      // Already gone (deleted elsewhere): skip.
    }
    onProgress?.(++done, ids.length);
  }
  if (steps.length) undo.record(undo.combine(label, steps));
  return steps.length;
}

/** Moves children into `order` (ids, first to last) with as few moves as possible. */
async function applyOrder(folderId: string, order: readonly string[]): Promise<void> {
  for (let i = 0; i < order.length; i++) {
    const id = order[i];
    if (!id) continue;
    const current = await bm.getChildren(folderId);
    if (current[i]?.id === id) continue;
    // The item sits further down, so moving it up to i is unambiguous.
    await bm.move(id, { parentId: folderId, index: i });
  }
}

export async function sortFolder(
  state: BookmarkSnapshot,
  folderId: string,
  mode: TidySort,
): Promise<void> {
  const before = [...(state.nodes.get(folderId)?.childIds ?? [])];
  await applyOrder(folderId, sortedOrder(state, folderId, mode));
  const title = state.nodes.get(folderId)?.title || 'folder';
  undo.record({
    label: `Sorted “${title}”`,
    undo: () => applyOrder(folderId, before),
  });
}

/** Creates one subfolder per site group and moves its links in. */
export async function groupBySite(
  folderId: string,
  groups: readonly SiteGroup[],
  onProgress?: Progress,
): Promise<number> {
  const steps: undo.UndoAction[] = [];
  const total = groups.reduce((n, g) => n + g.items.length, 0);
  let done = 0;
  for (const group of groups) {
    const folder = await bm.create({ parentId: folderId, title: group.domain, index: 0 });
    steps.push(undo.created(folder));
    for (const item of group.items) {
      const from = await bm.getNode(item.id).catch(() => null);
      if (!from?.parentId) continue;
      await bm.move(item.id, { parentId: folder.id });
      steps.push(
        undo.moved(item.id, { parentId: from.parentId, index: from.index ?? 0 }, ''),
      );
      onProgress?.(++done, total);
    }
  }
  if (steps.length) {
    undo.record(
      undo.combine(
        `Grouped ${total} links into ${groups.length} ${groups.length === 1 ? 'folder' : 'folders'}`,
        steps,
      ),
    );
  }
  return groups.length;
}
