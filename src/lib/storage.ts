import { browser } from 'wxt/browser';
import { callApi } from './errors';

/**
 * Thin typed layer over chrome.storage.local. All Arca data lives here.
 * `null` is treated as "no value" (some implementations report missing keys
 * that way), so don't store `null` as a meaningful value.
 */

/** `local` persists; `session` is in memory and cleared when the browser quits. */
export type StorageArea = 'local' | 'session';

export async function storageGet<T>(
  key: string,
  fallback: T,
  area: StorageArea = 'local',
): Promise<T> {
  const result = await callApi('storage.get', () => browser.storage[area].get(key));
  const value = result[key];
  return value === undefined || value === null ? fallback : (value as T);
}

export async function storageSet<T>(
  key: string,
  value: T,
  area: StorageArea = 'local',
): Promise<void> {
  await callApi('storage.set', () => browser.storage[area].set({ [key]: value }));
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
  watch: StorageArea = 'local',
): () => void {
  const listener = (
    changes: Record<string, { newValue?: unknown; oldValue?: unknown }>,
    area: string,
  ) => {
    const change = changes[key];
    if (area !== watch || !change) return;
    onChange(
      (change.newValue ?? undefined) as T | undefined,
      (change.oldValue ?? undefined) as T | undefined,
    );
  };
  browser.storage.onChanged.addListener(listener);
  return () => browser.storage.onChanged.removeListener(listener);
}
