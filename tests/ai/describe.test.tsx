import { act, screen } from '@testing-library/react';
import { Dashboard } from '@/src/components/Dashboard';
import {
  cleanDescription,
  describe as describeLinks,
  setDescriptionStoreForTests,
} from '@/src/features/ai/describe';
import { forgetDescriptions } from '@/src/features/ai/useDescription';
import { memoryStore } from '@/src/lib/idb';
import { useSettings } from '@/src/store/settings';
import { useUi } from '@/src/store/ui';
import { renderWithBookmarks } from '../helpers/render';

function fakeChat() {
  const calls: string[] = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (_url: string, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body));
      const list = body.messages[1].content as string;
      calls.push(list);
      const items = list.split('\n').map((line, i) => ({
        n: i + 1,
        d: `About ${line.replace(/^\d+\. /, '').split(' (')[0]}‮`,
      }));
      return Response.json({ message: { content: JSON.stringify({ items }) } });
    }),
  );
  return calls;
}

const OPTS = { base: 'http://localhost:11434', chatModel: 'phi3:3.8b', previews: false };

beforeEach(() => {
  setDescriptionStoreForTests(memoryStore());
  forgetDescriptions();
});
afterEach(() => vi.unstubAllGlobals());

describe('one-line descriptions', () => {
  it('writes them in batches, cleans them, and caches per model', async () => {
    const calls = fakeChat();
    const reqs = Array.from({ length: 14 }, (_, i) => ({
      key: `k${i}`,
      title: `Page ${i}`,
      url: `https://p${i}.dev/`,
    }));
    const first = await describeLinks(reqs, OPTS);
    expect(calls).toHaveLength(2); // 12 + 2
    expect(first.get('k3')).toBe('About Page 3');
    await describeLinks(reqs, OPTS);
    expect(calls).toHaveLength(2); // all cached
    await describeLinks(reqs.slice(0, 1), { ...OPTS, chatModel: 'llama3.2:latest' });
    expect(calls).toHaveLength(3); // another model writes its own
  });

  it('leaves them blank (and uncached) when the model is unavailable', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => Promise.reject(new TypeError('down'))),
    );
    const out = await describeLinks(
      [{ key: 'a', title: 'A', url: 'https://a.dev/' }],
      OPTS,
    );
    expect(out.get('a')).toBe('');
    const calls = fakeChat();
    await describeLinks([{ key: 'a', title: 'A', url: 'https://a.dev/' }], OPTS);
    expect(calls).toHaveLength(1);
  });

  it('cleans model text', () => {
    expect(cleanDescription('  "Stripe​ payouts API"  ')).toBe('Stripe payouts API');
    expect(cleanDescription(5)).toBe('');
    expect(cleanDescription('x'.repeat(300))).toHaveLength(140);
  });

  it('shows under titles in list view when AI is on', async () => {
    fakeChat();
    await renderWithBookmarks(<Dashboard surface="dashboard" />, {
      bar: [{ title: 'Stripe payouts', url: 'https://stripe.com/docs/payouts' }],
    });
    act(() => useUi.getState().openFolder('1'));
    act(() => useUi.getState().setView('list'));
    expect(document.querySelector('[data-description]')).toBeNull();
    await act(() => useSettings.getState().update({ aiEnabled: true }));
    expect(await screen.findByText('About Stripe payouts')).toBeVisible();
    await act(() => useSettings.getState().update({ aiDescriptions: false }));
    expect(screen.queryByText('About Stripe payouts')).toBeNull();
  });
});
