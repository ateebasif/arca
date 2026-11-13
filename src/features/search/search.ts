import { displayHost } from '@/src/lib/url';
import type { BNode, BookmarkSnapshot } from '@/src/store/bookmarkStore';

/**
 * In-memory fuzzy search over titles, URLs and folder names.
 *
 * The index is rebuilt lazily once per bookmark snapshot (i.e. after any
 * bookmark event) and cached. Each query token must match somewhere; tokens
 * score higher for word-prefix title matches, then substrings, then URL /
 * folder matches, then in-order character (subsequence) matches.
 */

export interface SearchEntry {
  node: BNode;
  kind: 'bookmark' | 'folder';
  title: string;
  /** Lowercased fields used for matching. */
  titleLc: string;
  urlLc: string;
  hostLc: string;
  /** Parent folder path, e.g. "Bookmarks bar / Work". */
  path: string;
  pathLc: string;
  /** Ids of all ancestor folders, for "within folder" filtering. */
  ancestorIds: readonly string[];
}

export interface SearchResult {
  entry: SearchEntry;
  score: number;
}

export interface SearchOptions {
  limit?: number;
  /** Only return items inside this folder (any depth). */
  withinFolderId?: string;
}

const indexCache = new WeakMap<BookmarkSnapshot, SearchEntry[]>();

export function buildIndex(state: BookmarkSnapshot): SearchEntry[] {
  const cached = indexCache.get(state);
  if (cached) return cached;
  const entries: SearchEntry[] = [];
  const visit = (id: string, path: string[], ancestors: string[]) => {
    const node = state.nodes.get(id);
    if (!node) return;
    const isFolder = node.childIds !== null;
    if (!node.isRoot) {
      const url = node.url ?? '';
      const title = node.title || displayHost(url) || url;
      const pathText = path.join(' / ');
      entries.push({
        node,
        kind: isFolder ? 'folder' : 'bookmark',
        title,
        titleLc: title.toLowerCase(),
        urlLc: url.toLowerCase(),
        hostLc: displayHost(url).toLowerCase(),
        path: pathText,
        // Root folder names ("Bookmarks bar") are on every path, so don't match them.
        pathLc: path.slice(1).join(' / ').toLowerCase(),
        ancestorIds: ancestors,
      });
    }
    if (isFolder) {
      const childPath = [...path, node.title || 'Untitled'];
      const childAncestors = [...ancestors, node.id];
      for (const childId of node.childIds ?? [])
        visit(childId, childPath, childAncestors);
    }
  };
  state.rootIds.forEach((id) => visit(id, [], []));
  indexCache.set(state, entries);
  return entries;
}

function isWordStart(text: string, index: number): boolean {
  if (index === 0) return true;
  const prev = text[index - 1] ?? '';
  return !/[\p{L}\p{N}]/u.test(prev);
}

/** In-order character match; returns a score in (0, 1] or 0 for no match. */
function subsequenceScore(text: string, token: string): number {
  let ti = 0;
  let gaps = 0;
  let last = -1;
  for (let i = 0; i < text.length && ti < token.length; i++) {
    if (text[i] === token[ti]) {
      if (last >= 0 && i !== last + 1) gaps++;
      last = i;
      ti++;
    }
  }
  if (ti < token.length) return 0;
  return 1 / (1 + gaps);
}

function scoreToken(entry: SearchEntry, token: string): number {
  const t = entry.titleLc.indexOf(token);
  if (t !== -1) {
    if (t === 0) return 100;
    if (isWordStart(entry.titleLc, t)) return 80;
    return 60;
  }
  const h = entry.hostLc.indexOf(token);
  if (h !== -1) return h === 0 ? 55 : 45;
  if (entry.urlLc.includes(token)) return 35;
  if (entry.pathLc.includes(token)) return 25;
  if (token.length >= 2) {
    const fuzzy = subsequenceScore(entry.titleLc, token);
    if (fuzzy > 0) return 10 + 15 * fuzzy;
  }
  return 0;
}

export function tokenize(query: string): string[] {
  return query.toLowerCase().split(/\s+/).filter(Boolean);
}

export function search(
  state: BookmarkSnapshot,
  query: string,
  { limit = 50, withinFolderId }: SearchOptions = {},
): SearchResult[] {
  const tokens = tokenize(query);
  if (tokens.length === 0) return [];
  const results: SearchResult[] = [];
  for (const entry of buildIndex(state)) {
    if (withinFolderId && !entry.ancestorIds.includes(withinFolderId)) continue;
    let score = 0;
    for (const token of tokens) {
      const s = scoreToken(entry, token);
      if (s === 0) {
        score = 0;
        break;
      }
      score += s;
    }
    if (score === 0) continue;
    // Folders slightly above equally-matching bookmarks; shorter titles first.
    if (entry.kind === 'folder') score += 5;
    score -= Math.min(entry.title.length, 80) / 100;
    results.push({ entry, score });
  }
  results.sort((a, b) => b.score - a.score);
  return results.slice(0, limit);
}

/**
 * Splits `text` into parts for highlighting the query tokens (case-insensitive
 * substring matches only).
 */
export function highlightParts(
  text: string,
  query: string,
): Array<{ text: string; match: boolean }> {
  const tokens = tokenize(query).sort((a, b) => b.length - a.length);
  if (tokens.length === 0) return [{ text, match: false }];
  const lc = text.toLowerCase();
  const marks = new Array<boolean>(text.length).fill(false);
  for (const token of tokens) {
    let from = 0;
    let i: number;
    while ((i = lc.indexOf(token, from)) !== -1) {
      marks.fill(true, i, i + token.length);
      from = i + token.length;
    }
  }
  const parts: Array<{ text: string; match: boolean }> = [];
  for (let i = 0; i < text.length; i++) {
    const match = marks[i] ?? false;
    const last = parts.at(-1);
    if (last && last.match === match) last.text += text[i];
    else parts.push({ text: text[i] ?? '', match });
  }
  return parts;
}
