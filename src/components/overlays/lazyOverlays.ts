import { lazy } from 'react';

// Rarely used views load on first open (PRD §10), keeping New Tab light.
const loaders = {
  edit: () => import('./EditDialog').then((m) => ({ default: m.EditDialog })),
  settings: () => import('./SettingsDialog').then((m) => ({ default: m.SettingsDialog })),
  shortcuts: () =>
    import('./ShortcutsDialog').then((m) => ({ default: m.ShortcutsDialog })),
  tidy: () => import('../tidy/TidyPanel'),
};
export const EditDialog = lazy(loaders.edit);
export const SettingsDialog = lazy(loaders.settings);
export const ShortcutsDialog = lazy(loaders.shortcuts);
export const TidyPanel = lazy(loaders.tidy);

/** Warms the lazy chunks once the page is idle, so first opens feel instant. */
export function preloadOverlays(): void {
  const run = () => Object.values(loaders).forEach((load) => void load());
  if ('requestIdleCallback' in window) window.requestIdleCallback(run, { timeout: 2000 });
  else setTimeout(run, 1500);
}
