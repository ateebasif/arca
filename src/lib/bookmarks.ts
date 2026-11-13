import { browser, type Browser } from 'wxt/browser';
import { ArcaError, callApi } from './errors';
import { classifyUrl } from './url';

function assertSafeUrl(url: string | undefined): void {
  if (url !== undefined && classifyUrl(url) === 'blocked') {
    throw new ArcaError('BLOCKED_URL', 'Arca only saves web and browser-page URLs');
  }
}

/**
 * The only module that talks to the browser bookmarks API. Everything else
 * (store, features, components) goes through these functions.
 */

export type BookmarkNode = Browser.bookmarks.BookmarkTreeNode;

/** Id of the invisible top-level node that holds the browser's root folders. */
export const ROOT_ID = '0';

export const isFolder = (node: BookmarkNode): boolean => node.url === undefined;

/**
 * Root containers (Bookmarks Bar, Other Bookmarks, Mobile, managed folders)
 * can't be renamed, moved or deleted. Newer Chromium marks them with
 * `folderType`; the parent-id check covers browsers that don't.
 */
export function isRootFolder(node: BookmarkNode): boolean {
  return (
    node.id === ROOT_ID ||
    node.parentId === ROOT_ID ||
    node.folderType !== undefined ||
    node.unmodifiable !== undefined
  );
}

// ---------------------------------------------------------------------------
// Reads
// ---------------------------------------------------------------------------

/** The full tree. Returns the invisible root node (id "0"). */
export async function getTree(): Promise<BookmarkNode> {
  const [root] = await callApi('bookmarks.getTree', () => browser.bookmarks.getTree());
  if (!root) throw new ArcaError('API', 'bookmarks.getTree returned no root');
  return root;
}

export async function getNode(id: string): Promise<BookmarkNode> {
  try {
    const [node] = await browser.bookmarks.get(id);
    if (node) return node;
  } catch {
    // Chromium rejects unknown ids; fall through to NOT_FOUND.
  }
  throw new ArcaError('NOT_FOUND', `No bookmark with id ${id}`);
}

export async function getChildren(id: string): Promise<BookmarkNode[]> {
  await getNode(id);
  return callApi('bookmarks.getChildren', () => browser.bookmarks.getChildren(id));
}

export async function getSubTree(id: string): Promise<BookmarkNode> {
  const node = await getNode(id);
  const [sub] = await callApi('bookmarks.getSubTree', () =>
    browser.bookmarks.getSubTree(node.id),
  );
  if (!sub) throw new ArcaError('NOT_FOUND', `No bookmark with id ${id}`);
  return sub;
}

/** Ids of every ancestor of `id`, nearest first, ending with ROOT_ID. */
export async function getAncestorIds(id: string): Promise<string[]> {
  const ids: string[] = [];
  let current = await getNode(id);
  while (current.parentId !== undefined) {
    ids.push(current.parentId);
    current = await getNode(current.parentId);
  }
  return ids;
}

// ---------------------------------------------------------------------------
// Writes
// ---------------------------------------------------------------------------

async function getFolder(id: string): Promise<BookmarkNode> {
  const node = await getNode(id);
  if (!isFolder(node)) throw new ArcaError('NOT_A_FOLDER', `${id} is not a folder`);
  return node;
}

async function getMutable(id: string): Promise<BookmarkNode> {
  const node = await getNode(id);
  if (isRootFolder(node)) {
    throw new ArcaError('ROOT_FOLDER', `"${node.title}" is a browser root folder`);
  }
  return node;
}

export interface CreateInput {
  parentId: string;
  title: string;
  /** Omit to create a folder. */
  url?: string;
  index?: number;
  /**
   * Re-creating a bookmark the browser already had (undo). Its URL came from
   * the browser, so the "never save javascript:/data:" rule doesn't apply;
   * Arca still never opens or links such URLs.
   */
  restore?: boolean;
}

export async function create(input: CreateInput): Promise<BookmarkNode> {
  if (!input.restore) assertSafeUrl(input.url);
  const parent = await getFolder(input.parentId);
  if (parent.id === ROOT_ID) {
    throw new ArcaError('ROOT_FOLDER', 'Cannot add items to the top-level root');
  }
  return callApi('bookmarks.create', () =>
    browser.bookmarks.create({
      parentId: parent.id,
      title: input.title,
      url: input.url,
      index: input.index,
    }),
  );
}

export interface UpdateInput {
  title?: string;
  /** Ignored by the browser for folders; rejected here to surface the bug early. */
  url?: string;
}

export async function update(
  id: string,
  changes: UpdateInput,
  { restore = false }: { restore?: boolean } = {},
): Promise<BookmarkNode> {
  if (!restore) assertSafeUrl(changes.url);
  const node = await getMutable(id);
  if (changes.url !== undefined && isFolder(node)) {
    throw new ArcaError('NOT_A_FOLDER', 'Folders have no URL');
  }
  return callApi('bookmarks.update', () => browser.bookmarks.update(id, changes));
}

export interface MoveDestination {
  parentId: string;
  /**
   * Position in the destination folder, using the browser's semantics: when
   * moving within the same folder, it is the index in the list *before* the
   * item is removed.
   */
  index?: number;
}

export async function move(id: string, to: MoveDestination): Promise<BookmarkNode> {
  const node = await getMutable(id);
  const parent = await getFolder(to.parentId);
  if (parent.id === ROOT_ID) {
    throw new ArcaError('INVALID_MOVE', 'Cannot move items to the top-level root');
  }
  if (isFolder(node)) {
    const ancestors = parent.id === node.id ? [] : await getAncestorIds(parent.id);
    if (parent.id === node.id || ancestors.includes(node.id)) {
      throw new ArcaError('INVALID_MOVE', 'Cannot move a folder into itself');
    }
  }
  return callApi('bookmarks.move', () =>
    browser.bookmarks.move(id, { parentId: parent.id, index: to.index }),
  );
}

/**
 * Removes a bookmark, or a folder with everything in it. Returns the removed
 * subtree so callers (undo) can recreate it.
 */
export async function remove(id: string): Promise<BookmarkNode> {
  const node = await getMutable(id);
  if (!isFolder(node)) {
    await callApi('bookmarks.remove', () => browser.bookmarks.remove(id));
    return node;
  }
  const subtree = await getSubTree(id);
  await callApi('bookmarks.removeTree', () => browser.bookmarks.removeTree(id));
  return subtree;
}

// ---------------------------------------------------------------------------
// Events
// ---------------------------------------------------------------------------

type Listener<E> = E extends { addListener(cb: infer L): void } ? L : never;
type BookmarksEvents = typeof browser.bookmarks;

export interface BookmarkEventHandlers {
  onCreated: Listener<BookmarksEvents['onCreated']>;
  onRemoved: Listener<BookmarksEvents['onRemoved']>;
  onChanged: Listener<BookmarksEvents['onChanged']>;
  onMoved: Listener<BookmarksEvents['onMoved']>;
  onChildrenReordered: Listener<BookmarksEvents['onChildrenReordered']>;
  onImportBegan: Listener<BookmarksEvents['onImportBegan']>;
  onImportEnded: Listener<BookmarksEvents['onImportEnded']>;
}

/** Subscribes to bookmark events. Returns a function that unsubscribes all of them. */
export function subscribe(handlers: Partial<BookmarkEventHandlers>): () => void {
  const cleanups: Array<() => void> = [];
  const add = <K extends keyof BookmarkEventHandlers>(name: K) => {
    const handler = handlers[name];
    if (!handler) return;
    // Each event's addListener takes its own handler type; the mapped type
    // above guarantees they line up, which TS can't follow through the index.
    const event = browser.bookmarks[name] as unknown as {
      addListener(cb: BookmarkEventHandlers[K]): void;
      removeListener(cb: BookmarkEventHandlers[K]): void;
    };
    event.addListener(handler);
    cleanups.push(() => event.removeListener(handler));
  };
  (Object.keys(handlers) as Array<keyof BookmarkEventHandlers>).forEach(add);
  return () => cleanups.forEach((fn) => fn());
}
