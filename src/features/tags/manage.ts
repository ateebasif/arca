import { getMetaStore } from '@/src/store/useMeta';
import * as undo from '../undo/undo';
import { cleanTag, tagStem } from './meta';

/**
 * Tag manager actions. Each changes every bookmark/folder carrying the tag
 * and records ONE undo step that puts the previous tags back.
 */

async function apply(
  label: string,
  change: (tags: readonly string[]) => readonly string[],
): Promise<number> {
  const store = getMetaStore();
  await store.start();
  const before = await store.transformTags(change);
  if (before.size) {
    undo.record({
      label,
      undo: () => store.restore(before, undo.resolveId),
    });
  }
  return before.size;
}

/**
 * Renames tags to `target` (several sources = merge). Items keep their other
 * tags; the merged tag takes the first source's colour if it had none.
 */
export async function mergeTags(
  sources: readonly string[],
  target: string,
): Promise<number> {
  const to = cleanTag(target);
  const from = sources.map(cleanTag).filter((t) => t && t !== to);
  if (!to || from.length === 0) return 0;
  const store = getMetaStore();
  await store.start();
  const colors = store.getSnapshot().colors;
  const inherited = from.map((t) => colors.get(t)).find((c) => c !== undefined);
  if (!colors.has(to) && inherited !== undefined) await store.setColor(to, inherited);
  const label =
    from.length === 1
      ? `Renamed #${from[0]} to #${to}`
      : `Merged ${from.length} tags into #${to}`;
  return apply(label, (tags) =>
    tags.some((t) => from.includes(t))
      ? [...tags.filter((t) => !from.includes(t)), to]
      : tags,
  );
}

export const renameTag = (from: string, to: string) => mergeTags([from], to);

export async function deleteTag(tag: string): Promise<number> {
  const t = cleanTag(tag);
  return apply(`Deleted tag #${t}`, (tags) => tags.filter((x) => x !== t));
}

/** Groups of look-alike tags ("react", "reactjs", "React.js"), most used first. */
export function lookAlikes(
  tags: ReadonlyArray<{ tag: string; count: number }>,
): string[][] {
  const groups = new Map<string, Array<{ tag: string; count: number }>>();
  for (const t of tags) {
    const stem = tagStem(t.tag);
    if (stem.length < 2) continue;
    groups.set(stem, [...(groups.get(stem) ?? []), t]);
  }
  return [...groups.values()]
    .filter((g) => g.length > 1)
    .map((g) => g.sort((a, b) => b.count - a.count).map((x) => x.tag));
}
