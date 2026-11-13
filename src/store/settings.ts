import { create } from 'zustand';
import { onStorageChange, storageGet, storageSet } from '@/src/lib/storage';
import { DEFAULT_OLLAMA_URL, localOllamaUrl } from '@/src/lib/ollama';
import { OPEN_DISPOSITIONS, type OpenDisposition } from '@/src/lib/tabs';
import { applyTheme, THEMES, type Theme } from '@/src/lib/theme';
import { bool, isRecord, oneOf, str } from '@/src/lib/validate';

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
  theme: Theme;
  /** Opt-in: fetch and cache page previews (needs the site-access permission). */
  linkPreviews: boolean;
  /** Where a plain click (or Enter) opens a bookmark. */
  openIn: OpenDisposition;
  /** Local AI (Ollama) for "AI organize". Off until set up. */
  aiEnabled: boolean;
  ollamaUrl: string;
  embedModel: string;
  chatModel: string;
}

export const DEFAULT_SETTINGS: Settings = {
  newTabMode: 'dashboard',
  redirectUrl: '',
  saveFolderId: '1',
  // Arca is designed dark-first; System and Light are one click away.
  theme: 'dark',
  linkPreviews: false,
  openIn: 'current',
  aiEnabled: false,
  ollamaUrl: DEFAULT_OLLAMA_URL,
  // Best grouping in testing; nomic-embed-text is ~10× faster but rougher.
  embedModel: 'qwen3-embedding:4b',
  chatModel: 'llama3.2:latest',
};

export const SETTINGS_KEY = 'settings';

/** Checks every saved field; anything invalid falls back to its default. */
export function parseSettings(raw: unknown): Settings {
  const r = isRecord(raw) ? raw : {};
  const d = DEFAULT_SETTINGS;
  return {
    newTabMode: oneOf(r.newTabMode, ['dashboard', 'minimal', 'redirect'], d.newTabMode),
    redirectUrl: str(r.redirectUrl, d.redirectUrl),
    saveFolderId: str(r.saveFolderId, d.saveFolderId, 64),
    theme: oneOf(r.theme, THEMES, d.theme),
    linkPreviews: bool(r.linkPreviews, d.linkPreviews),
    openIn: oneOf(r.openIn, OPEN_DISPOSITIONS, d.openIn),
    aiEnabled: bool(r.aiEnabled, d.aiEnabled),
    // Only ever a loopback address: bookmark titles never leave this machine.
    ollamaUrl: localOllamaUrl(str(r.ollamaUrl, d.ollamaUrl, 200)) ?? d.ollamaUrl,
    embedModel: str(r.embedModel, d.embedModel, 200),
    chatModel: str(r.chatModel, d.chatModel, 200),
  };
}

export async function loadSettings(): Promise<Settings> {
  return parseSettings(await storageGet<unknown>(SETTINGS_KEY, {}));
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
    const next = parseSettings({ ...get(), ...patch });
    if (patch.theme) applyTheme(next.theme);
    await storageSet<Settings>(SETTINGS_KEY, next);
  },
}));

let unsubscribe: (() => void) | undefined;

/** Loads settings and keeps them in sync with other extension pages. */
export async function hydrateSettings(): Promise<Settings> {
  const settings = await loadSettings();
  useSettings.setState({ ...settings, loaded: true });
  applyTheme(settings.theme);
  unsubscribe ??= onStorageChange<unknown>(SETTINGS_KEY, (raw) => {
    const next = parseSettings(raw);
    useSettings.setState(next);
    applyTheme(next.theme);
  });
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
