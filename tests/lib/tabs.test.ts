import { fakeBrowser } from 'wxt/testing/fake-browser';
import { getActiveTab, getCurrentWindowTabs, openUrl, openUrls } from '@/src/lib/tabs';

describe('tabs', () => {
  it('lists tabs in the current window and finds the active one', async () => {
    const a = { id: 1, url: 'https://a.dev/', active: true };
    const b = { id: 2, url: 'https://b.dev/', active: false };
    const query = vi
      .spyOn(fakeBrowser.tabs, 'query')
      .mockImplementation(async (info) => (info.active ? [a] : [a, b]) as never);

    expect((await getCurrentWindowTabs()).map((t) => t.url)).toEqual([a.url, b.url]);
    expect(query).toHaveBeenLastCalledWith({ currentWindow: true });

    expect((await getActiveTab())?.url).toBe(a.url);
    expect(query).toHaveBeenLastCalledWith({ active: true, currentWindow: true });
  });

  it('returns undefined when there is no active tab', async () => {
    vi.spyOn(fakeBrowser.tabs, 'query').mockResolvedValue([] as never);
    expect(await getActiveTab()).toBeUndefined();
  });

  it('opens a URL in the current tab, a new tab, or the background', async () => {
    const update = vi.spyOn(fakeBrowser.tabs, 'update').mockResolvedValue({} as never);
    const create = vi.spyOn(fakeBrowser.tabs, 'create').mockResolvedValue({} as never);

    await openUrl('https://a.dev/');
    expect(update).toHaveBeenCalledWith({ url: 'https://a.dev/' });

    await openUrl('https://b.dev/', 'new-tab');
    expect(create).toHaveBeenLastCalledWith({ url: 'https://b.dev/', active: true });

    await openUrl('https://c.dev/', 'background');
    expect(create).toHaveBeenLastCalledWith({ url: 'https://c.dev/', active: false });
  });

  it('opens many URLs in order, in the background', async () => {
    const create = vi.spyOn(fakeBrowser.tabs, 'create').mockResolvedValue({} as never);
    await openUrls(['https://1.dev/', 'https://2.dev/']);
    expect(create.mock.calls.map(([arg]) => arg)).toEqual([
      { url: 'https://1.dev/', active: false },
      { url: 'https://2.dev/', active: false },
    ]);
  });
});
