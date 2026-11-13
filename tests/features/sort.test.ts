import { sortNodes } from '@/src/features/sort';
import type { BNode } from '@/src/store/bookmarkStore';

const node = (title: string, url: string, dateAdded: number): BNode => ({
  id: title,
  parentId: '1',
  title,
  url,
  dateAdded,
  childIds: null,
  isRoot: false,
});

const items = [
  node('beta', 'https://www.zeta.dev/', 3),
  node('Alpha 10', 'https://alpha.dev/', 1),
  node('alpha 2', 'https://alpha.dev/x', 2),
];
const titles = (nodes: BNode[]) => nodes.map((n) => n.title);

describe('sortNodes', () => {
  it('keeps browser order for manual, even when descending', () => {
    expect(titles(sortNodes(items, 'manual', 'desc'))).toEqual(titles(items));
  });

  it('sorts titles case-insensitively with natural numbers', () => {
    expect(titles(sortNodes(items, 'title'))).toEqual(['alpha 2', 'Alpha 10', 'beta']);
    expect(titles(sortNodes(items, 'title', 'desc'))).toEqual([
      'beta',
      'Alpha 10',
      'alpha 2',
    ]);
  });

  it('sorts by date added', () => {
    expect(titles(sortNodes(items, 'date', 'desc'))).toEqual([
      'beta',
      'alpha 2',
      'Alpha 10',
    ]);
  });

  it('sorts by domain without www, then title', () => {
    expect(titles(sortNodes(items, 'domain'))).toEqual(['alpha 2', 'Alpha 10', 'beta']);
  });

  it('does not mutate the input', () => {
    const copy = [...items];
    sortNodes(items, 'title');
    expect(items).toEqual(copy);
  });
});
