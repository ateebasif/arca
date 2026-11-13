import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  pointerWithin,
  useSensor,
  useSensors,
  type CollisionDetection,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import { sortableKeyboardCoordinates } from '@dnd-kit/sortable';
import { useRef, useState, type ReactNode } from 'react';
import { Favicon } from '@/src/components/main/Favicon';
import { FolderIcon } from '@/src/components/icons';
import { getBookmarkStore, useBookmarks } from '@/src/store/useBookmarks';
import { useUi } from '@/src/store/ui';
import { DragStateContext, fromDropId, fromItemId } from './ids';
import { dropProblem, moveIntoFolder, reorder } from './moves';

export const AUTO_EXPAND_MS = 600;

/**
 * Folder drop zones win over sortable items when the pointer is inside one,
 * so "drop onto a folder" and "reorder next to it" don't fight.
 */
const collision: CollisionDetection = (args) => {
  const within = pointerWithin(args);
  const folder = within.find((c) => fromDropId(c.id) !== null);
  if (folder) return [folder];
  return closestCenter({
    ...args,
    droppableContainers: args.droppableContainers.filter(
      (c) => fromItemId(c.id) !== null,
    ),
  });
};

/** Drag & drop for the whole dashboard: grid, list, sidebar tree and breadcrumbs. */
export function DndProvider({ children }: { children: ReactNode }) {
  const state = useBookmarks();
  const [activeId, setActiveId] = useState<string | null>(null);
  const [overFolderId, setOverFolderId] = useState<string | null>(null);
  const expandTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  const sensors = useSensors(
    // A small distance keeps plain clicks (open link / folder) working.
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
      // Space only: Enter must keep opening links.
      keyboardCodes: { start: ['Space'], cancel: ['Escape'], end: ['Space', 'Enter'] },
    }),
  );

  const clearExpand = () => clearTimeout(expandTimer.current);

  const onDragStart = (e: DragStartEvent) => setActiveId(fromItemId(e.active.id));

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
    clearExpand();
    setActiveId(null);
    setOverFolderId(null);
    const nodeId = fromItemId(e.active.id);
    if (!nodeId || !e.over) return;
    const snapshot = getBookmarkStore().getSnapshot();
    const folderId = fromDropId(e.over.id);
    if (folderId) {
      if (folderId !== nodeId) void moveIntoFolder(snapshot, nodeId, folderId);
      return;
    }
    const overId = fromItemId(e.over.id);
    if (overId && e.over.data.current?.sortable && useUi.getState().sort === 'manual') {
      void reorder(snapshot, nodeId, overId);
    }
  };

  const onDragCancel = () => {
    clearExpand();
    setActiveId(null);
    setOverFolderId(null);
  };

  const active = activeId ? state.nodes.get(activeId) : undefined;
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
          {active ? (
            <div className="border-line bg-surface-strong flex max-w-64 items-center gap-2 rounded-xl border px-3 py-2 text-[13px] font-medium shadow-(--shadow-pop) backdrop-blur-xl">
              {active.url ? (
                <Favicon url={active.url} title={active.title} size={16} />
              ) : (
                <FolderIcon className="text-accent shrink-0" />
              )}
              <span className="truncate">{active.title || 'Untitled'}</span>
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>
    </DragStateContext.Provider>
  );
}
