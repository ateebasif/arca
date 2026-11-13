import { create } from 'zustand';

/** Transient UI: dialogs, menus, inline rename, toasts. Never persisted. */

export type EditorState =
  | {
      mode: 'create';
      kind: 'bookmark' | 'folder';
      parentId: string;
      url?: string;
      title?: string;
    }
  | { mode: 'edit'; id: string };

/** Where an item is shown: the main view or the sidebar folder tree. */
export type ItemPlace = 'main' | 'tree';

export interface MenuState {
  id: string;
  x: number;
  y: number;
  /** Where the menu was opened, so Rename edits that copy of the item. */
  from?: ItemPlace;
}

export interface ToastAction {
  label: string;
  run(): void;
}

export interface Toast {
  id: number;
  message: string;
  tone: 'info' | 'error';
  action?: ToastAction;
}

interface OverlayState {
  editor: EditorState | null;
  menu: MenuState | null;
  renamingId: string | null;
  /** The same folder can be in the sidebar and the main view; rename one. */
  renameIn: ItemPlace;
  confirmDeleteId: string | null;
  settingsOpen: boolean;
  shortcutsOpen: boolean;
  tidyOpen: boolean;
  /** Ask Arca panel, with text to start the composer with. */
  ask: { draft: string } | null;
  /** Last Tidy up tab, so reopening the panel returns to it. */
  tidyTab: string;
  toasts: Toast[];
  openEditor(editor: EditorState): void;
  closeEditor(): void;
  openMenu(menu: MenuState): void;
  closeMenu(): void;
  startRename(id: string, place?: ItemPlace): void;
  stopRename(): void;
  askDelete(id: string): void;
  closeDelete(): void;
  openSettings(): void;
  closeSettings(): void;
  setShortcutsOpen(open: boolean): void;
  setTidyOpen(open: boolean): void;
  openAsk(draft?: string): void;
  closeAsk(): void;
  setTidyTab(tab: string): void;
  toast(message: string, tone?: Toast['tone'], action?: ToastAction): void;
  dismissToast(id: number): void;
}

let nextToastId = 1;
export const TOAST_MS = 4000;

export const useOverlays = create<OverlayState>()((set) => ({
  editor: null,
  menu: null,
  renamingId: null,
  renameIn: 'main',
  confirmDeleteId: null,
  settingsOpen: false,
  shortcutsOpen: false,
  tidyOpen: false,
  tidyTab: 'duplicates',
  ask: null,
  toasts: [],
  openEditor: (editor) => set({ editor, menu: null }),
  closeEditor: () => set({ editor: null }),
  openMenu: (menu) => set({ menu }),
  closeMenu: () => set({ menu: null }),
  startRename: (renamingId, renameIn = 'main') =>
    set({ renamingId, renameIn, menu: null }),
  stopRename: () => set({ renamingId: null }),
  askDelete: (confirmDeleteId) => set({ confirmDeleteId, menu: null }),
  closeDelete: () => set({ confirmDeleteId: null }),
  openSettings: () => set({ settingsOpen: true, menu: null }),
  closeSettings: () => set({ settingsOpen: false }),
  setShortcutsOpen: (shortcutsOpen) => set({ shortcutsOpen, menu: null }),
  setTidyOpen: (tidyOpen) => set({ tidyOpen, menu: null }),
  setTidyTab: (tidyTab) => set({ tidyTab }),
  openAsk: (draft = '') => set({ ask: { draft }, menu: null }),
  closeAsk: () => set({ ask: null }),
  toast: (message, tone = 'info', action) => {
    const id = nextToastId++;
    set((s) => ({ toasts: [...s.toasts.slice(-2), { id, message, tone, action }] }));
    // Toasts with an action (Undo) stay up long enough to use it (PRD: 8 s).
    setTimeout(() => useOverlays.getState().dismissToast(id), action ? 8000 : TOAST_MS);
  },
  dismissToast: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}));

export function resetOverlaysForTests(): void {
  useOverlays.setState({
    editor: null,
    menu: null,
    renamingId: null,
    renameIn: 'main',
    confirmDeleteId: null,
    settingsOpen: false,
    shortcutsOpen: false,
    tidyOpen: false,
    tidyTab: 'duplicates',
    ask: null,
    toasts: [],
  });
}
