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

/**
 * Moves children into `order` (ids, first to last) with as few moves as
 * possible. Ids no longer in the folder (moved or deleted since) are skipped.
 */
async function applyOrder(
  rawFolderId: string,
  rawOrder: readonly string[],
): Promise<void> {
  const folderId = undo.resolveId(rawFolderId);
  const live = new Set((await bm.getChildren(folderId)).map((c) => c.id));
  const order = rawOrder.map(undo.resolveId).filter((id) => live.has(id));
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
  let made = 0;
  try {
    for (const group of groups) {
      const folder = await bm.create({
        parentId: folderId,
        title: group.domain,
        index: 0,
      });
      steps.push(undo.created(folder));
      made++;
      for (const item of group.items) {
        const from = await bm.getNode(item.id).catch(() => null);
        // Skip links that were moved or deleted since the panel was opened.
        if (from?.parentId !== folderId) continue;
        await bm.move(item.id, { parentId: folder.id });
        steps.push(
          undo.moved(item.id, { parentId: folderId, index: from.index ?? 0 }, ''),
        );
        onProgress?.(++done, total);
      }
    }
  } finally {
    // Even if something failed half-way, what was done can be undone.
    if (steps.length) {
      undo.record(
        undo.combine(
          `Grouped ${done} links into ${made} ${made === 1 ? 'folder' : 'folders'}`,
          steps,
        ),
      );
    }
  }
  return groups.length;
}

export const ARCHIVE_TITLE = 'Archived by Arca';

/**
 * Moves bookmarks into "Archived by Arca" in Other bookmarks (created if
 * needed). Gentler than deleting: everything stays searchable and can be
 * moved back. One undo reverses it.
 */
export async function archiveAll(
  ids: readonly string[],
  onProgress?: Progress,
): Promise<number> {
  const steps: undo.UndoAction[] = [];
  const others = (await bm.getTree()).children?.find((r) => r.id === '2') ? '2' : '1';
  let archive = (await bm.getChildren(others)).find(
    (c) => c.url === undefined && c.title === ARCHIVE_TITLE,
  );
  if (!archive) {
    archive = await bm.create({ parentId: others, title: ARCHIVE_TITLE });
    steps.push(undo.created(archive));
  }
  let done = 0;
  try {
    for (const id of ids) {
      const from = await bm.getNode(id).catch(() => null);
      if (from?.parentId && from.parentId !== archive.id) {
        await bm.move(id, { parentId: archive.id });
        steps.push(
          undo.moved(id, { parentId: from.parentId, index: from.index ?? 0 }, ''),
        );
      }
      onProgress?.(++done, ids.length);
    }
  } finally {
    const moved = steps.filter((s) => s.label === '').length;
    if (steps.length) undo.record(undo.combine(`Archived ${moved} links`, steps));
  }
  return done;
}
