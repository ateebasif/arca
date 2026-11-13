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

  it('clamps sidebar width', () => {
    useUi.getState().setSidebarWidth(5000);
    expect(useUi.getState().sidebarWidth).toBe(SIDEBAR_MAX);
  });
});
