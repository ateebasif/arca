import { displayHost } from '@/src/lib/url';
import type { BNode } from '@/src/store/bookmarkStore';
import type { SortDirection, SortMode } from '@/src/store/ui';

const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' });

const byTitle = (a: BNode, b: BNode) => collator.compare(a.title, b.title);

const comparators: Record<Exclude<SortMode, 'manual'>, (a: BNode, b: BNode) => number> = {
  title: byTitle,
  date: (a, b) => a.dateAdded - b.dateAdded || byTitle(a, b),
  domain: (a, b) =>
    collator.compare(displayHost(a.url ?? ''), displayHost(b.url ?? '')) || byTitle(a, b),
};

/**
 * Returns a sorted copy. "manual" keeps browser order (and ignores direction),
 * so it always matches what the browser's own bookmark manager shows.
 */
export function sortNodes(
  nodes: readonly BNode[],
  mode: SortMode,
  direction: SortDirection = 'asc',
): BNode[] {
  if (mode === 'manual') return [...nodes];
  const compare = comparators[mode];
  const sign = direction === 'asc' ? 1 : -1;
  return [...nodes].sort((a, b) => sign * compare(a, b));
}

export const SORT_LABELS: Record<SortMode, string> = {
  manual: 'Manual',
  title: 'Title',
  date: 'Date added',
  domain: 'Domain',
};
