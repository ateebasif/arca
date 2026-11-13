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
  renamedIds.clear();
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

// -- id remapping ----------------------------------------------------------------
//
// Undoing a delete recreates bookmarks with NEW ids. Older undo entries still
// hold the old ids, so every action resolves ids through this map at undo time.

const renamedIds = new Map<string, string>();

/** The current id for an id that may have been recreated by an undo. */
export function resolveId(id: string): string {
  let current = id;
  for (let hops = 0; hops < 50; hops++) {
    const next = renamedIds.get(current);
    if (!next) return current;
    current = next;
  }
  return current;
}

// -- action builders -----------------------------------------------------------

/**
 * Recreates a removed subtree at its old position, recording old → new ids.
 * A child that fails doesn't stop its siblings; failures are counted.
 */
export async function recreate(
  node: BookmarkNode,
  parentId: string,
  index?: number,
): Promise<{ failed: number }> {
  const created = await bm.create({
    parentId: resolveId(parentId),
    title: node.title,
    url: node.url,
    index,
    restore: true,
  });
  renamedIds.set(node.id, created.id);
  let failed = 0;
  for (const child of node.children ?? []) {
    try {
      failed += (await recreate(child, created.id)).failed;
    } catch {
      failed += 1;
    }
  }
  return { failed };
}

export function deleted(removed: BookmarkNode): UndoAction {
  const parentId = removed.parentId;
  const index = removed.index;
  return {
    label: `Deleted “${removed.title || 'Untitled'}”`,
    async undo() {
      if (!parentId) throw new Error('Unknown original folder');
      const { failed } = await recreate(removed, parentId, index);
      if (failed)
        throw new Error(`${failed} item${failed === 1 ? '' : 's'} couldn't be restored`);
    },
  };
}

export function created(node: BookmarkNode): UndoAction {
  return {
    label: `Added “${node.title || 'Untitled'}”`,
    async undo() {
      const id = resolveId(node.id);
      const now = await bm.getNode(id);
      // Never delete things the user put into a folder after creating it.
      if (now.url === undefined && (await bm.getChildren(id)).length > 0) {
        throw new Error(`“${now.title}” isn't empty any more, so it was kept`);
      }
      await bm.remove(id);
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
      const current = resolveId(id);
      const now = await bm.getNode(current);
      // Only send the URL when it actually changed (a rename leaves it alone).
      const url =
        before.url !== undefined && before.url !== now.url ? before.url : undefined;
      await bm.update(current, { title: before.title, url }, { restore: true });
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
      const current = resolveId(id);
      const parentId = resolveId(from.parentId);
      const now = await bm.getNode(current);
      // Chromium reads same-folder indexes before removal, so moving "down"
      // to the old slot needs +1.
      const sameFolder = now.parentId === parentId;
      const index =
        sameFolder && (now.index ?? 0) < from.index ? from.index + 1 : from.index;
      await bm.move(current, { parentId, index });
    },
  };
}
