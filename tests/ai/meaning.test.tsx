import { fakeBrowser } from 'wxt/testing/fake-browser';
import userEvent from '@testing-library/user-event';
import { act, screen, within } from '@testing-library/react';
import { Dashboard } from '@/src/components/Dashboard';
import { docText, type AskItem } from '@/src/features/ai/ask';
import { setEmbeddingStoreForTests, writeCached } from '@/src/features/ai/embedCache';
import { meaningMatches } from '@/src/features/ai/meaningSearch';
import { memoryStore } from '@/src/lib/idb';
import { useSettings } from '@/src/store/settings';
import { useUi } from '@/src/store/ui';
import { renderWithBookmarks } from '../helpers/render';

const MODEL = 'nomic-embed-text:latest';
const BASE = 'http://localhost:11434';
// Topic axes: video downloads, cooking, coding.
const vec = (text: string) =>
  /download|youtube|video|downie/i.test(text)
    ? [1, 0, 0]
    : /recipe|curry|karahi|cook/i.test(text)
      ? [0, 1, 0]
      : [0, 0, 1];

function fakeEmbed() {
  const inputs: string[] = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (_u: string, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body));
      inputs.push(...body.input);
      return Response.json({ embeddings: body.input.map(vec) });
    }),
  );
  return inputs;
}

const ITEMS: AskItem[] = [
  ['Downie', 'https://software.charliemonroe.net/downie'],
  ['Spicy Chicken Karahi', 'https://teaforturmeric.com/karahi'],
  ['React docs', 'https://react.dev/'],
  ['Vue docs', 'https://vuejs.org/'],
  ['Svelte docs', 'https://svelte.dev/'],
].map(([title, url], i) => ({
  id: `b${i}`,
  title: title!,
  url: url!,
  folder: 'Bookmarks bar',
}));

async function cacheAll(items: AskItem[]) {
  for (const it of items) await writeCached(MODEL, docText(MODEL, it), vec(it.title));
}

beforeEach(() => setEmbeddingStoreForTests(memoryStore()));
afterEach(() => vi.unstubAllGlobals());

describe('meaning matches in search', () => {
  it('embeds only the query and finds what keywords miss', async () => {
    await cacheAll(ITEMS);
    const inputs = fakeEmbed();
    const { ids } = await meaningMatches(ITEMS, 'app to save youtube videos', {
      base: BASE,
      embedModel: MODEL,
    });
    expect(ids[0]).toBe('b0');
    expect(ids).not.toContain('b2');
    expect(inputs).toEqual(['search_query: app to save youtube videos']);
  });

  it('skips keyword results and does nothing until bookmarks were read', async () => {
    const inputs = fakeEmbed();
    expect(
      await meaningMatches(ITEMS, 'curry', { base: BASE, embedModel: MODEL }),
    ).toEqual({
      ids: [],
      covered: 0,
    });
    expect(inputs).toEqual([]); // nothing cached: no request at all
    await cacheAll(ITEMS);
    const { ids } = await meaningMatches(
      ITEMS,
      'curry recipe',
      { base: BASE, embedModel: MODEL },
      new Set(['b1']),
    );
    expect(ids).not.toContain('b1');
  });

  it('shows "Related by meaning" under the keyword results', async () => {
    fakeEmbed();
    await renderWithBookmarks(<Dashboard surface="dashboard" />, {
      bar: ITEMS.map(({ title, url }) => ({ title, url })),
    });
    // Cache readings for the real bookmark ids/folders the dashboard uses.
    const { askItems } = await import('@/src/features/ai/askItems');
    const { getBookmarkStore } = await import('@/src/store/useBookmarks');
    await cacheAll(askItems(getBookmarkStore().getSnapshot()));
    await act(() =>
      useSettings.getState().update({ aiEnabled: true, embedModel: MODEL }),
    );
    act(() => useUi.getState().setQuery('video downloader'));
    const section = await screen.findByRole('region', { name: 'Related by meaning' });
    expect(await within(section).findByText('Downie')).toBeVisible();
    expect(within(section).queryByText('React docs')).toBeNull();

    // ↓ past the keyword results reaches the meaning match; Enter opens it.
    const box = screen.getByRole('combobox', { name: 'Search bookmarks' });
    box.focus();
    const keyword = screen.queryAllByRole('option').filter((o) => !section.contains(o));
    for (let i = 0; i <= keyword.length; i++) await userEvent.keyboard('{ArrowDown}');
    const downie = within(section).getByRole('option', { name: /Downie/ });
    expect(downie).toHaveAttribute('aria-selected', 'true');
    expect(box).toHaveAttribute('aria-activedescendant', downie.id);
    const create = vi.spyOn(fakeBrowser.tabs, 'create');
    await userEvent.keyboard('{Enter}');
    await vi.waitFor(() => expect(create).toHaveBeenCalled());
  });
});
