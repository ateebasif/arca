import { useDraggable, useDroppable } from '@dnd-kit/core';
import { tabDragId, type TabDragData } from './tabDrag';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useContext, type CSSProperties } from 'react';
import type { BNode } from '@/src/store/bookmarkStore';
import { DragStateContext, dropId, itemId } from './ids';

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
