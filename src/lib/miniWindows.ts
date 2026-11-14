import { browser } from 'wxt/browser';
import { ArcaError, callApi } from './errors';
import { onStorageChange, storageGet, storageSet } from './storage';
import { classifyUrl } from './url';

/**
 * Mini windows: links opened in a small, toolbar-less window, like a peek.
 * "Open in main window" turns one into a normal tab in your main window and
 * closes the mini window. Arca remembers which windows it opened, so it never
 * touches other popups.
 */

const KEY = 'miniWindows';

export interface MiniWindow {
  windowId: number;
  tabId: number;
  url: string;
  title: string;
}

// Window ids are reused after a browser restart, so they're kept in session
// storage (cleared on quit) and every window is re-checked before Arca acts.
const AREA = 'session';

async function trackedIds(): Promise<number[]> {
  const raw = await storageGet<unknown>(KEY, [], AREA);
  return Array.isArray(raw) ? raw.filter((n): n is number => Number.isInteger(n)) : [];
}

async function setTracked(ids: number[]): Promise<void> {
  await storageSet(KEY, [...new Set(ids)].slice(-20), AREA);
}

/** A tracked id that is still a one-tab popup window, or nothing. */
async function miniWindowTab(windowId: number) {
  if (!(await trackedIds()).includes(windowId)) return undefined;
  const win = await browser.windows.get(windowId).catch(() => null);
  if (!win || win.type !== 'popup') return undefined;
  const tabs = await browser.tabs.query({ windowId }).catch(() => []);
  return tabs.length === 1 ? tabs[0] : undefined;
}

/** Size and place of a mini window: a peek over the right side of the screen. */
function bounds() {
  const availW = globalThis.screen?.availWidth ?? 1280;
  const availH = globalThis.screen?.availHeight ?? 900;
  const width = Math.round(Math.min(1000, availW * 0.6));
  const height = Math.round(Math.min(820, availH - 80));
  return {
    width,
    height,
    left: Math.max(0, Math.round(availW - width - 40)),
    top: Math.max(0, Math.round((availH - height) / 2)),
  };
}

export async function openMiniWindow(url: string): Promise<void> {
  if (classifyUrl(url) === 'blocked') {
    throw new ArcaError('BLOCKED_URL', `Refusing to open ${url.slice(0, 40)}`);
  }
  const win = await callApi('windows.create', () =>
    browser.windows.create({ url, type: 'popup', focused: true, ...bounds() }),
  );
  if (win?.id !== undefined) await setTracked([...(await trackedIds()), win.id]);
}

/** Mini windows that are still open (closed ones are forgotten). */
export async function listMiniWindows(): Promise<MiniWindow[]> {
  const ids = await trackedIds();
  const open: MiniWindow[] = [];
  for (const windowId of ids) {
    const tab = await miniWindowTab(windowId);
    if (tab?.id !== undefined) {
      open.push({ windowId, tabId: tab.id, url: tab.url ?? '', title: tab.title ?? '' });
    }
  }
  if (open.length !== ids.length) await setTracked(open.map((m) => m.windowId));
  return open;
}

export async function isMiniWindow(windowId: number): Promise<boolean> {
  return (await miniWindowTab(windowId)) !== undefined;
}

/**
 * Opens a mini window's page as a normal tab in `targetWindowId` (default:
 * the last focused normal window), focuses it and closes the mini window.
 */
export async function promoteMiniWindow(
  windowId: number,
  targetWindowId?: number,
): Promise<void> {
  const tab = await miniWindowTab(windowId);
  if (!tab) return;
  const url = tab.url ?? '';
  // Pages reached inside the mini window are re-checked before reopening.
  if (url && classifyUrl(url) !== 'blocked') {
    const target =
      targetWindowId ??
      (await browser.windows
        .getLastFocused({ windowTypes: ['normal'] })
        .then((w) => w.id)
        .catch(() => undefined));
    if (target !== undefined) {
      await callApi('tabs.create', () =>
        browser.tabs.create({ windowId: target, url, active: true }),
      );
      await callApi('windows.update', () =>
        browser.windows.update(target, { focused: true }),
      );
    } else {
      await callApi('windows.create', () =>
        browser.windows.create({ url, focused: true }),
      );
    }
  }
  await closeMiniWindow(windowId);
}

export async function closeMiniWindow(windowId: number): Promise<void> {
  if (await miniWindowTab(windowId))
    await browser.windows.remove(windowId).catch(() => {});
  await setTracked((await trackedIds()).filter((id) => id !== windowId));
}

export async function currentWindowId(): Promise<number | undefined> {
  return browser.windows
    .getCurrent()
    .then((w) => w.id)
    .catch(() => undefined);
}

/** Calls back when the set of mini windows may have changed. */
export function onMiniWindowsChange(callback: () => void): () => void {
  const offStorage = onStorageChange(KEY, callback, AREA);
  const onRemoved = () => callback();
  browser.windows.onRemoved.addListener(onRemoved);
  return () => {
    offStorage();
    browser.windows.onRemoved.removeListener(onRemoved);
  };
}

/** Background only: forget windows as they close. */
export function pruneOnClose(): void {
  // Older versions kept the ids in local storage, where they outlived restarts.
  void browser.storage.local.remove(KEY).catch(() => {});
  browser.windows.onRemoved.addListener((windowId) => {
    void trackedIds().then((ids) => {
      if (ids.includes(windowId)) void setTracked(ids.filter((id) => id !== windowId));
    });
  });
}
