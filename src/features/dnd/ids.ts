import { createContext } from 'react';
import type { UniqueIdentifier } from '@dnd-kit/core';

/** dnd-kit ids: sortable/draggable items and folder drop zones share one space. */
export const itemId = (nodeId: string) => `item:${nodeId}`;
export const dropId = (folderId: string, where: string) => `folder:${folderId}:${where}`;

/** A folder dragged from the sidebar tree (its own id: the card may be on screen too). */
export const treeItemId = (nodeId: string) => `tree:${nodeId}`;

export function fromItemId(id: UniqueIdentifier): string | null {
  const s = String(id);
  if (s.startsWith('item:')) return s.slice(5);
  if (s.startsWith('tree:')) return s.slice(5);
  return null;
}

export function fromDropId(id: UniqueIdentifier): string | null {
  const s = String(id);
  return s.startsWith('folder:') ? (s.split(':')[1] ?? null) : null;
}

export interface DragState {
  /** Bookmark/folder being dragged. */
  activeId: string | null;
  /** Folder currently under the pointer as a drop target. */
  overFolderId: string | null;
  /** True when dropping there isn't allowed (e.g. folder into itself). */
  blocked: boolean;
}

export const DragStateContext = createContext<DragState>({
  activeId: null,
  overFolderId: null,
  blocked: false,
});

let dragActive = false;
/** True while any drag is in progress (item key handlers stand down). */
export const isDragActive = () => dragActive;
export function setDragActive(active: boolean): void {
  dragActive = active;
}
