import { getMetaStore } from '@/src/store/useMeta';
import { cleanNote } from './meta';
import * as undo from '../undo/undo';

export const sameTags = (a: readonly string[], b: readonly string[]) =>
  a.length === b.length && a.every((t, i) => t === b[i]);

/** Sets tags and returns an undo step (or null when nothing changed). */
export async function setTags(
  id: string,
  url: string,
  tags: readonly string[],
): Promise<undo.UndoAction | null> {
  const store = getMetaStore();
  await store.start();
  const before = store.tagsOf(id);
  if (sameTags(before, tags)) return null;
  await store.setTags(id, url, tags);
  return {
    label: 'Changed tags',
    undo: () => store.setTags(undo.resolveId(id), url, before),
  };
}

/**
 * Sets tags on many items in one storage write, as one undo step.
 * Returns null when nothing changed.
 */
export async function setTagsMany(
  entries: ReadonlyArray<{ id: string; url: string; tags: readonly string[] }>,
): Promise<undo.UndoAction | null> {
  const store = getMetaStore();
  await store.start();
  const changes = entries
    .map((e) => ({ ...e, before: store.tagsOf(e.id) }))
    .filter((e) => !sameTags(e.before, e.tags));
  if (!changes.length) return null;
  await store.setTagsMany(changes);
  return {
    label: 'Changed tags',
    undo: () =>
      store.setTagsMany(
        changes.map((c) => ({ id: undo.resolveId(c.id), url: c.url, tags: c.before })),
      ),
  };
}

/** Sets an item's note and returns an undo step (or null when unchanged). */
export async function setNote(
  id: string,
  url: string,
  note: string,
): Promise<undo.UndoAction | null> {
  const store = getMetaStore();
  await store.start();
  const before = store.noteOf(id);
  if (before === cleanNote(note)) return null;
  await store.setNote(id, url, note);
  return {
    label: 'Changed note',
    undo: () => store.setNote(undo.resolveId(id), url, before),
  };
}
