import { fakeBrowser } from 'wxt/testing/fake-browser';
import { storageGet, storageSet } from '@/src/lib/storage';
import {
  DEFAULT_PREFS,
  hydrateUi,
  resetUiForTests,
  SIDEBAR_MAX,
  useUi,
} from '@/src/store/ui';

describe('ui store', () => {
  beforeEach(() => resetUiForTests());
  afterEach(() => vi.useRealTimers());

  it('hydrates saved prefs and opens the last folder', async () => {
    await storageSet('ui', { view: 'list', lastFolderId: '42' });
    await hydrateUi();
    const s = useUi.getState();
    expect(s).toMatchObject({ view: 'list', currentFolderId: '42', hydrated: true });
    expect(s.density).toBe(DEFAULT_PREFS.density);
  });

  it('persists pref changes, debounced', async () => {
    await hydrateUi();
    vi.useFakeTimers();
    useUi.getState().setView('list');
    useUi.getState().setDensity('compact');
    await vi.advanceTimersByTimeAsync(300);
    vi.useRealTimers();
    expect(await storageGet('ui', {})).toMatchObject({
      view: 'list',
      density: 'compact',
    });
  });

  it('follows layout changes made in another Arca tab, not its folder', async () => {
    await hydrateUi();
    useUi.getState().openFolder('7');
    // Another tab saves its prefs.
    await storageSet('ui', {
      ...DEFAULT_PREFS,
      view: 'list',
      sort: 'title',
      lastFolderId: '99',
    });
    await vi.waitFor(() => expect(useUi.getState().view).toBe('list'));
    expect(useUi.getState().sort).toBe('title');
    expect(useUi.getState().currentFolderId).toBe('7');
  });

  it("doesn't write back layout it received from another tab", async () => {
    await hydrateUi();
    vi.useFakeTimers();
    const set = vi.spyOn(fakeBrowser.storage.local, 'set');
    await storageSet('ui', { ...DEFAULT_PREFS, view: 'list' });
    set.mockClear();
    await vi.advanceTimersByTimeAsync(400);
    vi.useRealTimers();
    expect(useUi.getState().view).toBe('list');
    expect(set).not.toHaveBeenCalled();
  });

  it('clamps sidebar width', () => {
    useUi.getState().setSidebarWidth(5000);
    expect(useUi.getState().sidebarWidth).toBe(SIDEBAR_MAX);
  });
});
