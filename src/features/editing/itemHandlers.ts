import type { KeyboardEvent, MouseEvent } from 'react';
import type { BNode } from '@/src/store/bookmarkStore';
import { useOverlays, type ItemPlace } from '@/src/store/overlays';
import { isDragActive } from '../dnd/ids';
import { requestDelete } from './actions';

/** Whether an element is in the sidebar folder tree or the main view. */
export const placeOf = (el: Element | null): ItemPlace =>
  el?.closest('[data-folder-tree]') ? 'tree' : 'main';

/** Opens the item menu next to an element (for keyboard and the ⋯ button). */
export function openMenuAt(id: string, el: Element): void {
  const r = el.getBoundingClientRect();
  useOverlays.getState().openMenu({ id, x: r.left, y: r.bottom + 4, from: placeOf(el) });
}

/**
 * Shared handlers for bookmark/folder items: right-click opens the menu,
 * F2 renames, Delete (or mod+Backspace) deletes, Shift+F10 / Menu key opens
 * the menu. Root folders ignore rename and delete.
 */
export function itemHandlers(node: BNode) {
  return {
    onContextMenu(e: MouseEvent) {
      e.preventDefault();
      useOverlays.getState().openMenu({
        id: node.id,
        x: e.clientX,
        y: e.clientY,
        from: placeOf(e.currentTarget as Element),
      });
    },
    onKeyDown(e: KeyboardEvent<HTMLElement>) {
      if (e.target !== e.currentTarget || isDragActive()) return;
      const overlays = useOverlays.getState();
      if (e.key === 'F2' && !node.isRoot) {
        e.preventDefault();
        overlays.startRename(node.id, placeOf(e.currentTarget));
      } else if (
        (e.key === 'Delete' || (e.key === 'Backspace' && (e.metaKey || e.ctrlKey))) &&
        !node.isRoot
      ) {
        e.preventDefault();
        requestDelete(node.id);
      } else if (e.key === 'ContextMenu' || (e.key === 'F10' && e.shiftKey)) {
        e.preventDefault();
        openMenuAt(node.id, e.currentTarget);
      }
    },
  };
}
