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

export interface FolderOption {
  id: string;
  label: string;
}

/** Every folder as an indented option, excluding `excludeId` and its subtree. */
export function folderOptions(
  state: BookmarkSnapshot,
  excludeId?: string,
): FolderOption[] {
  const out: FolderOption[] = [];
  const visit = (id: string, depth: number) => {
    const node = state.nodes.get(id);
    if (!node?.childIds) return;
    if (excludeId && isWithin(state, id, excludeId)) return;
    out.push({ id, label: `${' '.repeat(depth)}${node.title || 'Untitled'}` });
    node.childIds.forEach((c) => visit(c, depth + 1));
  };
  state.rootIds.forEach((id) => visit(id, 0));
  return out;
}

export interface FolderEntry {
  id: string;
  title: string;
  depth: number;
  /** Parent path, e.g. "Bookmarks bar / Organized by Arca". */
  path: string;
}

/** Every folder in tree order with depth and parent path (for pickers). */
export function folderList(state: BookmarkSnapshot, excludeId?: string): FolderEntry[] {
  const out: FolderEntry[] = [];
  const visit = (id: string, depth: number, parents: string[]) => {
    const node = state.nodes.get(id);
    if (!node?.childIds) return;
    if (excludeId && isWithin(state, id, excludeId)) return;
    const title = node.title || 'Untitled';
    out.push({ id, title, depth, path: parents.join(' / ') });
    node.childIds.forEach((c) => visit(c, depth + 1, [...parents, title]));
  };
  state.rootIds.forEach((id) => visit(id, 0, []));
  return out;
}

export interface LinkInFolder {
  node: BNode;
  /** Folder the bookmark lives in. */
  folderId: string;
  /** Path of that folder relative to the base folder ("" when directly inside). */
  folderLabel: string;
}

const linksCache = new WeakMap<BookmarkSnapshot, Map<string, LinkInFolder[]>>();

/**
 * Every bookmark inside `baseId` at any depth, in tree order, each with the
 * folder it lives in. Cached per snapshot and base folder.
 */
export function linksWithin(state: BookmarkSnapshot, baseId: string): LinkInFolder[] {
  let perBase = linksCache.get(state);
  if (!perBase) {
    perBase = new Map();
    linksCache.set(state, perBase);
  }
  const cached = perBase.get(baseId);
  if (cached) return cached;

  const out: LinkInFolder[] = [];
  const visit = (folderId: string, label: string) => {
    const folder = state.nodes.get(folderId);
    for (const childId of folder?.childIds ?? []) {
      const child = state.nodes.get(childId);
      if (!child) continue;
      if (child.childIds) {
        const name = child.title || 'Untitled';
        visit(child.id, label ? `${label} / ${name}` : name);
      } else {
        out.push({ node: child, folderId, folderLabel: label });
      }
    }
  };
  visit(baseId, '');
  perBase.set(baseId, out);
  return out;
}
