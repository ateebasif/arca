import * as bm from '@/src/lib/bookmarks';
import * as undo from '../undo/undo';

/** Points moved bookmarks at where they now live, as one undo step. */
export async function updateUrls(
  changes: ReadonlyArray<{ id: string; url: string }>,
): Promise<number> {
  const steps: undo.UndoAction[] = [];
  try {
    for (const { id, url } of changes) {
      const node = await bm.getNode(id).catch(() => null);
      if (!node?.url || node.url === url || !/^https?:\/\//i.test(url)) continue;
      await bm.update(id, { url });
      steps.push(undo.changed(id, { title: node.title, url: node.url }, ''));
    }
  } finally {
    if (steps.length) {
      undo.record(
        undo.combine(
          `Updated ${steps.length} moved ${steps.length === 1 ? 'link' : 'links'}`,
          steps,
        ),
      );
    }
  }
  return steps.length;
}
