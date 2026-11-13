import * as bm from '@/src/lib/bookmarks';
import type { BookmarkNode } from '@/src/lib/bookmarks';
import { useOverlays } from '@/src/store/overlays';

/**
 * Undo stack (PRD §8.10): the last 20 actions. Each action knows how to
 * reverse itself through the bookmarks API. Recording one also shows a toast
 * with an Undo button for 8 seconds; ⌘Z undoes the most recent.
 */

export interface UndoAction {
  /** Shown in the toast, e.g. "Deleted “Work”". */
  label: string;
  undo(): Promise<void>;
}

export const UNDO_LIMIT = 20;
export const UNDO_TOAST_MS = 8000;
const stack: UndoAction[] = [];
let running: Promise<unknown> = Promise.resolve();

export function record(action: UndoAction, { toast = true } = {}): void {
  stack.push(action);
  if (stack.length > UNDO_LIMIT) stack.shift();
  if (toast) {
    useOverlays.getState().toast(action.label, 'info', {
      label: 'Undo',
      run: () => void undoAction(action),
    });
  }
}

/** Undo a specific action (from its toast), if it's still on the stack. */
export function undoAction(action: UndoAction): Promise<boolean> {
  const index = stack.lastIndexOf(action);
  if (index === -1) return Promise.resolve(false);
  stack.splice(index, 1);
  return run(action);
}

/** Undo the most recent action (⌘Z). */
export function undoLast(): Promise<boolean> {
  const action = stack.pop();
  return action ? run(action) : Promise.resolve(false);
}

function run(action: UndoAction): Promise<boolean> {
  // Undos run one at a time so their bookmark operations never interleave.
  const result = running.then(async () => {
    try {
      await action.undo();
      useOverlays.getState().toast(`Undone: ${action.label}`);
      return true;
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      useOverlays.getState().toast(`Couldn't undo: ${detail}`, 'error');
      return false;
    }
  });
  running = result;
  return result;
}

export function undoDepth(): number {
  return stack.length;
}

export function clearUndoForTests(): void {
  stack.length = 0;
  running = Promise.resolve();
}

/** Combines several actions into one, undone in reverse order. */
export function combine(label: string, actions: UndoAction[]): UndoAction {
  return {
    label,
    async undo() {
      for (const action of [...actions].reverse()) await action.undo();
    },
  };
}

// -- action builders -----------------------------------------------------------

/** Recreates a removed subtree at its old position. Returns old → new ids. */
export async function recreate(
  node: BookmarkNode,
  parentId: string,
  index?: number,
  ids = new Map<string, string>(),
): Promise<Map<string, string>> {
  const created = await bm.create({ parentId, title: node.title, url: node.url, index });
  ids.set(node.id, created.id);
  for (const child of node.children ?? [])
    await recreate(child, created.id, undefined, ids);
  return ids;
}

export function deleted(removed: BookmarkNode): UndoAction {
  const parentId = removed.parentId;
  const index = removed.index;
  return {
    label: `Deleted “${removed.title || 'Untitled'}”`,
    async undo() {
      if (!parentId) throw new Error('Unknown original folder');
      await recreate(removed, parentId, index);
    },
  };
}

export function created(node: BookmarkNode): UndoAction {
  return {
    label: `Added “${node.title || 'Untitled'}”`,
    async undo() {
      await bm.remove(node.id);
    },
  };
}

export function changed(
  id: string,
  before: { title: string; url?: string },
  label: string,
): UndoAction {
  return {
    label,
    async undo() {
      await bm.update(id, { title: before.title, url: before.url });
    },
  };
}

/** Puts an item back at `parentId`/`index` (its position before a move). */
export function moved(
  id: string,
  from: { parentId: string; index: number },
  label: string,
): UndoAction {
  return {
    label,
    async undo() {
      const now = await bm.getNode(id);
      // Chromium reads same-folder indexes before removal, so moving "down"
      // to the old slot needs +1.
      const sameFolder = now.parentId === from.parentId;
      const index =
        sameFolder && (now.index ?? 0) < from.index ? from.index + 1 : from.index;
      await bm.move(id, { parentId: from.parentId, index });
    },
  };
}
