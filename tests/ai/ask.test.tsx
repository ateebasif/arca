import { act, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Dashboard } from '@/src/components/Dashboard';
import {
  ask,
  cleanPicks,
  cleanReasons,
  cleanReply,
  keepClose,
  queryText,
  type AskItem,
} from '@/src/features/ai/ask';
import { setEmbeddingStoreForTests } from '@/src/features/ai/embedCache';
import { memoryStore } from '@/src/lib/idb';
import {
  askPanelWasOpen,
  parseSaved,
  resetAskChat,
  useAskChat,
} from '@/src/store/askChat';
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
    expect(answer.ids).toEqual([]);
    expect(answer.matches.slice(0, 2).sort()).toEqual(['b0', 'b1']);
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

  it('reports matches before the chat model answers, and lists picks first', async () => {
    fakeOllama();
    const seen: string[][] = [];
    const answer = await ask('torrent', [], ITEMS, [4], {
      ...OPTS,
      onMatches: (ids) => seen.push(ids),
    });
    expect(seen).toHaveLength(1);
    // Keyword hit (index 4) is kept even though its meaning is unrelated.
    expect(seen[0]).toEqual(expect.arrayContaining(['b0', 'b1', 'b4']));
    expect(answer.matches.slice(0, answer.ids.length)).toEqual(answer.ids);
  });

  it('shares cached readings with AI organize (qwen3 needs no prefix)', async () => {
    const seen = fakeOllama();
    const qwen = { ...OPTS, embedModel: 'qwen3-embedding:4b' };
    const { planGroups } = await import('@/src/features/ai/organize');
    await planGroups(ITEMS, { ...qwen, groups: 2 });
    await new Promise((r) => setTimeout(r, 0));
    const before = seen.embedInputs.length;
    await ask('torrent sites', [], ITEMS, [], qwen);
    expect(seen.embedInputs.length - before).toBe(1); // only the question
  });

  it('follow-ups can narrow the previous results instead of searching again', async () => {
    fakeOllama();
    const real = vi.mocked(fetch).getMockImplementation()!;
    vi.mocked(fetch).mockImplementation(async (url, init) => {
      if (!String(url).endsWith('/api/chat')) return real(url as string, init);
      const body = JSON.parse(String(init?.body));
      const prompt = body.messages[1].content as string;
      // A small model that picks an earlier result but mislabels it "new".
      const earlier = [...prompt.matchAll(/^\[(\d+)\] (.*)\(shown before\)$/gm)];
      const anime = earlier.find((m) => /AniRena/.test(m[2]!));
      return Response.json({
        message: {
          content: JSON.stringify({
            about: 'new',
            reply: 'That one is the anime site.',
            picks: anime ? [Number(anime[1])] : [],
          }),
        },
      });
    });
    const first = await ask('torrent sites', [], ITEMS, [], OPTS);
    const previous = ['b0', 'b1'];
    const followUp = await ask(
      'only the anime one',
      [
        { role: 'user', text: 'torrent sites' },
        { role: 'arca', text: first.reply },
      ],
      ITEMS,
      [],
      { ...OPTS, previous },
    );
    expect(followUp.about).toBe('previous');
    expect(followUp.ids).toEqual(['b1']);
    // The rest of the earlier results stay available for the next follow-up.
    expect(followUp.matches).toEqual(['b1', 'b0']);
  });

  it("follow-ups don't show instant matches (the model decides what fits)", async () => {
    fakeOllama();
    const onMatches = vi.fn();
    await ask('any recipes?', [{ role: 'user', text: 'x' }], ITEMS, [], {
      ...OPTS,
      previous: ['b0'],
      onMatches,
    });
    expect(onMatches).not.toHaveBeenCalled();
  });

  it('"which would you pick" ranks up to five, with reasons for the model\'s picks', async () => {
    fakeOllama();
    const real = vi.mocked(fetch).getMockImplementation()!;
    vi.mocked(fetch).mockImplementation(async (url, init) => {
      if (!String(url).endsWith('/api/chat')) return real(url as string, init);
      const prompt = JSON.parse(String(init?.body)).messages[1].content as string;
      const anime = [...prompt.matchAll(/^\[(\d+)\] AniRena.*\(shown before\)$/gm)][0];
      return Response.json({
        message: {
          content: JSON.stringify({
            about: 'previous',
            reply: 'I would go with AniRena.',
            picks: [{ n: Number(anime![1]), why: 'Anime\u202E focused' }],
          }),
        },
      });
    });
    const answer = await ask(
      'which would you pick?',
      [{ role: 'user', text: 'torrents' }],
      ITEMS,
      [],
      {
        ...OPTS,
        previous: ['b0', 'b1', 'b2', 'b3', 'b4', 'b5'],
      },
    );
    expect(answer.ids).toEqual(['b1', 'b0', 'b2', 'b3', 'b4']);
    expect(answer.reasons).toEqual({ b1: 'Anime focused' });
  });

  it('cleans picks and replies', () => {
    expect(cleanPicks([3, 3, '2', 0, 7, 1.2, null], 5)).toEqual([2, 1]);
    expect(cleanPicks('nope', 5)).toEqual([]);
    expect(cleanPicks([{ n: 2, why: 'x' }, { n: 9 }, { why: 'y' }], 5)).toEqual([1]);
    expect([
      ...cleanReasons(
        [
          { n: 2, why: '  short  reason ' },
          { n: 2, why: 'dup' },
        ],
        5,
      ),
    ]).toEqual([[1, 'short reason']]);
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

  it('shows matches while the AI is still answering, with more on demand', async () => {
    let release!: () => void;
    const gate = new Promise<void>((r) => (release = r));
    fakeOllama();
    const real = vi.mocked(fetch).getMockImplementation()!;
    vi.mocked(fetch).mockImplementation(async (url, init) => {
      if (String(url).endsWith('/api/chat')) await gate;
      return real(url as string, init);
    });
    const many = Array.from({ length: 30 }, (_, i) => ({
      title: `Torrent mirror ${i}`,
      url: `https://mirror${i}.dev/`,
    }));
    await renderWithBookmarks(<Dashboard surface="dashboard" />, {
      bar: [
        {
          title: 'Imported',
          children: [...ITEMS.map(({ title, url }) => ({ title, url })), ...many],
        },
      ],
    });
    await act(() => useSettings.getState().update({ aiEnabled: true }));
    act(() => useOverlays.getState().openAsk());
    const panel = await screen.findByRole('dialog', { name: 'Ask Arca' });
    await userEvent.type(
      within(panel).getByRole('textbox', { name: 'Ask Arca' }),
      'torrent sites{Enter}',
    );
    // Matches appear before the chat model replies.
    expect(
      await within(panel).findByText(/Asking llama3\.2:latest which fit best/),
    ).toBeVisible();
    const rows = () =>
      within(panel)
        .queryAllByRole('link')
        .filter((a) => a.hasAttribute('data-ask-result'));
    expect(rows()).toHaveLength(10);
    await userEvent.click(within(panel).getByRole('button', { name: /^Show \d+ more$/ }));
    expect(rows().length).toBeGreaterThan(10);

    await act(async () => release());
    expect(
      await within(panel).findByText('These look like your torrent sites.'),
    ).toBeVisible();
    expect(within(panel).getByText('More matches')).toBeVisible();

    // Jump to the plain keyword search for everything.
    await userEvent.click(
      within(panel).getByRole('button', { name: 'All keyword results for “torrent”' }),
    );
    expect(useUi.getState().query).toBe('torrent');
    expect(screen.queryByRole('dialog', { name: 'Ask Arca' })).toBeNull();
  });

  it('starts reading bookmarks as soon as the panel opens', async () => {
    const seen = fakeOllama();
    // Titles no other test uses, so nothing can already be cached.
    const fresh = Array.from({ length: 5 }, (_, i) => ({
      title: `Warm-up only ${i}`,
      url: `https://warm${i}.dev/`,
    }));
    await renderWithBookmarks(<Dashboard surface="dashboard" />, { bar: fresh });
    await act(() => useSettings.getState().update({ aiEnabled: true }));
    act(() => useOverlays.getState().openAsk());
    await screen.findByRole('dialog', { name: 'Ask Arca' });
    await vi.waitFor(() =>
      expect(seen.embedInputs.filter((t) => t.includes('Warm-up only'))).toHaveLength(5),
    );
    expect(useAskChat.getState().messages).toEqual([]);
  });

  it('keeps the chat in this tab, so coming back after opening a result restores it', async () => {
    fakeOllama();
    await renderWithBookmarks(<Dashboard surface="dashboard" />, seed);
    await act(() => useSettings.getState().update({ aiEnabled: true }));
    act(() => useOverlays.getState().openAsk());
    const panel = await screen.findByRole('dialog', { name: 'Ask Arca' });
    expect(askPanelWasOpen()).toBe(true);
    await userEvent.type(
      within(panel).getByRole('textbox', { name: 'Ask Arca' }),
      'torrent{Enter}',
    );
    await within(panel).findByText('These look like your torrent sites.');
    // What a same-tab navigation leaves behind: the chat, and that the panel was open.
    const saved = parseSaved(JSON.parse(sessionStorage.getItem('arca.ask')!));
    expect(saved.open).toBe(true);
    expect(saved.messages.map((m) => m.role)).toEqual(['user', 'arca']);
    expect(saved.messages[1]!.ids?.length).toBeGreaterThan(0);
    // Closing the panel on purpose means it doesn't reopen.
    act(() => useOverlays.getState().closeAsk());
    expect(askPanelWasOpen()).toBe(false);
  });

  it('drops tampered saved chats', () => {
    expect(parseSaved('junk')).toEqual({ messages: [], open: false });
    const { messages } = parseSaved({
      open: true,
      messages: [
        { id: 1, role: 'user', text: 'hi' },
        { id: 2, role: 'system', text: 'pwned' },
        { id: 'x', role: 'arca', text: 'bad id' },
        {
          id: 3,
          role: 'arca',
          text: 'ok',
          ids: ['5', 7, 'x'.repeat(100)],
          matches: 'nope',
        },
      ],
    });
    expect(messages).toEqual([
      {
        id: 1,
        role: 'user',
        text: 'hi',
        ids: undefined,
        matches: undefined,
        fromModel: undefined,
      },
      {
        id: 3,
        role: 'arca',
        text: 'ok',
        ids: ['5'],
        matches: undefined,
        fromModel: undefined,
      },
    ]);
  });

  it('lets you pick the answer model, marking the smallest as fastest', async () => {
    const seen = fakeOllama();
    const real = vi.mocked(fetch).getMockImplementation()!;
    const models: string[] = [];
    vi.mocked(fetch).mockImplementation(async (url, init) => {
      const path = new URL(String(url)).pathname;
      if (path === '/api/tags') {
        return Response.json({
          models: [
            { name: 'mistral:latest', size: 4.1e9, details: { family: 'llama' } },
            { name: 'llama3.2:latest', size: 2e9, details: { family: 'llama' } },
            {
              name: 'nomic-embed-text:latest',
              size: 2.7e8,
              details: { family: 'nomic-bert' },
            },
          ],
        });
      }
      if (path === '/api/chat') models.push(JSON.parse(String(init?.body)).model);
      return real(url as string, init);
    });
    await renderWithBookmarks(<Dashboard surface="dashboard" />, seed);
    await act(() =>
      useSettings.getState().update({ aiEnabled: true, chatModel: 'mistral:latest' }),
    );
    act(() => useOverlays.getState().openAsk());
    const panel = await screen.findByRole('dialog', { name: 'Ask Arca' });
    const picker = await within(panel).findByRole('combobox', { name: 'Answer model' });
    const options = within(picker)
      .getAllByRole('option')
      .map((o) => o.textContent);
    expect(options).toEqual([
      'llama3.2:latest · 2.0 GB · fastest',
      'mistral:latest · 4.1 GB',
    ]);
    expect(picker).toHaveValue('mistral:latest');
    await userEvent.selectOptions(picker, 'llama3.2:latest');
    expect(useSettings.getState().askModel).toBe('llama3.2:latest');
    expect(useSettings.getState().chatModel).toBe('mistral:latest'); // naming unchanged
    await userEvent.type(
      within(panel).getByRole('textbox', { name: 'Ask Arca' }),
      'torrent{Enter}',
    );
    await within(panel).findByText('These look like your torrent sites.');
    expect(models).toEqual(['llama3.2:latest']);
    expect(seen.prompts).toHaveLength(1);
  });

  it('shows reading progress in the sidebar and above the input', async () => {
    let release!: () => void;
    const gate = new Promise<void>((r) => (release = r));
    fakeOllama();
    const real = vi.mocked(fetch).getMockImplementation()!;
    vi.mocked(fetch).mockImplementation(async (url, init) => {
      if (String(url).endsWith('/api/embed')) await gate;
      return real(url as string, init);
    });
    const many = Array.from({ length: 70 }, (_, i) => ({
      title: `Link ${i}`,
      url: `https://l${i}.dev/`,
    }));
    await renderWithBookmarks(<Dashboard surface="dashboard" />, { bar: many });
    await act(() => useSettings.getState().update({ aiEnabled: true }));
    act(() => useOverlays.getState().openAsk());
    const panel = await screen.findByRole('dialog', { name: 'Ask Arca' });
    expect(
      await within(panel).findByText(/Reading your bookmarks once · 0\/70/),
    ).toBeVisible();
    expect(screen.getByRole('button', { name: /Ask Arca/ })).toHaveTextContent(
      'reading 0%',
    );
    await act(async () => release());
    await vi.waitFor(() =>
      expect(screen.getByRole('button', { name: /Ask Arca/ })).toHaveTextContent(
        'find by description',
      ),
    );
  });
});
