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

export interface MenuState {
  id: string;
  x: number;
  y: number;
}

export interface Toast {
  id: number;
  message: string;
  tone: 'info' | 'error';
}

interface OverlayState {
  editor: EditorState | null;
  menu: MenuState | null;
  renamingId: string | null;
  confirmDeleteId: string | null;
  settingsOpen: boolean;
  toasts: Toast[];
  openEditor(editor: EditorState): void;
  closeEditor(): void;
  openMenu(menu: MenuState): void;
  closeMenu(): void;
  startRename(id: string): void;
  stopRename(): void;
  askDelete(id: string): void;
  closeDelete(): void;
  openSettings(): void;
  closeSettings(): void;
  toast(message: string, tone?: Toast['tone']): void;
  dismissToast(id: number): void;
}

let nextToastId = 1;
export const TOAST_MS = 4000;

export const useOverlays = create<OverlayState>()((set) => ({
  editor: null,
  menu: null,
  renamingId: null,
  confirmDeleteId: null,
  settingsOpen: false,
  toasts: [],
  openEditor: (editor) => set({ editor, menu: null }),
  closeEditor: () => set({ editor: null }),
  openMenu: (menu) => set({ menu }),
  closeMenu: () => set({ menu: null }),
  startRename: (renamingId) => set({ renamingId, menu: null }),
  stopRename: () => set({ renamingId: null }),
  askDelete: (confirmDeleteId) => set({ confirmDeleteId, menu: null }),
  closeDelete: () => set({ confirmDeleteId: null }),
  openSettings: () => set({ settingsOpen: true, menu: null }),
  closeSettings: () => set({ settingsOpen: false }),
  toast: (message, tone = 'info') => {
    const id = nextToastId++;
    set((s) => ({ toasts: [...s.toasts.slice(-2), { id, message, tone }] }));
    setTimeout(() => useOverlays.getState().dismissToast(id), TOAST_MS);
  },
  dismissToast: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}));

export function resetOverlaysForTests(): void {
  useOverlays.setState({
    editor: null,
    menu: null,
    renamingId: null,
    confirmDeleteId: null,
    settingsOpen: false,
    toasts: [],
  });
}
