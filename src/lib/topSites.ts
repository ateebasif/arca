import { browser, type Browser } from 'wxt/browser';
import { callApi } from './errors';

export type TopSite = Browser.topSites.MostVisitedURL;

/** The browser's most visited sites, for the Home view. */
export async function getTopSites(limit = 12): Promise<TopSite[]> {
  const sites = await callApi('topSites.get', () => browser.topSites.get());
  return sites.slice(0, limit);
}
