import { useEffect } from 'react';
import { create } from 'zustand';
import { onStorageChange, storageGet, storageSet } from '@/src/lib/storage';

/** Custom folder icons: one emoji per folder, shown in the tree and on cards. */

const KEY = 'folderIcons';
const MAX = 2000;

/** Exactly one emoji (any skin tone / ZWJ sequence), nothing else. */
export function isEmoji(value: unknown): value is string {
  if (typeof value !== 'string' || !value || value.length > 16) return false;
  const graphemes = [
    ...new Intl.Segmenter(undefined, { granularity: 'grapheme' }).segment(value),
  ];
  return (
    graphemes.length === 1 &&
    /\p{Extended_Pictographic}|\p{Regional_Indicator}/u.test(value)
  );
}

export function parseIcons(raw: unknown): Map<string, string> {
  const out = new Map<string, string>();
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return out;
  for (const [id, v] of Object.entries(raw).slice(0, MAX)) {
    if (/^[\w-]{1,64}$/.test(id) && isEmoji(v)) out.set(id, v);
  }
  return out;
}

interface IconsState {
  icons: Map<string, string>;
  loaded: boolean;
  load(): Promise<void>;
  setIcon(id: string, emoji: string | null): Promise<void>;
}

let off: (() => void) | null = null;

export const useFolderIcons = create<IconsState>()((set, get) => ({
  icons: new Map(),
  loaded: false,
  async load() {
    if (get().loaded) return;
    set({ icons: parseIcons(await storageGet<unknown>(KEY, {})), loaded: true });
    off ??= onStorageChange<unknown>(KEY, (raw) => set({ icons: parseIcons(raw) }));
  },
  async setIcon(id, emoji) {
    await get().load();
    const icons = new Map(get().icons);
    if (emoji && isEmoji(emoji)) icons.set(id, emoji);
    else icons.delete(id);
    set({ icons });
    await storageSet(KEY, Object.fromEntries(icons));
  },
}));

/** A folder's emoji, or undefined (loads the icons on first use). */
export function useFolderIcon(id: string): string | undefined {
  const loaded = useFolderIcons((s) => s.loaded);
  useEffect(() => {
    if (!loaded) void useFolderIcons.getState().load();
  }, [loaded]);
  return useFolderIcons((s) => s.icons.get(id));
}

export function resetFolderIconsForTests(): void {
  off?.();
  off = null;
  useFolderIcons.setState({ icons: new Map(), loaded: false });
}
