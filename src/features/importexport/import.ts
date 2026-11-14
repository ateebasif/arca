import * as bm from '@/src/lib/bookmarks';
import { classifyUrl } from '@/src/lib/url';
import { cleanTags } from '@/src/features/tags/meta';
import { setTagsMany } from '@/src/features/tags/actions';
import { normalizeUrl } from '@/src/features/tidy/normalize';
import * as undo from '../undo/undo';

/**
 * Import (PRD §8.10): a Netscape bookmark HTML file (what every browser
 * exports) or an Arca JSON backup, into one new folder. Files are untrusted:
 * HTML is parsed with DOMParser (inert, nothing is rendered or run), sizes and
 * counts are capped, titles are cleaned, and code-carrying links
 * (javascript:, data:) are skipped like everywhere else in Arca.
 */

export interface ImportNode {
  title: string;
  url?: string;
  tags?: string[];
  children?: ImportNode[];
}

export interface ParsedImport {
  kind: 'html' | 'arca';
  roots: ImportNode[];
  links: number;
  folders: number;
  /** Links dropped because their address can run code or isn't valid. */
  blocked: number;
  /** Items beyond MAX_ITEMS that were left out. */
  truncated: number;
}

export const MAX_FILE_BYTES = 20 * 1024 * 1024;
export const MAX_ITEMS = 25_000;
const MAX_DEPTH = 40;
const MAX_TITLE = 1024;
const MAX_URL = 8192;

export class ImportError extends Error {}

function cleanTitle(raw: unknown): string {
  if (typeof raw !== 'string') return '';
  let out = '';
  for (const ch of raw.slice(0, MAX_TITLE * 2)) {
    const c = ch.codePointAt(0) ?? 0;
    out += c < 0x20 || c === 0x7f || (c >= 0x202a && c <= 0x202e) ? ' ' : ch;
  }
  return out.replace(/\s+/g, ' ').trim().slice(0, MAX_TITLE);
}

/** Shared walker state: counts, caps, blocked links. */
class Builder {
  links = 0;
  folders = 0;
  blocked = 0;
  truncated = 0;
  private items = 0;

  take(): boolean {
    if (this.items >= MAX_ITEMS) {
      this.truncated++;
      return false;
    }
    this.items++;
    return true;
  }

  link(title: unknown, url: unknown, tags: unknown): ImportNode | null {
    const href = typeof url === 'string' ? url.trim() : '';
    if (!href || href.length > MAX_URL || classifyUrl(href) === 'blocked') {
      this.blocked++;
      return null;
    }
    if (!this.take()) return null;
    this.links++;
    const clean = cleanTags(Array.isArray(tags) ? tags : []);
    return {
      title: cleanTitle(title),
      url: href,
      ...(clean.length ? { tags: clean } : {}),
    };
  }

  folder(title: unknown, children: ImportNode[]): ImportNode | null {
    if (!this.take()) return null;
    this.folders++;
    return { title: cleanTitle(title) || 'Untitled folder', children };
  }

  result(kind: ParsedImport['kind'], roots: ImportNode[]): ParsedImport {
    return {
      kind,
      roots,
      links: this.links,
      folders: this.folders,
      blocked: this.blocked,
      truncated: this.truncated,
    };
  }
}

/** Netscape bookmark file (Chrome, Firefox, Safari, Edge, Arc exports). */
export function parseNetscapeHtml(html: string): ParsedImport {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const top = doc.querySelector('dl');
  if (!top) throw new ImportError("This file doesn't look like a bookmarks export.");
  const b = new Builder();
  const walk = (dl: Element, depth: number): ImportNode[] => {
    const out: ImportNode[] = [];
    if (depth > MAX_DEPTH) return out;
    for (const dt of Array.from(dl.children)) {
      if (dt.tagName !== 'DT') continue;
      const head = Array.from(dt.children).find(
        (c) => c.tagName === 'H3' || c.tagName === 'A',
      );
      if (!head) continue;
      if (head.tagName === 'A') {
        const tags = (head.getAttribute('tags') ?? '').split(',');
        const node = b.link(head.textContent, head.getAttribute('href'), tags);
        if (node) out.push(node);
        continue;
      }
      // The folder's list is inside the DT or right after it, depending on the parser.
      const sub =
        Array.from(dt.children).find((c) => c.tagName === 'DL') ??
        (dt.nextElementSibling?.tagName === 'DL' ? dt.nextElementSibling : null);
      const node = b.folder(head.textContent, sub ? walk(sub, depth + 1) : []);
      if (node) out.push(node);
    }
    return out;
  };
  return b.result('html', walk(top, 0));
}

/** Arca's own JSON backup (Settings → Backup). */
export function parseArcaBackup(text: string): ParsedImport {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    throw new ImportError("This file isn't valid JSON.");
  }
  const d = data as { format?: unknown; version?: unknown; roots?: unknown };
  if (d?.format !== 'arca-backup' || d.version !== 1 || !Array.isArray(d.roots)) {
    throw new ImportError("This isn't an Arca backup.");
  }
  const b = new Builder();
  const walk = (list: unknown[], depth: number): ImportNode[] => {
    const out: ImportNode[] = [];
    if (depth > MAX_DEPTH) return out;
    for (const raw of list) {
      if (!raw || typeof raw !== 'object') continue;
      const n = raw as {
        title?: unknown;
        url?: unknown;
        tags?: unknown;
        children?: unknown;
      };
      const node =
        typeof n.url === 'string'
          ? b.link(n.title, n.url, n.tags)
          : b.folder(
              n.title,
              Array.isArray(n.children) ? walk(n.children, depth + 1) : [],
            );
      if (node) out.push(node);
    }
    return out;
  };
  return b.result('arca', walk(d.roots, 0));
}

/** Picks the parser from the file's name and content. */
export function parseImportFile(name: string, text: string): ParsedImport {
  const looksJson = /\.json$/i.test(name) || /^\s*\{/.test(text);
  return looksJson ? parseArcaBackup(text) : parseNetscapeHtml(text);
}

/** How many of the file's links you already have (same page, normalized). */
export function countDuplicates(
  parsed: ParsedImport,
  existingUrls: Iterable<string>,
): number {
  const have = new Set([...existingUrls].map(normalizeUrl));
  let dups = 0;
  const walk = (nodes: ImportNode[]) => {
    for (const n of nodes) {
      if (n.url) {
        if (have.has(normalizeUrl(n.url))) dups++;
      } else walk(n.children ?? []);
    }
  };
  walk(parsed.roots);
  return dups;
}

export interface ImportOptions {
  /** Leave out links you already have. */
  skipDuplicates?: boolean;
  existingUrls?: Iterable<string>;
  /** Folder name; defaults to "Imported <date>". */
  folderTitle?: string;
  onProgress?(done: number, total: number): void;
  now?: Date;
}

/**
 * Creates everything inside one new folder in `parentId`, applies tags, and
 * records one undo step that removes the folder again. Returns its id and
 * how many links were added.
 */
export async function importInto(
  parentId: string,
  parsed: ParsedImport,
  opts: ImportOptions = {},
): Promise<{ folderId: string; links: number; skipped: number }> {
  const have = opts.skipDuplicates
    ? new Set([...(opts.existingUrls ?? [])].map(normalizeUrl))
    : null;
  const day = (opts.now ?? new Date()).toISOString().slice(0, 10);
  const top = await bm.create({
    parentId,
    title: opts.folderTitle?.trim() || `Imported ${day}`,
  });
  const total = parsed.links + parsed.folders;
  let done = 0;
  let links = 0;
  let skipped = 0;
  const tagging: Array<{ id: string; url: string; tags: string[] }> = [];
  const walk = async (nodes: ImportNode[], into: string) => {
    for (const n of nodes) {
      if (n.url) {
        const key = normalizeUrl(n.url);
        if (have?.has(key)) skipped++;
        else {
          const created = await bm.create({ parentId: into, title: n.title, url: n.url });
          have?.add(key);
          links++;
          if (n.tags?.length) tagging.push({ id: created.id, url: n.url, tags: n.tags });
        }
      } else {
        const folder = await bm.create({ parentId: into, title: n.title });
        await walk(n.children ?? [], folder.id);
      }
      if (++done % 25 === 0) opts.onProgress?.(done, total);
    }
  };
  try {
    await walk(parsed.roots, top.id);
  } finally {
    // Even a partial import is one undo.
    const tagStep = await setTagsMany(tagging).catch(() => null);
    undo.record({
      label: `Imported ${links.toLocaleString()} ${links === 1 ? 'bookmark' : 'bookmarks'}`,
      async undo() {
        await tagStep?.undo();
        const id = undo.resolveId(top.id);
        await bm.remove(id).catch(() => {});
      },
    });
  }
  opts.onProgress?.(total, total);
  return { folderId: top.id, links, skipped };
}
