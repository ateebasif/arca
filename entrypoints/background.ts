import { browser } from 'wxt/browser';
import {
  isMiniWindow,
  onMiniWindowsChange,
  promoteMiniWindow,
  pruneOnClose,
} from '@/src/lib/miniWindows';

/**
 * Background: only Arca's own mini windows. No messaging, no content scripts.
 * - Right-click in a mini window → "Open in main window".
 * - Keyboard command (Alt+Shift+O by default) does the same.
 */
const MENU_ID = 'arca-open-in-main-window';

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
    }
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
