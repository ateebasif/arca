import type { Browser } from 'wxt/browser';
import { fakeBrowser } from 'wxt/testing/fake-browser';

/**
 * In-memory implementation of chrome.bookmarks that follows Chromium's
 * behaviour closely enough for wrapper, store, undo and dnd tests:
 * - root "0" holds Bookmarks Bar "1", Other Bookmarks "2", Mobile "3"
 * - root folders reject update/move/remove
 * - same-parent move uses the pre-removal index (Chromium's BookmarkModel::Move)
 * - remove() rejects non-empty folders; removeTree() rejects bookmarks
 * - every mutation fires the matching event with Chromium's payload shape
 */

type Node = Browser.bookmarks.BookmarkTreeNode;

interface Stored {
  id: string;
  parentId?: string;
  title: string;
  url?: string;
  dateAdded: number;
  dateGroupModified?: number;
  folderType?: Node['folderType'];
  children?: string[];
}

export interface SeedNode {
  title: string;
  url?: string;
  dateAdded?: number;
  children?: SeedNode[];
}

export interface FakeBookmarksSeed {
  bar?: SeedNode[];
  other?: SeedNode[];
  mobile?: SeedNode[];
}

type AnyListener = (...args: never[]) => unknown;

class FakeEvent<L extends AnyListener> {
  private listeners = new Set<L>();
  addListener = (cb: L) => void this.listeners.add(cb);
  removeListener = (cb: L) => void this.listeners.delete(cb);
  hasListener = (cb: L) => this.listeners.has(cb);
  hasListeners = () => this.listeners.size > 0;
  fire(...args: Parameters<L>) {
    for (const cb of this.listeners) (cb as (...a: Parameters<L>) => unknown)(...args);
  }
}

export class FakeBookmarks {
  private nodes = new Map<string, Stored>();
  private nextId = 4;
  private clock = 1_700_000_000_000;

  readonly onCreated = new FakeEvent<(id: string, node: Node) => void>();
  readonly onRemoved = new FakeEvent<
    (id: string, info: { parentId: string; index: number; node: Node }) => void
  >();
  readonly onChanged = new FakeEvent<
    (id: string, info: { title: string; url?: string }) => void
  >();
  readonly onMoved = new FakeEvent<
    (
      id: string,
      info: { parentId: string; index: number; oldParentId: string; oldIndex: number },
    ) => void
  >();
  readonly onChildrenReordered = new FakeEvent<
    (id: string, info: { childIds: string[] }) => void
  >();
  readonly onImportBegan = new FakeEvent<() => void>();
  readonly onImportEnded = new FakeEvent<() => void>();

  constructor(seed: FakeBookmarksSeed = {}) {
    const now = this.clock;
    this.nodes.set('0', { id: '0', title: '', dateAdded: now, children: [] });
    this.addRoot('1', 'Bookmarks bar', 'bookmarks-bar');
    this.addRoot('2', 'Other bookmarks', 'other');
    this.addRoot('3', 'Mobile bookmarks', 'mobile');
    this.seedInto('1', seed.bar ?? []);
    this.seedInto('2', seed.other ?? []);
    this.seedInto('3', seed.mobile ?? []);
  }

  // -- API surface --------------------------------------------------------

  getTree = async (): Promise<Node[]> => [this.toNode('0', true)];

  get = async (idOrIds: string | string[]): Promise<Node[]> => {
    const ids = Array.isArray(idOrIds) ? idOrIds : [idOrIds];
    return ids.map((id) => this.toNode(this.require(id).id, false));
  };

  getChildren = async (id: string): Promise<Node[]> => {
    const folder = this.requireFolder(id);
    return (folder.children ?? []).map((child) => this.toNode(child, false));
  };

  getSubTree = async (id: string): Promise<Node[]> => [
    this.toNode(this.require(id).id, true),
  ];

  getRecent = async (count: number): Promise<Node[]> =>
    [...this.nodes.values()]
      .filter((n) => n.url !== undefined)
      .sort((a, b) => b.dateAdded - a.dateAdded)
      .slice(0, count)
      .map((n) => this.toNode(n.id, false));

  search = async (
    query: string | { query?: string; url?: string; title?: string },
  ): Promise<Node[]> => {
    const q = typeof query === 'string' ? { query } : query;
    return [...this.nodes.values()]
      .filter((n) => n.id !== '0' && !n.folderType)
      .filter((n) => {
        if (q.url !== undefined && n.url !== q.url) return false;
        if (q.title !== undefined && n.title !== q.title) return false;
        if (q.query) {
          const needle = q.query.toLowerCase();
          return (
            n.title.toLowerCase().includes(needle) ||
            (n.url ?? '').toLowerCase().includes(needle)
          );
        }
        return true;
      })
      .map((n) => this.toNode(n.id, false));
  };

  create = async (details: {
    parentId?: string;
    index?: number;
    title?: string;
    url?: string;
  }): Promise<Node> => {
    const parentId = details.parentId ?? '2';
    const parent = this.requireFolder(parentId);
    if (parentId === '0') throw new Error("Can't modify the root bookmark folders.");
    const children = parent.children ?? [];
    const index = this.clampIndex(details.index, children.length);
    const id = String(this.nextId++);
    const stored: Stored = {
      id,
      parentId,
      title: details.title ?? '',
      url: details.url,
      dateAdded: this.tick(),
      children: details.url === undefined ? [] : undefined,
    };
    this.nodes.set(id, stored);
    children.splice(index, 0, id);
    parent.children = children;
    const node = this.toNode(id, false);
    this.onCreated.fire(id, node);
    return node;
  };

  update = async (id: string, changes: { title?: string; url?: string }) => {
    const node = this.requireMutable(id);
    if (changes.title !== undefined) node.title = changes.title;
    if (changes.url !== undefined && node.url !== undefined) node.url = changes.url;
    this.onChanged.fire(id, { title: node.title, url: node.url });
    return this.toNode(id, false);
  };

  move = async (id: string, destination: { parentId?: string; index?: number }) => {
    const node = this.requireMutable(id);
    const oldParentId = node.parentId as string;
    const oldParent = this.requireFolder(oldParentId);
    const newParentId = destination.parentId ?? oldParentId;
    const newParent = this.requireFolder(newParentId);
    if (newParentId === '0') throw new Error("Can't modify the root bookmark folders.");
    if (this.isSelfOrDescendant(newParentId, id)) {
      throw new Error("Can't move a folder to its descendant.");
    }

    const oldIndex = oldParent.children!.indexOf(id);
    let index = this.clampIndex(destination.index, newParent.children!.length);
    if (oldParentId === newParentId && index > oldIndex) index -= 1;

    oldParent.children!.splice(oldIndex, 1);
    newParent.children!.splice(index, 0, id);
    node.parentId = newParentId;
    this.onMoved.fire(id, { parentId: newParentId, index, oldParentId, oldIndex });
    return this.toNode(id, false);
  };

  remove = async (id: string) => {
    const node = this.requireMutable(id);
    if (node.children && node.children.length > 0) {
      throw new Error("Can't remove non-empty folder (use recursive to force).");
    }
    this.detach(node);
  };

  removeTree = async (id: string) => {
    const node = this.requireMutable(id);
    if (node.url !== undefined)
      throw new Error("Can't remove a bookmark with removeTree.");
    this.detach(node);
  };

  // -- test helpers -------------------------------------------------------

  /** Simulates the browser's own import (onImportBegan → creates → onImportEnded). */
  async simulateImport(parentId: string, items: SeedNode[]) {
    this.onImportBegan.fire();
    for (const item of items) await this.createDeep(parentId, item);
    this.onImportEnded.fire();
  }

  /** Ids of the children of a folder, in order. */
  childIds(id: string): string[] {
    return [...(this.requireFolder(id).children ?? [])];
  }

  findByTitle(title: string): Node | undefined {
    const found = [...this.nodes.values()].find((n) => n.title === title);
    return found ? this.toNode(found.id, false) : undefined;
  }

  get size(): number {
    return this.nodes.size;
  }

  // -- internals ----------------------------------------------------------

  private async createDeep(parentId: string, item: SeedNode) {
    const node = await this.create({ parentId, title: item.title, url: item.url });
    for (const child of item.children ?? []) await this.createDeep(node.id, child);
  }

  private addRoot(id: string, title: string, folderType: Node['folderType']) {
    this.nodes.set(id, {
      id,
      parentId: '0',
      title,
      dateAdded: this.clock,
      folderType,
      children: [],
    });
    this.nodes.get('0')!.children!.push(id);
  }

  private seedInto(parentId: string, items: SeedNode[]) {
    for (const item of items) {
      const id = String(this.nextId++);
      const isFolder = item.url === undefined;
      this.nodes.set(id, {
        id,
        parentId,
        title: item.title,
        url: item.url,
        dateAdded: item.dateAdded ?? this.tick(),
        children: isFolder ? [] : undefined,
      });
      this.nodes.get(parentId)!.children!.push(id);
      if (isFolder) this.seedInto(id, item.children ?? []);
    }
  }

  private detach(node: Stored) {
    const parent = this.nodes.get(node.parentId as string)!;
    const index = parent.children!.indexOf(node.id);
    const snapshot = this.toNode(node.id, true);
    parent.children!.splice(index, 1);
    this.deleteDeep(node.id);
    this.onRemoved.fire(node.id, { parentId: parent.id, index, node: snapshot });
  }

  private deleteDeep(id: string) {
    const node = this.nodes.get(id);
    for (const child of node?.children ?? []) this.deleteDeep(child);
    this.nodes.delete(id);
  }

  private isSelfOrDescendant(candidateId: string, ancestorId: string): boolean {
    let current: Stored | undefined = this.nodes.get(candidateId);
    while (current) {
      if (current.id === ancestorId) return true;
      current = current.parentId ? this.nodes.get(current.parentId) : undefined;
    }
    return false;
  }

  private require(id: string): Stored {
    const node = this.nodes.get(id);
    if (!node) throw new Error("Can't find bookmark for id.");
    return node;
  }

  private requireFolder(id: string): Stored {
    const node = this.require(id);
    if (node.url !== undefined) throw new Error("Can't find parent bookmark for id.");
    return node;
  }

  private requireMutable(id: string): Stored {
    const node = this.require(id);
    if (id === '0' || node.parentId === '0') {
      throw new Error("Can't modify the root bookmark folders.");
    }
    return node;
  }

  private clampIndex(index: number | undefined, length: number): number {
    if (index === undefined || index > length) return length;
    return Math.max(0, index);
  }

  private tick(): number {
    this.clock += 1000;
    return this.clock;
  }

  private toNode(id: string, deep: boolean): Node {
    const n = this.nodes.get(id)!;
    const parent = n.parentId ? this.nodes.get(n.parentId) : undefined;
    const node: Node = {
      id: n.id,
      title: n.title,
      dateAdded: n.dateAdded,
      syncing: false,
    };
    if (n.parentId !== undefined) node.parentId = n.parentId;
    if (parent) node.index = parent.children!.indexOf(n.id);
    if (n.url !== undefined) node.url = n.url;
    if (n.folderType !== undefined) node.folderType = n.folderType;
    if (n.children) {
      node.dateGroupModified = n.dateGroupModified ?? n.dateAdded;
      if (deep) node.children = n.children.map((c) => this.toNode(c, true));
    }
    return node;
  }
}

/** Installs a fresh FakeBookmarks onto WXT's fakeBrowser and returns it. */
export function installFakeBookmarks(seed?: FakeBookmarksSeed): FakeBookmarks {
  const fake = new FakeBookmarks(seed);
  Object.assign(fakeBrowser.bookmarks, {
    getTree: fake.getTree,
    get: fake.get,
    getChildren: fake.getChildren,
    getSubTree: fake.getSubTree,
    getRecent: fake.getRecent,
    search: fake.search,
    create: fake.create,
    update: fake.update,
    move: fake.move,
    remove: fake.remove,
    removeTree: fake.removeTree,
    onCreated: fake.onCreated,
    onRemoved: fake.onRemoved,
    onChanged: fake.onChanged,
    onMoved: fake.onMoved,
    onChildrenReordered: fake.onChildrenReordered,
    onImportBegan: fake.onImportBegan,
    onImportEnded: fake.onImportEnded,
  });
  return fake;
}
