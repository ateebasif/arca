import * as api from '@/src/lib/bookmarks';
import type { BookmarkNode } from '@/src/lib/bookmarks';

/**
 * In-memory mirror of the browser's bookmark tree, normalized by id.
 *
 * Loaded once with getTree(), then kept current by applying bookmark events
 * incrementally. The browser stays the source of truth: when anything looks
 * inconsistent (unknown parent, events during an import) the store reloads.
 * Snapshots are immutable so React can subscribe with useSyncExternalStore.
 */

export interface BNode {
  id: string;
  /** null only for the invisible top-level root. */
  parentId: string | null;
  title: string;
  /** Undefined for folders. */
  url?: string;
  dateAdded: number;
  /** Child ids in browser order; null for bookmarks. */
  childIds: readonly string[] | null;
  /** Browser root container (Bookmarks Bar, Other, Mobile, managed). */
  isRoot: boolean;
}

export interface BookmarkSnapshot {
  readonly nodes: ReadonlyMap<string, BNode>;
  /** Visible root folders, in browser order. */
  readonly rootIds: readonly string[];
  readonly ready: boolean;
  /** Bumped on every change. */
  readonly version: number;
}

const EMPTY: BookmarkSnapshot = {
  nodes: new Map(),
  rootIds: [],
  ready: false,
  version: 0,
};

export type BookmarksApi = Pick<typeof api, 'getTree' | 'subscribe'>;

export class BookmarkStore {
  private snapshot: BookmarkSnapshot = EMPTY;
  private listeners = new Set<() => void>();
  private unsubscribe: (() => void) | null = null;
  private importing = false;
  private loading: Promise<void> | null = null;
  private reloadQueued = false;

  constructor(private readonly bookmarks: BookmarksApi = api) {}

  getSnapshot = (): BookmarkSnapshot => this.snapshot;

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  /** Subscribes to browser events, then loads the tree. Safe to call twice. */
  start(): Promise<void> {
    if (!this.unsubscribe) {
      this.unsubscribe = this.bookmarks.subscribe({
        onCreated: (id, node) => this.apply(() => this.onCreated(id, node)),
        onRemoved: (id, info) => this.apply(() => this.onRemoved(id, info.parentId)),
        onChanged: (id, info) => this.apply(() => this.onChanged(id, info)),
        onMoved: (id, info) => this.apply(() => this.onMoved(id, info)),
        onChildrenReordered: (id, info) =>
          this.apply(() => this.onChildrenReordered(id, info.childIds)),
        onImportBegan: () => {
          this.importing = true;
        },
        onImportEnded: () => {
          this.importing = false;
          void this.reload();
        },
      });
    }
    return this.reload();
  }

  stop(): void {
    this.unsubscribe?.();
    this.unsubscribe = null;
  }

  /** Reloads the whole tree. Concurrent calls coalesce into one extra reload. */
  reload(): Promise<void> {
    if (this.loading) {
      this.reloadQueued = true;
      return this.loading;
    }
    this.loading = (async () => {
      try {
        do {
          this.reloadQueued = false;
          const root = await this.bookmarks.getTree();
          this.publish(buildNodes(root));
        } while (this.reloadQueued);
      } finally {
        this.loading = null;
      }
    })();
    return this.loading;
  }

  // -- event handling -------------------------------------------------------

  /**
   * Runs an incremental update. Events during an import, while loading, or
   * that don't fit the current tree trigger a full reload instead.
   */
  private apply(update: () => Map<string, BNode> | null): void {
    if (this.importing) return;
    if (this.loading || !this.snapshot.ready) {
      this.reloadQueued = true;
      void this.reload();
      return;
    }
    const next = update();
    if (next) this.publish(next);
    else void this.reload();
  }

  private draft(): Map<string, BNode> {
    return new Map(this.snapshot.nodes);
  }

  private onCreated(id: string, node: BookmarkNode): Map<string, BNode> | null {
    const nodes = this.draft();
    const parent = node.parentId ? nodes.get(node.parentId) : undefined;
    if (!parent?.childIds || nodes.has(id)) return null;
    for (const [nid, n] of flatten(node, node.parentId ?? null)) nodes.set(nid, n);
    const childIds = [...parent.childIds];
    childIds.splice(node.index ?? childIds.length, 0, id);
    nodes.set(parent.id, { ...parent, childIds });
    return nodes;
  }

  private onRemoved(id: string, parentId: string): Map<string, BNode> | null {
    const nodes = this.draft();
    const parent = nodes.get(parentId);
    if (!parent?.childIds || !nodes.has(id)) return null;
    nodes.set(parentId, { ...parent, childIds: parent.childIds.filter((c) => c !== id) });
    const stack = [id];
    let nextId: string | undefined;
    while ((nextId = stack.pop()) !== undefined) {
      const current = nodes.get(nextId);
      if (!current) continue;
      nodes.delete(current.id);
      if (current.childIds) stack.push(...current.childIds);
    }
    return nodes;
  }

  private onChanged(id: string, info: { title: string; url?: string }) {
    const nodes = this.draft();
    const node = nodes.get(id);
    if (!node) return null;
    nodes.set(id, {
      ...node,
      title: info.title,
      url: node.url === undefined ? undefined : info.url,
    });
    return nodes;
  }

  private onMoved(
    id: string,
    info: { parentId: string; index: number; oldParentId: string },
  ): Map<string, BNode> | null {
    const nodes = this.draft();
    const node = nodes.get(id);
    const oldParent = nodes.get(info.oldParentId);
    if (!node || !oldParent?.childIds) return null;
    nodes.set(oldParent.id, {
      ...oldParent,
      childIds: oldParent.childIds.filter((c) => c !== id),
    });
    const newParent = nodes.get(info.parentId);
    if (!newParent?.childIds) return null;
    const childIds = [...newParent.childIds];
    childIds.splice(info.index, 0, id);
    nodes.set(newParent.id, { ...newParent, childIds });
    nodes.set(id, { ...node, parentId: info.parentId });
    return nodes;
  }

  private onChildrenReordered(id: string, childIds: string[]) {
    const nodes = this.draft();
    const folder = nodes.get(id);
    if (!folder?.childIds) return null;
    nodes.set(id, { ...folder, childIds: [...childIds] });
    return nodes;
  }

  private publish(nodes: Map<string, BNode>): void {
    const root = nodes.get(api.ROOT_ID);
    this.snapshot = {
      nodes,
      rootIds: root?.childIds ?? [],
      ready: true,
      version: this.snapshot.version + 1,
    };
    for (const listener of this.listeners) listener();
  }
}

// -- building -----------------------------------------------------------------

function toBNode(node: BookmarkNode, parentId: string | null): BNode {
  return {
    id: node.id,
    parentId,
    title: node.title,
    url: node.url,
    dateAdded: node.dateAdded ?? 0,
    childIds: node.url === undefined ? (node.children ?? []).map((c) => c.id) : null,
    isRoot: api.isRootFolder(node),
  };
}

function* flatten(
  node: BookmarkNode,
  parentId: string | null,
): Generator<[string, BNode]> {
  yield [node.id, toBNode(node, parentId)];
  for (const child of node.children ?? []) yield* flatten(child, node.id);
}

export function buildNodes(root: BookmarkNode): Map<string, BNode> {
  return new Map(flatten(root, null));
}
