import { browser, type Browser } from 'wxt/browser';
import { callApi } from './errors';

export type Tab = Browser.tabs.Tab;

/** Where to open a link: replace the current tab, focus a new tab, or open it behind. */
export type OpenDisposition = 'current' | 'new-tab' | 'background';

export function getCurrentWindowTabs(): Promise<Tab[]> {
  return callApi('tabs.query', () => browser.tabs.query({ currentWindow: true }));
}

export async function getActiveTab(): Promise<Tab | undefined> {
  const [tab] = await callApi('tabs.query', () =>
    browser.tabs.query({ active: true, currentWindow: true }),
  );
  return tab;
}

export async function openUrl(
  url: string,
  disposition: OpenDisposition = 'current',
): Promise<void> {
  if (disposition === 'current') {
    await callApi('tabs.update', () => browser.tabs.update({ url }));
    return;
  }
  await callApi('tabs.create', () =>
    browser.tabs.create({ url, active: disposition === 'new-tab' }),
  );
}

/** Opens each URL in a background tab, in order. Callers warn above 10 (PRD §8.5). */
export async function openUrls(urls: readonly string[]): Promise<void> {
  for (const url of urls) {
    await callApi('tabs.create', () => browser.tabs.create({ url, active: false }));
  }
}
