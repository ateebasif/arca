import { search } from '@/src/features/search/search';
import type { BookmarkSnapshot } from '@/src/store/bookmarkStore';
import { linksWithin } from '@/src/store/selectors';
import type { AskItem } from './ask';

const STOPWORDS = new Set(
  'the and for that this with from have had some something saved save somewhere about what where when which there their them they bookmark bookmarks link links site sites page pages remember dont don’t know find show want wanted looking thing things into also just like were was are you your mine one ones'.split(
    ' ',
  ),
);

/** Every web bookmark, with its full folder path and date. */
export function askItems(state: BookmarkSnapshot): AskItem[] {
  return state.rootIds.flatMap((rootId) => {
    const rootTitle = state.nodes.get(rootId)?.title ?? '';
    return linksWithin(state, rootId)
      .filter((l) => l.node.url && /^https?:/i.test(l.node.url))
      .map((l) => ({
        id: l.node.id,
        title: l.node.title,
        url: l.node.url ?? '',
        folder: [rootTitle, l.folderLabel].filter(Boolean).join(' / '),
        dateAdded: l.node.dateAdded || undefined,
      }));
  });
}

/** Plain keyword matches for the meaningful words, as indexes into items. */
export function keywordHits(
  state: BookmarkSnapshot,
  items: readonly AskItem[],
  question: string,
): number[] {
  const index = new Map(items.map((it, i) => [it.id, i]));
  const words = question
    .toLowerCase()
    .split(/[^\p{L}\p{N}.+#-]+/u)
    .filter((w) => w.length >= 3 && !STOPWORDS.has(w));
  const hits: number[] = [];
  for (const word of new Set(words)) {
    for (const r of search(state, word, { limit: 6 })) {
      const i = index.get(r.entry.node.id);
      if (i !== undefined && !hits.includes(i)) hits.push(i);
    }
  }
  return hits;
}
