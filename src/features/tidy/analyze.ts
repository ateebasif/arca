import { displayHost, mainDomain } from '@/src/lib/url';
import type { BNode, BookmarkSnapshot } from '@/src/store/bookmarkStore';
import { folderCounts, getPath, linksWithin } from '@/src/store/selectors';
import { normalizeUrl } from './normalize';

/** Pure analysis for the Tidy up panel. Nothing here changes bookmarks. */

export interface DuplicateGroup {
  key: string;
  /** All copies, best one to keep first. */
  items: BNode[];
  /** Folder path per item id, for display. */
  paths: Map<string, string>;
}

const TRASHY = /\b(trash|bin|deleted|recycle)\b/i;

/** Lower is better: avoid Trash-like folders, prefer shallow, then oldest. */
function keepScore(path: string, node: BNode): [number, number, number] {
  const parts = path.split(' / ');
  return [parts.some((p) => TRASHY.test(p)) ? 1 : 0, parts.length, node.dateAdded];
}

export function findDuplicates(
  state: BookmarkSnapshot,
  withinId?: string,
): DuplicateGroup[] {
  const links = withinId
    ? linksWithin(state, withinId)
    : state.rootIds.flatMap((id) => linksWithin(state, id));
  const byKey = new Map<string, BNode[]>();
  for (const { node } of links) {
    if (!node.url) continue;
    const key = normalizeUrl(node.url);
    const list = byKey.get(key);
    if (list) list.push(node);
    else byKey.set(key, [node]);
  }
  const groups: DuplicateGroup[] = [];
  for (const [key, items] of byKey) {
    if (items.length < 2) continue;
    const paths = new Map(
      items.map((n) => [
        n.id,
        getPath(state, n.parentId ?? '')
          .map((f) => f.title || 'Untitled')
          .join(' / '),
      ]),
    );
    const scored = items
      .map((n) => ({ n, s: keepScore(paths.get(n.id) ?? '', n) }))
      .sort((a, b) => a.s[0] - b.s[0] || a.s[1] - b.s[1] || a.s[2] - b.s[2]);
    groups.push({ key, items: scored.map((x) => x.n), paths });
  }
  // Biggest groups first.
  return groups.sort(
    (a, b) => b.items.length - a.items.length || a.key.localeCompare(b.key),
  );
}

/** Folders (not root folders) with no bookmarks anywhere inside. Outermost only. */
export function findEmptyFolders(state: BookmarkSnapshot, withinId?: string): BNode[] {
  const counts = folderCounts(state);
  const out: BNode[] = [];
  const visit = (id: string) => {
    const node = state.nodes.get(id);
    if (!node?.childIds) return;
    if (!node.isRoot && (counts.get(id) ?? 0) === 0) {
      out.push(node);
      return; // its subfolders go with it
    }
    node.childIds.forEach(visit);
  };
  (withinId ? [withinId] : state.rootIds).forEach(visit);
  return out;
}

export type TidySort = 'title' | 'domain' | 'newest' | 'oldest';

const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' });

/** Target order for a folder's direct children; folders always come first. */
export function sortedOrder(
  state: BookmarkSnapshot,
  folderId: string,
  mode: TidySort,
): string[] {
  const children = (state.nodes.get(folderId)?.childIds ?? [])
    .map((id) => state.nodes.get(id))
    .filter((n): n is BNode => !!n);
  const byTitle = (a: BNode, b: BNode) => collator.compare(a.title, b.title);
  const compare: Record<TidySort, (a: BNode, b: BNode) => number> = {
    title: byTitle,
    domain: (a, b) =>
      collator.compare(displayHost(a.url ?? ''), displayHost(b.url ?? '')) ||
      byTitle(a, b),
    newest: (a, b) => b.dateAdded - a.dateAdded,
    oldest: (a, b) => a.dateAdded - b.dateAdded,
  };
  const folders = children.filter((n) => n.childIds).sort(byTitle);
  const links = children.filter((n) => !n.childIds).sort(compare[mode]);
  return [...folders, ...links].map((n) => n.id);
}

export interface SiteGroup {
  domain: string;
  items: BNode[];
}

/** Sites with at least `min` links directly in a folder: candidates for a subfolder. */
export function siteGroups(
  state: BookmarkSnapshot,
  folderId: string,
  min = 3,
): SiteGroup[] {
  const byDomain = new Map<string, BNode[]>();
  for (const id of state.nodes.get(folderId)?.childIds ?? []) {
    const node = state.nodes.get(id);
    if (!node?.url) continue;
    const domain = mainDomain(node.url);
    if (!domain) continue;
    const list = byDomain.get(domain);
    if (list) list.push(node);
    else byDomain.set(domain, [node]);
  }
  return [...byDomain]
    .filter(([, items]) => items.length >= min)
    .map(([domain, items]) => ({ domain, items }))
    .sort((a, b) => b.items.length - a.items.length || a.domain.localeCompare(b.domain));
}
