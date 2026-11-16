import { browser, type Browser } from 'wxt/browser';
import { ArcaError, callApi } from './errors';
import { openMiniWindow } from './miniWindows';
import { classifyUrl } from './url';

export type Tab = Browser.tabs.Tab;

/**
 * Where to open a link: replace the current tab, a new focused tab, a new tab
 * behind, or a small toolbar-less window ("mini window").
 */
export type OpenDisposition = 'current' | 'new-tab' | 'background' | 'window';
export const OPEN_DISPOSITIONS: readonly OpenDisposition[] = [
  'current',
  'new-tab',
  'background',
  'window',
];

export function getCurrentWindowTabs(): Promise<Tab[]> {
  return callApi('tabs.query', () => browser.tabs.query({ currentWindow: true }));
}

/**
 * Calls back (debounced) whenever tabs in any window open, close, move or
 * change page or title. Returns an unsubscribe function.
 */
export function onTabsChange(callback: () => void, delayMs = 150): () => void {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const fire = () => {
    clearTimeout(timer);
    timer = setTimeout(callback, delayMs);
  };
  const onUpdated = (
    _id: number,
    change: { url?: string; title?: string; status?: string },
  ) => {
    if (
      change.url !== undefined ||
      change.title !== undefined ||
      change.status === 'complete'
    )
      fire();
  };
  // Subscribe to each event that exists (they vary a little between browsers).
  const offs: Array<() => void> = [];
  const listen = <F>(
    event: { addListener(f: F): void; removeListener(f: F): void } | undefined,
    f: F,
  ) => {
    try {
      event?.addListener(f);
      offs.push(() => event?.removeListener(f));
    } catch {
      // Not available here: that change just won't refresh the list.
    }
  };
  listen(browser.tabs.onCreated, fire);
  listen(browser.tabs.onRemoved, fire);
  listen(browser.tabs.onMoved, fire);
  listen(browser.tabs.onAttached, fire);
  listen(browser.tabs.onDetached, fire);
  listen(browser.tabs.onUpdated, onUpdated);
  return () => {
    clearTimeout(timer);
    offs.forEach((off) => off());
  };
}

export async function getActiveTab(): Promise<Tab | undefined> {
  const [tab] = await callApi('tabs.query', () =>
    browser.tabs.query({ active: true, currentWindow: true }),
  );
  return tab;
}

function assertOpenable(url: string): void {
  if (classifyUrl(url) === 'blocked') {
    throw new ArcaError('BLOCKED_URL', `Refusing to open ${url.slice(0, 40)}`);
  }
}

export async function openUrl(
  url: string,
  disposition: OpenDisposition = 'current',
): Promise<void> {
  assertOpenable(url);
  if (disposition === 'current') {
    await callApi('tabs.update', () => browser.tabs.update({ url }));
    return;
  }
  if (disposition === 'window') {
    await openMiniWindow(url);
    return;
  }
  await callApi('tabs.create', () =>
    browser.tabs.create({ url, active: disposition === 'new-tab' }),
  );
}

/** Opens each URL in a background tab, in order. Callers warn above 10 (PRD §8.5). */
export async function openUrls(urls: readonly string[]): Promise<void> {
  urls.forEach(assertOpenable);
  for (const url of urls) {
    await callApi('tabs.create', () => browser.tabs.create({ url, active: false }));
  }
}

/** Opens one of Arca's own pages (e.g. "dashboard.html") in a new, focused tab. */
export async function openExtensionPage(path: string): Promise<void> {
  const getURL = browser.runtime.getURL as (p: string) => string;
  await callApi('tabs.create', () => browser.tabs.create({ url: getURL(`/${path}`) }));
}
