import type { UniqueIdentifier } from '@dnd-kit/core';

/** dnd-kit id for an open tab dragged from the Open tabs panel. */
export const tabDragId = (tabId: number) => `tab:${tabId}`;

export function isTabDrag(id: UniqueIdentifier): boolean {
  return String(id).startsWith('tab:');
}

/** What a dragged tab carries (set as the draggable's data). */
export interface TabDragData {
  tab: { url: string; title: string };
}
