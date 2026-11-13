import { act, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Dashboard } from '@/src/components/Dashboard';
import {
  ask,
  cleanPicks,
  cleanReply,
  keepClose,
  queryText,
  type AskItem,
} from '@/src/features/ai/ask';
import { setEmbeddingStoreForTests } from '@/src/features/ai/embedCache';
import { memoryStore } from '@/src/lib/idb';
import { resetAskChat, useAskChat } from '@/src/store/askChat';
import { useOverlays } from '@/src/store/overlays';
import { useSettings } from '@/src/store/settings';
import { useUi } from '@/src/store/ui';
import { renderWithBookmarks } from '../helpers/render';

const TOPICS: Array<[RegExp, number[]]> = [
  [/torrent|rarbg|anirena/i, [1, 0, 0]],
  [/react|redux|jsx/i, [0, 1, 0]],
  [/mac|maccy|filmora/i, [0, 0, 1]],
];
const vectorFor = (text: string) =>
  TOPICS.find(([re]) => re.test(text))?.[1] ?? [0.3, 0.3, 0.3];

/** Fake Ollama: embeddings by topic; chat picks candidates that mention a torrent. */
function fakeOllama({ chat = 'ok' as 'ok' | 'fail' | 'hostile' } = {}) {
  const seen = { embedInputs: [] as string[], prompts: [] as string[] };
  const fn = vi.fn(async (url: string, init?: RequestInit) => {
    const path = new URL(url).pathname;
    const body = JSON.parse(String(init?.body ?? '{}'));
    if (path === '/api/embed') {
      seen.embedInputs.push(...body.input);
      return Response.json({ embeddings: body.input.map(vectorFor) });
    }
    if (path === '/api/chat') {
      if (chat === 'fail') return new Response('down', { status: 500 });
      const prompt = body.messages[1].content as string;
      seen.prompts.push(prompt);
      const picks = [...prompt.matchAll(/^\[(\d+)\] .*(?:orrent|RARBG|AniRena)/gim)].map(
        (m) => Number(m[1]),
      );
      const reply =
        chat === 'hostile'
          ? {
              reply: 'Found‮ them <img src=x onerror=alert(1)>',
              picks: [...picks, 99, -1, 'x', 1.5],
            }
          : { reply: 'These look like your torrent sites.', picks };
      return Response.json({ message: { content: JSON.stringify(reply) } });
    }
    return new Response('?', { status: 404 });
  });
  vi.stubGlobal('fetch', fn);
  return seen;
}

const ITEMS: AskItem[] = [
  ['Download thor torrents - RARBG', 'https://rarbg.to/thor'],
  ['AniRena Torrent List', 'https://www.anirena.com/'],
  ['React useEffect cleanup', 'https://react.dev/effects'],
  ['Redux vs Zustand', 'https://blog.dev/zustand'],
  ['Maccy clipboard for Mac', 'https://maccy.app/'],
  ['Filmora for Mac', 'https://filmora.com/mac'],
].map(([title, url], i) => ({
  id: `b${i}`,
  title: title!,
  url: url!,
  folder: 'Bookmarks bar / Imported',
  dateAdded: Date.UTC(2023, 4, 1),
}));

const OPTS = {
  base: 'http://localhost:11434',
  embedModel: 'nomic-embed-text:latest',
  chatModel: 'llama3.2:latest',
};

beforeEach(() => setEmbeddingStoreForTests(memoryStore()));
afterEach(() => {
  vi.unstubAllGlobals();
  resetAskChat();
});

describe('ask', () => {
  it('finds bookmarks from a vague description and only returns real ones', async () => {
    const seen = fakeOllama();
    const answer = await ask('i had torrent sites somewhere', [], ITEMS, [], OPTS);
    expect(answer.ids.sort()).toEqual(['b0', 'b1']);
    expect(answer.reply).toMatch(/torrent/);
    expect(answer.fromModel).toBe(true);
    // Documents and the query use nomic's search prefixes; dates reach the model.
    expect(seen.embedInputs[0]).toMatch(/^search_document: /);
    expect(seen.embedInputs.at(-1)).toBe('search_query: i had torrent sites somewhere');
    expect(seen.prompts[0]).toMatch(/added May 2023/);
  });

  it('treats the chat model as untrusted', async () => {
    fakeOllama({ chat: 'hostile' });
    const answer = await ask('torrents', [], ITEMS, [], OPTS);
    expect(answer.ids.sort()).toEqual(['b0', 'b1']); // 99, -1, 'x', 1.5 dropped
    expect(answer.reply).not.toMatch(/‮/);
  });

  it('falls back to the closest matches when the chat model fails', async () => {
    fakeOllama({ chat: 'fail' });
    const answer = await ask('torrent sites', [], ITEMS, [], OPTS);
    expect(answer.fromModel).toBe(false);
    expect(answer.ids.slice(0, 2).sort()).toEqual(['b0', 'b1']);
  });

  it('reads each bookmark once, then answers from the cache', async () => {
    const seen = fakeOllama();
    await ask('torrent sites', [], ITEMS, [], OPTS);
    const first = seen.embedInputs.length;
    await ask('mac apps', [], ITEMS, [], OPTS);
    expect(seen.embedInputs.length - first).toBe(1); // only the new question
  });

  it('drops padded picks that are far from the best match', () => {
    // Most bookmarks score ~0.2; the real matches ~0.8.
    const scores = Float32Array.from([0.82, 0.78, 0.21, 0.2, 0.19, 0.35, 0.2]);
    expect(keepClose([0, 1, 2, 5], scores, new Set())).toEqual([0, 1]);
    // An exact keyword match stays even when its meaning score is low.
    expect(keepClose([0, 4], scores, new Set([4]))).toEqual([0, 4]);
    expect(keepClose([3], scores, new Set())).toEqual([3]);
  });

  it('cleans picks and replies', () => {
    expect(cleanPicks([3, 3, '2', 0, 7, 1.2, null], 5)).toEqual([2, 1]);
    expect(cleanPicks('nope', 5)).toEqual([]);
    expect(cleanReply('a​b\u0007c')).toBe('a b c');
    expect(cleanReply(42)).toBe('');
    expect(cleanReply('x'.repeat(600))).toHaveLength(500);
    expect(queryText('qwen3-embedding:4b', 'q')).toMatch(/^Instruct: .*\nQuery: q$/s);
  });
});

describe('Ask Arca panel', () => {
  const seed = {
    bar: [
      {
        title: 'Imported',
        children: ITEMS.map(({ title, url }) => ({ title, url })),
      },
    ],
  };

  it('asks to set up when AI is off', async () => {
    await renderWithBookmarks(<Dashboard surface="dashboard" />, seed);
    act(() => useOverlays.getState().openAsk());
    const panel = await screen.findByRole('dialog', { name: 'Ask Arca' });
    expect(
      within(panel).getByRole('button', { name: 'Set up in Settings' }),
    ).toBeVisible();
  });

  it('answers with clickable bookmarks and can show one in its folder', async () => {
    fakeOllama();
    const { fake } = await renderWithBookmarks(<Dashboard surface="dashboard" />, seed);
    await act(() => useSettings.getState().update({ aiEnabled: true }));
    act(() => useOverlays.getState().openAsk('torrent'));
    const panel = await screen.findByRole('dialog', { name: 'Ask Arca' });
    const input = within(panel).getByRole('textbox', { name: 'Ask Arca' });
    expect(input).toHaveValue('torrent');
    await userEvent.clear(input);
    await userEvent.type(input, 'I had torrent bookmarks but forgot where{Enter}');

    expect(
      await within(panel).findByText('These look like your torrent sites.'),
    ).toBeVisible();
    const links = within(panel)
      .getAllByRole('link')
      .filter((a) => a.hasAttribute('data-ask-result'));
    expect(links.map((a) => a.getAttribute('href'))).toEqual(
      expect.arrayContaining(['https://rarbg.to/thor', 'https://www.anirena.com/']),
    );
    expect(links).toHaveLength(2);

    await userEvent.click(
      within(panel).getByRole('button', { name: /Show “AniRena Torrent List”/ }),
    );
    expect(screen.queryByRole('dialog', { name: 'Ask Arca' })).toBeNull();
    expect(useUi.getState().currentFolderId).toBe(fake.findByTitle('Imported')!.id);
    // The conversation is still there when reopened.
    act(() => useOverlays.getState().openAsk());
    expect(
      await screen.findByText('These look like your torrent sites.'),
    ).toBeInTheDocument();
  });

  it('search results offer to ask when nothing matches', async () => {
    await renderWithBookmarks(<Dashboard surface="dashboard" />, seed);
    await act(() => useSettings.getState().update({ aiEnabled: true }));
    act(() => useUi.getState().setQuery('pirate movie places'));
    await userEvent.click(
      await screen.findByRole('button', { name: /Ask Arca about “pirate movie places”/ }),
    );
    const panel = await screen.findByRole('dialog', { name: 'Ask Arca' });
    expect(within(panel).getByRole('textbox', { name: 'Ask Arca' })).toHaveValue(
      'pirate movie places',
    );
    expect(useAskChat.getState().messages).toEqual([]);
  });
});
