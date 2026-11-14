import { browser } from 'wxt/browser';
import { storageGet, storageRemove, storageSet } from './storage';
import { classifyUrl } from './url';

/**
 * "Add to Arca…" from the right-click menu: the background stores what was
 * clicked (page or link), then opens the popup, which shows a save box for
 * it. Entries expire after two minutes and are validated when read.
 */

const KEY = 'pendingSave';
const TTL_MS = 2 * 60_000;

export interface PendingSave {
  url: string;
  title: string;
}

export async function setPendingSave(
  item: PendingSave,
  now = Date.now(),
): Promise<boolean> {
  if (classifyUrl(item.url) !== 'web') return false;
  await storageSet(KEY, { url: item.url, title: item.title.slice(0, 500), at: now });
  return true;
}

export async function readPendingSave(now = Date.now()): Promise<PendingSave | null> {
  const raw = await storageGet<unknown>(KEY, null);
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as { url?: unknown; title?: unknown; at?: unknown };
  if (typeof r.url !== 'string' || classifyUrl(r.url) !== 'web') return null;
  if (typeof r.at !== 'number' || now - r.at > TTL_MS || r.at > now + 1000) return null;
  return { url: r.url, title: typeof r.title === 'string' ? r.title.slice(0, 500) : '' };
}

export async function clearPendingSave(): Promise<void> {
  await storageRemove(KEY);
}

/**
 * Opens Arca's popup (where the browser allows it from a menu click), else
 * a small window with the same page.
 */
export async function openSaveBox(): Promise<void> {
  const action = browser.action as { openPopup?: () => Promise<void> };
  try {
    if (action.openPopup) {
      await action.openPopup();
      return;
    }
  } catch {
    // Not allowed here (or no browser window focused): use a window instead.
  }
  const getURL = browser.runtime.getURL as (p: string) => string;
  await browser.windows.create({
    url: getURL('/popup.html'),
    type: 'popup',
    width: 400,
    height: 560,
    focused: true,
  });
}
