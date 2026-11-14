import { storageGet, storageSet } from '@/src/lib/storage';
import {
  DEFAULT_SETTINGS,
  hydrateSettings,
  redirectTarget,
  resetSettingsForTests,
  useSettings,
} from '@/src/store/settings';

describe('settings', () => {
  beforeEach(() => resetSettingsForTests());

  it('loads defaults and saved values', async () => {
    expect(await hydrateSettings()).toEqual(DEFAULT_SETTINGS);
    await storageSet('settings', { newTabMode: 'minimal' });
    expect((await hydrateSettings()).newTabMode).toBe('minimal');
  });

  it('saves updates and follows changes from other pages', async () => {
    await hydrateSettings();
    await useSettings
      .getState()
      .update({ newTabMode: 'redirect', redirectUrl: 'https://a.dev/' });
    expect(await storageGet('settings', {})).toMatchObject({ newTabMode: 'redirect' });
    await storageSet('settings', { newTabMode: 'minimal' });
    expect(useSettings.getState().newTabMode).toBe('minimal');
  });

  it('only redirects to http(s) URLs', () => {
    const base = { ...DEFAULT_SETTINGS, newTabMode: 'redirect' as const };
    expect(redirectTarget({ ...base, redirectUrl: 'https://a.dev' })).toBe(
      'https://a.dev/',
    );
    expect(redirectTarget({ ...base, redirectUrl: 'chrome://newtab' })).toBeNull();
    expect(redirectTarget({ ...base, redirectUrl: '' })).toBeNull();
    expect(
      redirectTarget({ ...DEFAULT_SETTINGS, redirectUrl: 'https://a.dev' }),
    ).toBeNull();
  });
});

describe('settings migration', () => {
  it('switches saved settings to "new tab" once, then leaves later choices alone', async () => {
    const { migrateSettings, SETTINGS_VERSION } = await import('@/src/store/settings');
    expect(migrateSettings({ openIn: 'window', theme: 'dark' })).toEqual({
      value: { openIn: 'new-tab', theme: 'dark', version: SETTINGS_VERSION },
      changed: true,
    });
    const later = { openIn: 'window', version: SETTINGS_VERSION };
    expect(migrateSettings(later)).toEqual({ value: later, changed: false });
    // Fresh installs just get the default.
    expect(migrateSettings({}).changed).toBe(false);
  });
});
