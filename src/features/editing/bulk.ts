import * as bm from '@/src/lib/bookmarks';
import { openUrls } from '@/src/lib/tabs';
import { getMetaStore } from '@/src/store/useMeta';
import { setTags } from '../tags/actions';
import * as undo from '../undo/undo';

/**
 * Actions on several bookmarks/folders at once. Each records ONE undo step.
 * Items that disappeared in the meantime are skipped.
 */

/** Drops ids inside another selected folder (moving/deleting the folder covers them). */
async function topLevel(ids: readonly string[]): Promise<string[]> {
  const set = new Set(ids);
  const out: string[] = [];
  for (const id of ids) {
    const ancestors = await bm.getAncestorIds(id).catch(() => [] as string[]);
    if (!ancestors.some((a) => set.has(a))) out.push(id);
  }
  return out;
}

export async function moveMany(
  ids: readonly string[],
  folderId: string,
): Promise<number> {
  const steps: undo.UndoAction[] = [];
  try {
    for (const id of await topLevel(ids)) {
      const from = await bm.getNode(id).catch(() => null);
      if (!from?.parentId || from.parentId === folderId || id === folderId) continue;
      await bm.move(id, { parentId: folderId });
      steps.push(undo.moved(id, { parentId: from.parentId, index: from.index ?? 0 }, ''));
    }
  } finally {
    if (steps.length) {
      const target = await bm.getNode(folderId).catch(() => null);
      undo.record(
        undo.combine(
          `Moved ${steps.length} ${steps.length === 1 ? 'item' : 'items'} to “${target?.title || 'folder'}”`,
          steps,
        ),
      );
    }
  }
  return steps.length;
}

export async function deleteMany(ids: readonly string[]): Promise<number> {
  const steps: undo.UndoAction[] = [];
  try {
    for (const id of await topLevel(ids)) {
      const removed = await bm.remove(id).catch(() => null);
      if (removed) steps.push(undo.deleted(removed));
    }
  } finally {
    if (steps.length) {
      undo.record(
        undo.combine(
          `Deleted ${steps.length} ${steps.length === 1 ? 'item' : 'items'}`,
          steps,
        ),
      );
    }
  }
  return steps.length;
}

/** Adds and/or removes tags on every item (existing tags are kept). */
export async function retagMany(
  ids: readonly string[],
  add: readonly string[],
  remove: readonly string[] = [],
): Promise<number> {
  const meta = getMetaStore();
  await meta.start();
  const steps: undo.UndoAction[] = [];
  for (const id of ids) {
    const node = await bm.getNode(id).catch(() => null);
    if (!node) continue;
    const current = meta.tagsOf(id);
    const next = [...current.filter((t) => !remove.includes(t)), ...add];
    const step = await setTags(id, node.url ?? '', next);
    if (step) steps.push(step);
  }
  if (steps.length) {
    undo.record(
      undo.combine(
        `Changed tags on ${steps.length} ${steps.length === 1 ? 'item' : 'items'}`,
        steps,
      ),
    );
  }
  return steps.length;
}

/** Web URLs of the selected bookmarks (folders and blocked links skipped). */
export async function urlsOf(ids: readonly string[]): Promise<string[]> {
  const urls: string[] = [];
  for (const id of ids) {
    const node = await bm.getNode(id).catch(() => null);
    if (node?.url && /^https?:/i.test(node.url)) urls.push(node.url);
  }
  return urls;
}

export async function openMany(ids: readonly string[]): Promise<number> {
  const urls = await urlsOf(ids);
  await openUrls(urls);
  return urls.length;
}
