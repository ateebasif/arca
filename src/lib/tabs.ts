import { browser, type Browser } from 'wxt/browser';
import { ArcaError, callApi } from './errors';
import { classifyUrl } from './url';

export type Tab = Browser.tabs.Tab;

/** Where to open a link: replace the current tab, focus a new tab, or open it behind. */
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

/** Size of the mini window, kept inside the screen. */
function miniWindowBounds() {
  const width = Math.min(1100, (globalThis.screen?.availWidth ?? 1280) - 80);
  const height = Math.min(780, (globalThis.screen?.availHeight ?? 900) - 80);
  return { width: Math.round(width), height: Math.round(height) };
}

export function getCurrentWindowTabs(): Promise<Tab[]> {
  return callApi('tabs.query', () => browser.tabs.query({ currentWindow: true }));
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
    await callApi('windows.create', () =>
      browser.windows.create({
        url,
        type: 'popup',
        focused: true,
        ...miniWindowBounds(),
      }),
    );
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
