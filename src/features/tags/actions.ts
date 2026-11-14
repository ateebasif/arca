import { getMetaStore } from '@/src/store/useMeta';
import * as undo from '../undo/undo';

const same = (a: readonly string[], b: readonly string[]) =>
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
  if (same(before, tags)) return null;
  await store.setTags(id, url, tags);
  return {
    label: 'Changed tags',
    undo: () => store.setTags(undo.resolveId(id), url, before),
  };
}
