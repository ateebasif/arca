import { BookmarkStore } from '@/src/store/bookmarkStore';
import { highlightParts, search } from '@/src/features/search/search';
import { installFakeBookmarks } from '../fakes/bookmarks';
import { SAMPLE_SEED } from '../helpers/render';

async function load(seed = SAMPLE_SEED) {
  installFakeBookmarks(seed);
  const store = new BookmarkStore();
  await store.start();
  return store.getSnapshot();
}

const titles = (results: ReturnType<typeof search>) => results.map((r) => r.entry.title);

describe('search', () => {
  it('matches titles, hosts, URLs and folder names', async () => {
    const state = await load();
    expect(titles(search(state, 'git'))[0]).toBe('GitHub');
    expect(titles(search(state, 'ycombinator'))).toEqual(['News']);
    expect(titles(search(state, 'mozilla'))).toEqual(['MDN']);
    // Folder results plus bookmarks inside a matching folder path.
    expect(titles(search(state, 'nested'))).toEqual(['Nested', 'Deep']);
  });

  it('requires every token to match and ranks title prefixes first', async () => {
    const state = await load({
      bar: [
        { title: 'React docs', url: 'https://react.dev/' },
        { title: 'Preact', url: 'https://preactjs.com/' },
        { title: 'Docs for React Native', url: 'https://reactnative.dev/' },
      ],
    });
    expect(titles(search(state, 'react'))).toEqual([
      'React docs',
      'Docs for React Native',
      'Preact',
    ]);
    expect(titles(search(state, 'react native'))).toEqual(['Docs for React Native']);
    expect(search(state, 'react zzz')).toEqual([]);
  });

  it('falls back to in-order fuzzy matching', async () => {
    const state = await load({ bar: [{ title: 'Hacker News', url: 'https://hn.dev/' }] });
    expect(titles(search(state, 'hkrnws'))).toEqual(['Hacker News']);
    expect(search(state, 'swn')).toEqual([]);
  });

  it('can be limited to a folder subtree', async () => {
    const state = await load();
    const dev = [...state.nodes.values()].find((n) => n.title === 'Dev')!;
    expect(titles(search(state, 'e', { withinFolderId: dev.id }))).not.toContain(
      'GitHub',
    );
    expect(titles(search(state, 'deep', { withinFolderId: dev.id }))).toEqual(['Deep']);
  });

  it('never returns root folders', async () => {
    const state = await load();
    expect(titles(search(state, 'bookmarks'))).toEqual([]);
  });

  it('searches 5,000 bookmarks in under 50 ms', async () => {
    const words = [
      'alpha',
      'bravo',
      'charlie',
      'delta',
      'echo',
      'foxtrot',
      'golf',
      'hotel',
    ];
    const state = await load({
      bar: Array.from({ length: 50 }, (_, f) => ({
        title: `Folder ${words[f % 8]} ${f}`,
        children: Array.from({ length: 100 }, (_, i) => ({
          title: `${words[i % 8]} ${words[(i * 3) % 8]} page ${f}-${i}`,
          url: `https://${words[(i + f) % 8]}.example.com/${f}/${i}`,
        })),
      })),
    });
    search(state, 'warm'); // build the index once, like the first keystroke
    const start = performance.now();
    for (const q of ['alp', 'echo hotel', 'xmpl', 'golf 42', 'zzz']) search(state, q);
    expect((performance.now() - start) / 5).toBeLessThan(50);
  });
});

describe('highlightParts', () => {
  it('marks every case-insensitive token match', () => {
    expect(highlightParts('React Native', 'nat re')).toEqual([
      { text: 'Re', match: true },
      { text: 'act ', match: false },
      { text: 'Nat', match: true },
      { text: 'ive', match: false },
    ]);
  });
});
