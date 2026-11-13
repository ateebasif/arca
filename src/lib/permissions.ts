import { browser } from 'wxt/browser';
import { callApi } from './errors';

/**
 * The optional "all sites" host permission. Needed only for features that
 * fetch pages (link previews, dead-link checker). Never granted at install.
 */
const ALL_SITES = { origins: ['<all_urls>'] };

export function hasSiteAccess(): Promise<boolean> {
  return callApi('permissions.contains', () => browser.permissions.contains(ALL_SITES));
}

/** Shows the browser's permission prompt. Must be called from a user gesture. */
export function requestSiteAccess(): Promise<boolean> {
  return callApi('permissions.request', () => browser.permissions.request(ALL_SITES));
}

export function removeSiteAccess(): Promise<boolean> {
  return callApi('permissions.remove', () => browser.permissions.remove(ALL_SITES));
}

/** Calls back when site access is granted or revoked (e.g. in chrome://extensions). */
export function onSiteAccessChange(callback: (granted: boolean) => void): () => void {
  const onAdded = () => void hasSiteAccess().then(callback);
  const onRemoved = () => void hasSiteAccess().then(callback);
  browser.permissions.onAdded.addListener(onAdded);
  browser.permissions.onRemoved.addListener(onRemoved);
  return () => {
    browser.permissions.onAdded.removeListener(onAdded);
    browser.permissions.onRemoved.removeListener(onRemoved);
  };
}
