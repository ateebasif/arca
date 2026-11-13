import { browser } from 'wxt/browser';
import { callApi } from './errors';

/**
 * Thin typed layer over chrome.storage.local. All Arca data lives here.
 * `null` is treated as "no value" (some implementations report missing keys
 * that way), so don't store `null` as a meaningful value.
 */

export async function storageGet<T>(key: string, fallback: T): Promise<T> {
  const result = await callApi('storage.get', () => browser.storage.local.get(key));
  const value = result[key];
  return value === undefined || value === null ? fallback : (value as T);
}

export async function storageSet<T>(key: string, value: T): Promise<void> {
  await callApi('storage.set', () => browser.storage.local.set({ [key]: value }));
}

export async function storageRemove(key: string): Promise<void> {
  await callApi('storage.remove', () => browser.storage.local.remove(key));
}

/**
 * Calls `onChange` whenever `key` changes in local storage (from any extension
 * page). `newValue` is undefined when the key was removed.
 */
export function onStorageChange<T>(
  key: string,
  onChange: (newValue: T | undefined, oldValue: T | undefined) => void,
): () => void {
  const listener = (
    changes: Record<string, { newValue?: unknown; oldValue?: unknown }>,
    area: string,
  ) => {
    const change = changes[key];
    if (area !== 'local' || !change) return;
    onChange(
      (change.newValue ?? undefined) as T | undefined,
      (change.oldValue ?? undefined) as T | undefined,
    );
  };
  browser.storage.onChanged.addListener(listener);
  return () => browser.storage.onChanged.removeListener(listener);
}
