import type { BNode, BookmarkSnapshot } from './bookmarkStore';

/** Pure read helpers over a bookmark snapshot. */

export const isFolderNode = (node: BNode): boolean => node.childIds !== null;

export function getNode(state: BookmarkSnapshot, id: string): BNode | undefined {
  return state.nodes.get(id);
}

export function getChildren(state: BookmarkSnapshot, id: string): BNode[] {
  const ids = state.nodes.get(id)?.childIds ?? [];
  const out: BNode[] = [];
  for (const childId of ids) {
    const child = state.nodes.get(childId);
    if (child) out.push(child);
  }
  return out;
}

/** Path from the first visible root folder down to `id` (inclusive). */
export function getPath(state: BookmarkSnapshot, id: string): BNode[] {
  const path: BNode[] = [];
  let current = state.nodes.get(id);
  while (current && current.parentId !== null) {
    path.unshift(current);
    current = state.nodes.get(current.parentId);
  }
  return path;
}

/** True if `id` is `ancestorId` or lives somewhere inside it. */
export function isWithin(
  state: BookmarkSnapshot,
  id: string,
  ancestorId: string,
): boolean {
  let current = state.nodes.get(id);
  while (current) {
    if (current.id === ancestorId) return true;
    current = current.parentId ? state.nodes.get(current.parentId) : undefined;
  }
  return false;
}

/** Number of bookmarks (not folders) inside a folder, at any depth. */
export function countBookmarks(state: BookmarkSnapshot, folderId: string): number {
  let count = 0;
  const stack = [folderId];
  let nextId: string | undefined;
  while ((nextId = stack.pop()) !== undefined) {
    const node = state.nodes.get(nextId);
    if (!node?.childIds) continue;
    for (const childId of node.childIds) {
      const child = state.nodes.get(childId);
      if (!child) continue;
      if (child.childIds) stack.push(child.id);
      else count++;
    }
  }
  return count;
}

/** Every bookmark (not folder), in tree order. */
export function allBookmarks(state: BookmarkSnapshot): BNode[] {
  const out: BNode[] = [];
  const visit = (id: string) => {
    const node = state.nodes.get(id);
    if (!node) return;
    if (node.childIds) node.childIds.forEach(visit);
    else out.push(node);
  };
  state.rootIds.forEach(visit);
  return out;
}

/** The `count` most recently added bookmarks, newest first. */
export function recentlyAdded(state: BookmarkSnapshot, count: number): BNode[] {
  return allBookmarks(state)
    .sort((a, b) => b.dateAdded - a.dateAdded)
    .slice(0, count);
}

const countsCache = new WeakMap<BookmarkSnapshot, Map<string, number>>();

/**
 * Bookmark count (any depth) for every folder, computed in one pass and
 * cached per snapshot.
 */
export function folderCounts(state: BookmarkSnapshot): ReadonlyMap<string, number> {
  const cached = countsCache.get(state);
  if (cached) return cached;
  const counts = new Map<string, number>();
  const visit = (id: string): number => {
    const node = state.nodes.get(id);
    if (!node) return 0;
    if (!node.childIds) return 1;
    let total = 0;
    for (const childId of node.childIds) total += visit(childId);
    counts.set(id, total);
    return total;
  };
  state.rootIds.forEach(visit);
  countsCache.set(state, counts);
  return counts;
}

/** Up to `n` bookmarks directly inside a folder, for card previews. */
export function folderPreview(state: BookmarkSnapshot, folder: BNode, n = 3): BNode[] {
  const out: BNode[] = [];
  for (const id of folder.childIds ?? []) {
    const child = state.nodes.get(id);
    if (child?.url) out.push(child);
    if (out.length === n) break;
  }
  return out;
}
