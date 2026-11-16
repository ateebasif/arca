import type { BookmarkNode } from '@/src/lib/bookmarks';

/**
 * Exports the whole library:
 * - Netscape bookmark HTML, the format every browser imports (tags go in the
 *   TAGS attribute, which Firefox and others understand);
 * - an Arca JSON backup with the full tree and tags, for Arca's own import.
 * Both are built from the bookmarks API tree; nothing leaves the computer
 * until you save the file.
 */

type TagsOf = (id: string) => readonly string[];
type NoteOf = (id: string) => string;

const escape = (s: string) =>
  s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

const seconds = (ms?: number) => String(Math.floor((ms ?? 0) / 1000));

export function toNetscapeHtml(
  tree: BookmarkNode,
  tagsOf: TagsOf = () => [],
  noteOf: NoteOf = () => '',
): string {
  const lines = [
    '<!DOCTYPE NETSCAPE-Bookmark-file-1>',
    '<!-- This is an automatically generated file. Exported by Arca. -->',
    '<META HTTP-EQUIV="Content-Type" CONTENT="text/html; charset=UTF-8">',
    '<TITLE>Bookmarks</TITLE>',
    '<H1>Bookmarks</H1>',
    '<DL><p>',
  ];
  const walk = (node: BookmarkNode, depth: number) => {
    const pad = '    '.repeat(depth);
    if (node.url !== undefined) {
      const tags = tagsOf(node.id);
      lines.push(
        `${pad}<DT><A HREF="${escape(node.url)}" ADD_DATE="${seconds(node.dateAdded)}"${
          tags.length ? ` TAGS="${escape(tags.join(','))}"` : ''
        }>${escape(node.title)}</A>`,
      );
      // Notes use the format's description line, which browsers keep on import.
      const note = noteOf(node.id);
      if (note) lines.push(`${pad}<DD>${escape(note).replace(/\n/g, '<BR>')}`);
      return;
    }
    const toolbar = node.id === '1' ? ' PERSONAL_TOOLBAR_FOLDER="true"' : '';
    lines.push(
      `${pad}<DT><H3 ADD_DATE="${seconds(node.dateAdded)}"${toolbar}>${escape(node.title)}</H3>`,
    );
    lines.push(`${pad}<DL><p>`);
    for (const child of node.children ?? []) walk(child, depth + 1);
    lines.push(`${pad}</DL><p>`);
  };
  // The invisible top-level root isn't a folder of its own.
  for (const root of tree.children ?? []) walk(root, 1);
  lines.push('</DL><p>', '');
  return lines.join('\n');
}

export interface ArcaBackupNode {
  title: string;
  url?: string;
  dateAdded?: number;
  tags?: string[];
  note?: string;
  /** Folder icon (one emoji). */
  icon?: string;
  children?: ArcaBackupNode[];
}

export interface ArcaBackup {
  format: 'arca-backup';
  version: 1;
  exportedAt: string;
  roots: ArcaBackupNode[];
}

export function toArcaBackup(
  tree: BookmarkNode,
  tagsOf: TagsOf = () => [],
  now = new Date(),
  noteOf: NoteOf = () => '',
  iconOf: (id: string) => string | undefined = () => undefined,
): ArcaBackup {
  const convert = (node: BookmarkNode): ArcaBackupNode => {
    const tags = tagsOf(node.id);
    const note = noteOf(node.id);
    const icon = node.url === undefined ? iconOf(node.id) : undefined;
    return {
      title: node.title,
      ...(node.url !== undefined ? { url: node.url } : {}),
      ...(node.dateAdded ? { dateAdded: node.dateAdded } : {}),
      ...(tags.length ? { tags: [...tags] } : {}),
      ...(note ? { note } : {}),
      ...(icon ? { icon } : {}),
      ...(node.url === undefined ? { children: (node.children ?? []).map(convert) } : {}),
    };
  };
  return {
    format: 'arca-backup',
    version: 1,
    exportedAt: now.toISOString(),
    roots: (tree.children ?? []).map(convert),
  };
}

/** "arca-bookmarks-2026-11-14.html" */
export function exportFileName(kind: 'html' | 'json', now = new Date()): string {
  const day = now.toISOString().slice(0, 10);
  return kind === 'html' ? `arca-bookmarks-${day}.html` : `arca-backup-${day}.json`;
}
