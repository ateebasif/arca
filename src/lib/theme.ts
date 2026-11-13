/**
 * Theme handling. "system" follows prefers-color-scheme; "light"/"dark" force
 * it via data-theme on <html>, which the CSS tokens key off.
 *
 * The choice is mirrored to localStorage so each page can apply it
 * synchronously before React renders (no light flash on a dark New Tab).
 */

export type Theme = 'system' | 'light' | 'dark';
export const THEMES: readonly Theme[] = ['system', 'light', 'dark'];

const MIRROR_KEY = 'arca-theme';

export function applyTheme(theme: Theme): void {
  const root = document.documentElement;
  if (theme === 'system') delete root.dataset.theme;
  else root.dataset.theme = theme;
  try {
    localStorage.setItem(MIRROR_KEY, theme);
  } catch {
    // Storage can be unavailable; the async settings load still applies it.
  }
}

/** Applies the last known theme immediately. Call first thing on each page. */
export function applyCachedTheme(): void {
  try {
    const cached = localStorage.getItem(MIRROR_KEY);
    if (cached && (THEMES as readonly string[]).includes(cached))
      applyTheme(cached as Theme);
  } catch {
    // Fall back to the system theme until settings load.
  }
}
