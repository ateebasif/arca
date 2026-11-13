import { create } from 'zustand';
import { onStorageChange, storageGet, storageSet } from '@/src/lib/storage';

/**
 * User settings (PRD §8.13), stored in chrome.storage.local under "settings".
 * Phase 1 covers the New Tab mode; the full settings page extends this.
 */

export type NewTabMode = 'dashboard' | 'minimal' | 'redirect';

export interface Settings {
  newTabMode: NewTabMode;
  redirectUrl: string;
  /** Folder the popup's "Bookmark this tab" saves into. */
  saveFolderId: string;
}

export const DEFAULT_SETTINGS: Settings = {
  newTabMode: 'dashboard',
  redirectUrl: '',
  saveFolderId: '1',
};

export const SETTINGS_KEY = 'settings';

export async function loadSettings(): Promise<Settings> {
  const saved = await storageGet<Partial<Settings>>(SETTINGS_KEY, {});
  return { ...DEFAULT_SETTINGS, ...saved };
}

interface SettingsState extends Settings {
  loaded: boolean;
  update(patch: Partial<Settings>): Promise<void>;
}

export const useSettings = create<SettingsState>()((set, get) => ({
  ...DEFAULT_SETTINGS,
  loaded: false,
  update: async (patch) => {
    set(patch);
    const { newTabMode, redirectUrl, saveFolderId } = { ...get(), ...patch };
    await storageSet<Settings>(SETTINGS_KEY, { newTabMode, redirectUrl, saveFolderId });
  },
}));

let unsubscribe: (() => void) | undefined;

/** Loads settings and keeps them in sync with other extension pages. */
export async function hydrateSettings(): Promise<Settings> {
  const settings = await loadSettings();
  useSettings.setState({ ...settings, loaded: true });
  unsubscribe ??= onStorageChange<Partial<Settings>>(SETTINGS_KEY, (next) =>
    useSettings.setState({ ...DEFAULT_SETTINGS, ...next }),
  );
  return settings;
}

export function resetSettingsForTests(): void {
  unsubscribe?.();
  unsubscribe = undefined;
  useSettings.setState({ ...DEFAULT_SETTINGS, loaded: false });
}

/** Redirect target if it's a safe http(s) URL, else null (avoids New Tab loops). */
export function redirectTarget(settings: Settings): string | null {
  if (settings.newTabMode !== 'redirect') return null;
  try {
    const url = new URL(settings.redirectUrl);
    return /^https?:$/.test(url.protocol) ? url.href : null;
  } catch {
    return null;
  }
}
