import type { KeyboardEvent, MouseEvent } from 'react';
import { openUrl, type OpenDisposition } from '@/src/lib/tabs';
import { classifyUrl, safeHref } from '@/src/lib/url';
import { useOverlays } from '@/src/store/overlays';
import { useSettings } from '@/src/store/settings';
import { errorMessage } from './editing/actions';

/** Opens a URL through the tabs API; blocked schemes show a toast instead. */
export async function openSafely(
  url: string | undefined,
  disposition: OpenDisposition,
): Promise<boolean> {
  try {
    await openUrl(url ?? '', disposition);
    return true;
  } catch (error) {
    useOverlays.getState().toast(errorMessage(error), 'error');
    return false;
  }
}

/** The user's choice for plain clicks (Settings → Open links in). */
export const defaultDisposition = (): OpenDisposition => useSettings.getState().openIn;

/** ⌘/Ctrl-click and middle-click always open behind; otherwise the setting. */
export const dispositionFor = (e: MouseEvent | KeyboardEvent): OpenDisposition =>
  e.metaKey || e.ctrlKey || ('button' in e && e.button === 1)
    ? 'background'
    : defaultDisposition();

const isPlainActivation = (e: MouseEvent | KeyboardEvent) =>
  !e.metaKey &&
  !e.ctrlKey &&
  !e.shiftKey &&
  !e.altKey &&
  (!('button' in e) || e.button === 0);

/**
 * Props that make a bookmark's <a> behave safely:
 * - web URLs: a real href (so ⌘-click, middle-click, drag all work);
 * - browser pages (chrome://…): no href, opened through the tabs API;
 * - blocked schemes (javascript:, data:…): no href; activating shows a toast.
 */
export interface BookmarkLink {
  href?: string;
  role?: 'link';
  tabIndex?: number;
  blocked: boolean;
  onActivate?: (e: MouseEvent | KeyboardEvent) => void;
}

export function bookmarkLinkProps(url: string | undefined): BookmarkLink {
  const href = safeHref(url);
  if (href) {
    return {
      href,
      blocked: false,
      // Real links stay real (⌘-click, middle-click, drag). A plain click only
      // gets intercepted when the user chose something other than "same tab".
      onActivate: (e) => {
        const mode = defaultDisposition();
        if (mode === 'current' || !isPlainActivation(e)) return;
        e.preventDefault();
        void openSafely(href, mode);
      },
    };
  }
  const activate = (e: MouseEvent | KeyboardEvent) => {
    e.preventDefault();
    void openSafely(url, dispositionFor(e));
  };
  return {
    role: 'link',
    tabIndex: 0,
    blocked: classifyUrl(url) === 'blocked',
    onActivate: activate,
  };
}
