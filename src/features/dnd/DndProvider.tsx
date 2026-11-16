import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  pointerWithin,
  rectIntersection,
  useSensor,
  useSensors,
  type CollisionDetection,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
  type UniqueIdentifier,
} from '@dnd-kit/core';
import { sortableKeyboardCoordinates } from '@dnd-kit/sortable';
import { useRef, useState, type ReactNode } from 'react';
import { Favicon } from '@/src/components/main/Favicon';
import { FolderIcon } from '@/src/components/icons';
import { getBookmarkStore, useBookmarks } from '@/src/store/useBookmarks';
import { useUi } from '@/src/store/ui';
import { DragStateContext, fromDropId, fromItemId, setDragActive } from './ids';
import { dropProblem, moveIntoFolder, reorder } from './moves';
import { isTabDrag, type TabDragData } from './tabDrag';
import { useSelection } from '@/src/store/selection';
import { useOverlays } from '@/src/store/overlays';
import type { BookmarkSnapshot } from '@/src/store/bookmarkStore';
import { bookmarkTab } from '@/src/features/editing/actions';

export const AUTO_EXPAND_MS = 600;

/**
 * Moves a dragged multi-selection into a folder in one undo step. Items that
 * can't go there (the folder itself, a folder into its own subfolder, browser
 * folders) are left where they are.
 */
async function moveSelection(
  snapshot: BookmarkSnapshot,
  ids: readonly string[],
  folderId: string,
): Promise<void> {
  const movable = ids.filter(
    (id) => id !== folderId && !dropProblem(snapshot, id, folderId),
  );
  if (!movable.length) {
    useOverlays.getState().toast("Those items can't go into that folder.", 'error');
    return;
  }
  const { moveMany } = await import('@/src/features/editing/bulk');
  await moveMany(movable, folderId).catch((e: unknown) =>
    useOverlays.getState().toast(e instanceof Error ? e.message : String(e), 'error'),
  );
  useSelection.getState().clear();
}

/**
 * Folder drop zones win over sortable items when the pointer is inside one,
 * so "drop onto a folder" and "reorder next to it" don't fight.
 */
const collision: CollisionDetection = (args) => {
  const folderZones = args.droppableContainers.filter((c) => fromDropId(c.id) !== null);
  const items = args.droppableContainers.filter((c) => fromItemId(c.id) !== null);
  if (args.pointerCoordinates) {
    const folder = pointerWithin(args).find((c) => fromDropId(c.id) !== null);
    if (folder) return [folder];
  } else {
    // Keyboard drags have no pointer: use the dragged item's rectangle.
    const [folder] = rectIntersection({ ...args, droppableContainers: folderZones });
    if (folder) return [folder];
  }
  return closestCenter({ ...args, droppableContainers: items });
};

const nameOf = (nodeId: string | null) =>
  (nodeId && getBookmarkStore().getSnapshot().nodes.get(nodeId)?.title) || 'item';
const titleFor = (id: UniqueIdentifier) =>
  isTabDrag(id) ? 'the tab' : `“${nameOf(fromItemId(id))}”`;
const targetFor = (id: UniqueIdentifier) => {
  const folder = fromDropId(id);
  return folder
    ? `folder “${nameOf(folder)}” (move into it)`
    : `the position of “${nameOf(fromItemId(id))}”`;
};

/** Drag & drop for the whole dashboard: grid, list, sidebar tree and breadcrumbs. */
export function DndProvider({ children }: { children: ReactNode }) {
  const state = useBookmarks();
  const [activeId, setActiveId] = useState<string | null>(null);
  /** An open tab being dragged from the Open tabs panel. */
  const [activeTab, setActiveTab] = useState<TabDragData['tab'] | null>(null);
  const [overFolderId, setOverFolderId] = useState<string | null>(null);
  const expandTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  const sensors = useSensors(
    // A small distance keeps plain clicks (open link / folder) working.
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
      // Space only: Enter must keep opening links, never end a drag.
      keyboardCodes: { start: ['Space'], cancel: ['Escape'], end: ['Space'] },
    }),
  );

  const clearExpand = () => clearTimeout(expandTimer.current);

  const onDragStart = (e: DragStartEvent) => {
    setDragActive(true);
    setActiveId(fromItemId(e.active.id));
    if (isTabDrag(e.active.id))
      setActiveTab((e.active.data.current as TabDragData | undefined)?.tab ?? null);
  };

  const onDragOver = (e: DragOverEvent) => {
    const folderId = e.over ? fromDropId(e.over.id) : null;
    setOverFolderId(folderId);
    clearExpand();
    // Hovering a collapsed tree folder opens it after a moment.
    if (folderId && e.over?.data.current?.expandable) {
      expandTimer.current = setTimeout(
        () => useUi.getState().setExpanded(folderId, true),
        AUTO_EXPAND_MS,
      );
    }
  };

  const onDragEnd = (e: DragEndEvent) => {
    setDragActive(false);
    clearExpand();
    setActiveId(null);
    setActiveTab(null);
    setOverFolderId(null);
    // A tab dropped on a folder becomes a bookmark there.
    if (isTabDrag(e.active.id)) {
      const tab = (e.active.data.current as TabDragData | undefined)?.tab;
      const folderId = e.over ? fromDropId(e.over.id) : null;
      if (tab && folderId) void bookmarkTab(tab, folderId);
      return;
    }
    const nodeId = fromItemId(e.active.id);
    if (!nodeId || !e.over) return;
    const snapshot = getBookmarkStore().getSnapshot();
    const folderId = fromDropId(e.over.id);
    if (folderId) {
      // Dragging one of several selected items moves them all.
      const selected = useSelection.getState().ids;
      if (selected.size > 1 && selected.has(nodeId)) {
        void moveSelection(snapshot, [...selected], folderId);
        return;
      }
      if (folderId !== nodeId) void moveIntoFolder(snapshot, nodeId, folderId);
      return;
    }
    const overId = fromItemId(e.over.id);
    if (overId && e.over.data.current?.sortable && useUi.getState().sort === 'manual') {
      void reorder(snapshot, nodeId, overId);
    }
  };

  const onDragCancel = () => {
    setDragActive(false);
    clearExpand();
    setActiveId(null);
    setActiveTab(null);
    setOverFolderId(null);
  };

  const active = activeId ? state.nodes.get(activeId) : undefined;
  const selectedCount = useSelection((s) =>
    activeId && s.ids.has(activeId) ? s.ids.size : 0,
  );
  const blocked =
    activeId && overFolderId
      ? dropProblem(state, activeId, overFolderId) !== null
      : false;

  return (
    <DragStateContext.Provider value={{ activeId, overFolderId, blocked }}>
      <DndContext
        sensors={sensors}
        collisionDetection={collision}
        onDragStart={onDragStart}
        onDragOver={onDragOver}
        onDragEnd={onDragEnd}
        onDragCancel={onDragCancel}
        accessibility={{
          announcements: {
            onDragStart: ({ active }) => `Picked up ${titleFor(active.id)}.`,
            onDragOver: ({ active, over }) =>
              over ? `${titleFor(active.id)} is over ${targetFor(over.id)}.` : undefined,
            onDragEnd: ({ active, over }) =>
              over
                ? `Dropped ${titleFor(active.id)} on ${targetFor(over.id)}.`
                : `Dropped ${titleFor(active.id)}.`,
            onDragCancel: ({ active }) => `Cancelled moving ${titleFor(active.id)}.`,
          },
          screenReaderInstructions: {
            draggable:
              'To move, press Space. Use the arrow keys to move, Space to drop, Escape to cancel.',
          },
        }}
      >
        {children}
        <DragOverlay
          dropAnimation={{ duration: 180, easing: 'cubic-bezier(0.2, 0.8, 0.2, 1)' }}
        >
          {activeTab ? (
            <div className="border-line bg-surface-strong flex max-w-64 items-center gap-2 rounded-xl border px-3 py-2 text-[13px] font-medium shadow-(--shadow-pop) backdrop-blur-xl">
              <Favicon url={activeTab.url} title={activeTab.title} size={16} />
              <span className="truncate">{activeTab.title || activeTab.url}</span>
            </div>
          ) : active ? (
            <div className="border-line bg-surface-strong flex max-w-64 items-center gap-2 rounded-xl border px-3 py-2 text-[13px] font-medium shadow-(--shadow-pop) backdrop-blur-xl">
              {active.url ? (
                <Favicon url={active.url} title={active.title} size={16} />
              ) : (
                <FolderIcon className="text-accent shrink-0" />
              )}
              <span className="truncate">{active.title || 'Untitled'}</span>
              {selectedCount > 1 && (
                <span className="bg-accent ml-1 text-white shrink-0 rounded-full px-1.5 text-[11px] tabular-nums">
                  +{selectedCount - 1}
                </span>
              )}
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>
    </DragStateContext.Provider>
  );
}
