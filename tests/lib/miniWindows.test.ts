import { fakeBrowser } from 'wxt/testing/fake-browser';
import {
  closeMiniWindow,
  isMiniWindow,
  listMiniWindows,
  openMiniWindow,
  promoteMiniWindow,
} from '@/src/lib/miniWindows';

// The fake browser doesn't create a tab with a new window; real browsers do.
beforeEach(() => {
  const create = fakeBrowser.windows.create.bind(fakeBrowser.windows);
  vi.spyOn(fakeBrowser.windows, 'create').mockImplementation((async (data?: {
    url?: string;
  }) => {
    const win = await create(data);
    await fakeBrowser.tabs.create({ windowId: win!.id, url: data?.url });
    return win;
  }) as typeof fakeBrowser.windows.create);
});

describe('mini windows', () => {
  it('opens a small popup window and remembers it', async () => {
    const create = vi.mocked(fakeBrowser.windows.create);
    await openMiniWindow('https://example.com/page');
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({ url: 'https://example.com/page', type: 'popup' }),
    );
    const win = await create.mock.results[0]!.value;
    expect(await isMiniWindow(win.id)).toBe(true);
    expect((await listMiniWindows()).map((m) => m.windowId)).toEqual([win.id]);
  });

  it('refuses code-carrying links', async () => {
    await expect(openMiniWindow('javascript:alert(1)')).rejects.toMatchObject({
      code: 'BLOCKED_URL',
    });
  });

  it('"Open in main window" makes a tab there and closes the mini window', async () => {
    const main = await fakeBrowser.windows.create({ url: 'about:blank' });
    const create = vi.mocked(fakeBrowser.windows.create);
    await openMiniWindow('https://example.com/page');
    const mini = await create.mock.results.at(-1)!.value;
    const tabsCreate = vi.spyOn(fakeBrowser.tabs, 'create');
    await promoteMiniWindow(mini.id, main!.id);
    expect(tabsCreate).toHaveBeenCalledWith({
      windowId: main!.id,
      url: 'https://example.com/page',
      active: true,
    });
    expect(await isMiniWindow(mini.id)).toBe(false);
    expect(await fakeBrowser.windows.get(mini.id)).toBeUndefined();
  });

  it('never touches windows Arca did not open', async () => {
    const other = await fakeBrowser.windows.create({
      url: 'https://x.dev/',
      type: 'popup',
    });
    const tabsCreate = vi.spyOn(fakeBrowser.tabs, 'create');
    await promoteMiniWindow(other!.id!);
    await closeMiniWindow(-1);
    expect(tabsCreate).not.toHaveBeenCalled();
    expect(await fakeBrowser.windows.get(other!.id!)).toBeDefined();
  });
});
