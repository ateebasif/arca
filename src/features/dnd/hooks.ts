import { useDraggable, useDroppable } from '@dnd-kit/core';
import { tabDragId, type TabDragData } from './tabDrag';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useContext, type CSSProperties } from 'react';
import type { BNode } from '@/src/store/bookmarkStore';
import { DragStateContext, dropId, itemId, treeItemId } from './ids';

/**
 * Makes a tile, card or row draggable (and sortable inside a SortableContext).
 * Returns props for the outer element and for the interactive element (the
 * link/button), which carries the drag listeners so clicks still work.
 */
export function useDragItem(node: BNode) {
  const sortable = useSortable({
    id: itemId(node.id),
    disabled: node.isRoot,
    data: { nodeId: node.id },
  });
  const style: CSSProperties = {
    transform: CSS.Translate.toString(sortable.transform),
    transition: sortable.transition,
    opacity: sortable.isDragging ? 0.35 : undefined,
  };
  // dnd-kit adds role="button" and tabIndex; links and buttons already have
  // the right role and focus, so only keep the ARIA description.
  const { role: _role, tabIndex: _tabIndex, ...aria } = sortable.attributes;
  return {
    setNodeRef: sortable.setNodeRef,
    style,
    handle: { ...aria, ...sortable.listeners },
    isDragging: sortable.isDragging,
  };
}

/** A folder drop zone. `where` keeps ids unique across card, tree and crumbs. */
export function useFolderDrop(folderId: string, where: string, expandable = false) {
  const { setNodeRef, isOver } = useDroppable({
    id: dropId(folderId, where),
    data: { folderId, expandable },
  });
  const drag = useContext(DragStateContext);
  const dragging = drag.activeId !== null && drag.activeId !== folderId;
  return {
    setDropRef: setNodeRef,
    isOver: isOver && dragging,
    blocked: isOver && drag.blocked,
    dragging,
  };
}

export function useDragState() {
  return useContext(DragStateContext);
}

/** Makes an open tab (Open tabs panel) draggable onto folders. */
export function useTabDrag(tabId: number, tab: TabDragData['tab']) {
  const drag = useDraggable({
    id: tabDragId(tabId),
    data: { tab } satisfies TabDragData,
  });
  const { role: _role, tabIndex: _tabIndex, ...aria } = drag.attributes;
  return {
    setNodeRef: drag.setNodeRef,
    handle: { ...aria, ...drag.listeners },
    isDragging: drag.isDragging,
  };
}

/**
 * Lets a sidebar tree folder be dragged with the mouse onto another folder
 * (cards, tree rows, breadcrumbs). Keyboard dragging stays on folder cards,
 * since Space and the arrows already move through the tree.
 */
export function useTreeDrag(node: BNode) {
  const drag = useDraggable({ id: treeItemId(node.id), disabled: node.isRoot });
  const { onKeyDown: _keys, ...pointer } = drag.listeners ?? {};
  return {
    setDragRef: drag.setNodeRef,
    pointer,
    isDragging: drag.isDragging,
  };
}

type PointerHandler = (e: React.PointerEvent<HTMLElement>) => void;

/**
 * Holding ⇧ (Shift) while you drag a bookmark hands the drag to the browser,
 * so the link can go to the tab strip, another window or another app.
 * (Not ⌥: Chrome never starts a link drag with Alt held.) Without ⇧ the
 * browser's drag is cancelled as it starts and dnd-kit moves the item
 * inside Arca. Blocked links (no safe href) are never draggable.
 * Spread the result on the link, after any `draggable` prop.
 */
export function withNativeLinkDrag<T extends { onPointerDown?: PointerHandler }>(
  handle: T,
  href: string | undefined,
): T & {
  draggable?: boolean;
  onDragStart?: (e: React.DragEvent<HTMLElement>) => void;
} {
  if (!href) return handle;
  let native = false;
  return {
    ...handle,
    draggable: true,
    onPointerDown: (e: React.PointerEvent<HTMLElement>) => {
      native = e.shiftKey && e.button === 0;
      // ⇧: leave this drag to the browser.
      if (!native) handle.onPointerDown?.(e);
    },
    onDragStart: (e: React.DragEvent<HTMLElement>) => {
      if (!native && !e.shiftKey) {
        e.preventDefault();
        return;
      }
      e.dataTransfer.effectAllowed = 'copyLink';
      e.dataTransfer.setData('text/uri-list', href);
      e.dataTransfer.setData('text/plain', href);
    },
  };
}
