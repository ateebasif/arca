import { browser } from 'wxt/browser';
import {
  isMiniWindow,
  onMiniWindowsChange,
  promoteMiniWindow,
  pruneOnClose,
} from '@/src/lib/miniWindows';
import { openSaveBox, setPendingSave } from '@/src/lib/pendingSave';

/**
 * Background: right-click menus and Arca's own mini windows. No messaging,
 * no content scripts.
 * - Right-click a page or link → "Add … to Arca…" opens the popup's save box.
 * - Right-click in a mini window → "Open in main window" (or ⌥⇧O).
 */
const MENU_ID = 'arca-open-in-main-window';
const ADD_PAGE = 'arca-add-page';
const ADD_LINK = 'arca-add-link';

export default defineBackground(() => {
  pruneOnClose();

  browser.runtime.onInstalled.addListener(() => {
    browser.contextMenus.removeAll(() => {
      browser.contextMenus.create({
        id: MENU_ID,
        title: 'Open in main window',
        contexts: ['page', 'frame', 'selection', 'link', 'image'],
        visible: false,
      });
      browser.contextMenus.create({
        id: ADD_PAGE,
        title: 'Add page to Arca…',
        contexts: ['page'],
        documentUrlPatterns: ['http://*/*', 'https://*/*'],
      });
      browser.contextMenus.create({
        id: ADD_LINK,
        title: 'Add link to Arca…',
        contexts: ['link'],
        targetUrlPatterns: ['http://*/*', 'https://*/*'],
      });
    });
  });

  // Show the menu item only while one of Arca's mini windows is focused.
  const refresh = (windowId?: number) =>
    void (async () => {
      const id =
        windowId ?? (await browser.windows.getLastFocused().catch(() => undefined))?.id;
      const visible = id !== undefined && (await isMiniWindow(id));
      await browser.contextMenus.update(MENU_ID, { visible }).catch(() => {});
    })();
  browser.windows.onFocusChanged.addListener((windowId) => refresh(windowId));
  // A new mini window is focused before Arca records it; check again then.
  onMiniWindowsChange(() => refresh());

  browser.contextMenus.onClicked.addListener((info, tab) => {
    if (info.menuItemId === MENU_ID && tab?.windowId !== undefined) {
      void promoteMiniWindow(tab.windowId);
      return;
    }
    if (info.menuItemId !== ADD_PAGE && info.menuItemId !== ADD_LINK) return;
    const item =
      info.menuItemId === ADD_LINK
        ? {
            url: info.linkUrl ?? '',
            // Chrome gives the selected text, not the link text; fall back to
            // the address and let the user edit it in the save box.
            title: info.selectionText?.trim() || info.linkUrl || '',
          }
        : { url: info.pageUrl || tab?.url || '', title: tab?.title ?? '' };
    // openPopup must run while the click still counts as a user action.
    void setPendingSave(item).then((ok) => {
      if (ok) void openSaveBox();
    });
  });

  browser.commands.onCommand.addListener((command, tab) => {
    if (command !== 'open-in-main-window') return;
    void (async () => {
      const windowId =
        tab?.windowId ??
        (await browser.windows.getLastFocused().catch(() => undefined))?.id;
      if (windowId !== undefined) await promoteMiniWindow(windowId);
    })();
  });
});
