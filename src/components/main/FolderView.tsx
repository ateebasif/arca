import { useDescriptionsOn } from '@/src/features/ai/useDescription';
import { useEffect, useMemo, useState, type CSSProperties, type ReactNode } from 'react';
import {
  rectSortingStrategy,
  SortableContext,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { itemId } from '@/src/features/dnd/ids';
import { sortNodes } from '@/src/features/sort';
import {
  folderCounts,
  folderPreview,
  getChildren,
  getPath,
  linksWithin,
} from '@/src/store/selectors';
import { useBookmarks } from '@/src/store/useBookmarks';
import { useUi } from '@/src/store/ui';
import { BookmarkRow, FolderRow, ListHeader } from './BookmarkList';
import { BookmarkTile } from './BookmarkTile';
import { FolderCard } from './FolderCard';
import { VIRTUALIZE_OVER } from './scrollParent';
import { VirtualRows } from './Virtual';

const stagger = (i: number) => ({ '--i': Math.min(i, 24) }) as CSSProperties;

/**
 * Plays the tile entrance animation once when mounted (keyed by folder and
 * view), then stops so tiles that scroll into view later don't animate.
 */
function Entering({ children }: { children: ReactNode }) {
  const [entering, setEntering] = useState(true);
  useEffect(() => {
    const timer = setTimeout(() => setEntering(false), 900);
    return () => clearTimeout(timer);
  }, []);
  return <div className={entering ? 'arca-entering' : undefined}>{children}</div>;
}

/** Contents of the open folder: folders first, then bookmarks, in grid or list. */
export function FolderView() {
  const currentFolderId = useUi((s) => s.currentFolderId);
  const scope = useUi((s) => s.scope);
  const view = useUi((s) => s.view);
  return (
    <Entering key={`${currentFolderId}:${scope}:${view}`}>
      <FolderContents />
    </Entering>
  );
}

function FolderContents() {
  // Rows grow to fit a description line when those are on.
  const rowHeight = useDescriptionsOn() ? 53 : 41;
  const state = useBookmarks();
  const currentFolderId = useUi((s) => s.currentFolderId);
  const density = useUi((s) => s.density);
  const view = useUi((s) => s.view);
  const sort = useUi((s) => s.sort);
  const direction = useUi((s) => s.sortDirection);
  const openFolder = useUi((s) => s.openFolder);
  const scope = useUi((s) => s.scope);

  const { folders, bookmarks } = useMemo(() => {
    const children = getChildren(state, currentFolderId);
    return {
      folders: sortNodes(
        children.filter((c) => c.childIds !== null),
        sort === 'domain' ? 'title' : sort,
        direction,
      ),
      bookmarks: sortNodes(
        children.filter((c) => c.childIds === null),
        sort,
        direction,
      ),
    };
  }, [state, currentFolderId, sort, direction]);
  const counts = folderCounts(state);
  const revealId = useUi((s) => s.revealId);
  useRevealEffect();

  if (!state.ready) return null;

  if (scope === 'all') return <AllLinksView />;

  if (folders.length === 0 && bookmarks.length === 0) {
    return (
      <div className="text-ink-muted flex flex-col items-center justify-center gap-1 py-24 text-center">
        <p className="text-ink text-[15px] font-medium">This folder is empty</p>
        <p className="text-sm">Bookmarks you add here show up in the browser too.</p>
      </div>
    );
  }

  if (view === 'list') {
    const folderPath = getPath(state, currentFolderId)
      .map((n) => n.title)
      .join(' / ');
    const rows = [...folders, ...bookmarks];
    const renderRow = (node: (typeof rows)[number]) =>
      node.childIds ? (
        <FolderRow folder={node} count={counts.get(node.id) ?? 0} onOpen={openFolder} />
      ) : (
        <BookmarkRow bookmark={node} folderPath={folderPath} />
      );
    return (
      <SortableContext
        items={rows.map((n) => itemId(n.id))}
        strategy={verticalListSortingStrategy}
        disabled={{ draggable: false, droppable: sort !== 'manual' }}
      >
        <div role="table" aria-label="Folder contents" className="flex flex-col">
          <ListHeader />
          <div role="rowgroup" className="flex flex-col gap-px">
            {rows.length > VIRTUALIZE_OVER ? (
              <VirtualRows
                items={rows}
                rowHeight={rowHeight}
                minColumnWidth={0}
                gap={1}
                getKey={(n) => n.id}
                render={renderRow}
                scrollToIndex={
                  revealId ? rows.findIndex((n) => n.id === revealId) : undefined
                }
              />
            ) : (
              rows.map((node) => <div key={node.id}>{renderRow(node)}</div>)
            )}
          </div>
        </div>
      </SortableContext>
    );
  }

  return (
    <SortableContext
      items={[...folders, ...bookmarks].map((n) => itemId(n.id))}
      strategy={rectSortingStrategy}
      disabled={{ draggable: false, droppable: sort !== 'manual' }}
    >
      <div className="flex flex-col gap-6">
        {folders.length > 0 && (
          <section aria-label="Folders">
            <ul className={gridClass('comfortable')}>
              {folders.map((folder, i) => (
                <li key={folder.id} data-tile="" style={stagger(i)}>
                  <FolderCard
                    folder={folder}
                    count={counts.get(folder.id) ?? 0}
                    subfolders={
                      (folder.childIds ?? []).filter((c) => state.nodes.get(c)?.childIds)
                        .length
                    }
                    preview={folderPreview(state, folder)}
                    onOpen={openFolder}
                  />
                </li>
              ))}
            </ul>
          </section>
        )}
        {bookmarks.length > 0 && (
          <section aria-label="Bookmarks">
            {bookmarks.length > VIRTUALIZE_OVER ? (
              <VirtualRows
                items={bookmarks}
                rowHeight={density === 'compact' ? 44 : TILE_ROW_HEIGHT}
                minColumnWidth={density === 'compact' ? 220 : TILE_MIN_WIDTH}
                gap={density === 'compact' ? 4 : 12}
                getKey={(b) => b.id}
                render={(b) => <BookmarkTile bookmark={b} density={density} />}
                scrollToIndex={
                  revealId ? bookmarks.findIndex((b) => b.id === revealId) : undefined
                }
              />
            ) : (
              <ul className={gridClass(density)}>
                {bookmarks.map((bookmark, i) => (
                  <li
                    key={bookmark.id}
                    data-tile=""
                    className="@container min-w-0"
                    style={stagger(i + folders.length)}
                  >
                    <BookmarkTile bookmark={bookmark} density={density} />
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}
      </div>
    </SortableContext>
  );
}

/** Every link inside the open folder, flattened, each labelled with its folder. */
function AllLinksView() {
  // Rows grow to fit a description line when those are on.
  const rowHeight = useDescriptionsOn() ? 53 : 41;
  const state = useBookmarks();
  const currentFolderId = useUi((s) => s.currentFolderId);
  const density = useUi((s) => s.density);
  const view = useUi((s) => s.view);
  const sort = useUi((s) => s.sort);
  const direction = useUi((s) => s.sortDirection);
  const revealId = useUi((s) => s.revealId);

  const { items, labels, folderCount } = useMemo(() => {
    const links = linksWithin(state, currentFolderId);
    const labelById = new Map(links.map((l) => [l.node.id, l.folderLabel]));
    const sorted = sortNodes(
      links.map((l) => l.node),
      sort,
      direction,
    );
    return {
      items: sorted,
      labels: labelById,
      folderCount: new Set(links.map((l) => l.folderId)).size,
    };
  }, [state, currentFolderId, sort, direction]);

  const here = state.nodes.get(currentFolderId)?.title || 'this folder';
  if (items.length === 0) {
    return (
      <div className="text-ink-muted flex flex-col items-center justify-center gap-1 py-24 text-center">
        <p className="text-ink text-[15px] font-medium">No links in “{here}”</p>
        <p className="text-sm">Its folders are empty too.</p>
      </div>
    );
  }

  const summary = (
    <p className="text-ink-muted mb-3 text-xs" aria-live="polite">
      {items.length.toLocaleString()} {items.length === 1 ? 'link' : 'links'}
      {folderCount > 1 ? ` across ${folderCount.toLocaleString()} folders` : ''}
    </p>
  );
  const labelFor = (id: string) => labels.get(id) || here;
  const scrollTo = revealId ? items.findIndex((b) => b.id === revealId) : undefined;

  const ids = items.map((n) => itemId(n.id));
  const noReorder = { draggable: false, droppable: true };
  if (view === 'list') {
    return (
      <SortableContext items={ids} disabled={noReorder}>
        <div>
          {summary}
          <div role="table" aria-label="All links" className="flex flex-col">
            <ListHeader />
            <div role="rowgroup" className="flex flex-col gap-px">
              {items.length > VIRTUALIZE_OVER ? (
                <VirtualRows
                  items={items}
                  rowHeight={rowHeight}
                  minColumnWidth={0}
                  gap={1}
                  getKey={(n) => n.id}
                  render={(n) => <BookmarkRow bookmark={n} folderPath={labelFor(n.id)} />}
                  scrollToIndex={scrollTo}
                />
              ) : (
                items.map((n) => (
                  <BookmarkRow key={n.id} bookmark={n} folderPath={labelFor(n.id)} />
                ))
              )}
            </div>
          </div>
        </div>
      </SortableContext>
    );
  }

  const render = (b: (typeof items)[number]) => (
    <BookmarkTile bookmark={b} density={density} folderLabel={labelFor(b.id)} />
  );
  return (
    <SortableContext items={ids} disabled={noReorder}>
      <section aria-label="All links">
        {summary}
        {items.length > VIRTUALIZE_OVER ? (
          <VirtualRows
            items={items}
            rowHeight={density === 'compact' ? 44 : TILE_ROW_HEIGHT}
            minColumnWidth={density === 'compact' ? 220 : TILE_MIN_WIDTH}
            gap={density === 'compact' ? 4 : 12}
            getKey={(b) => b.id}
            render={render}
            scrollToIndex={scrollTo}
          />
        ) : (
          <ul className={gridClass(density)}>
            {items.map((b, i) => (
              <li
                key={b.id}
                data-tile=""
                className="@container min-w-0"
                style={stagger(i)}
              >
                {render(b)}
              </li>
            ))}
          </ul>
        )}
      </section>
    </SortableContext>
  );
}

/** Grid sizing shared by the folder view and the all-links view. */
export const TILE_MIN_WIDTH = 176;
export const TILE_ROW_HEIGHT = 156;
function gridClass(density: 'comfortable' | 'compact'): string {
  return density === 'compact'
    ? 'grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-1'
    : 'grid grid-cols-[repeat(auto-fill,minmax(176px,1fr))] gap-3';
}

/**
 * After "show in folder", scroll to the item, focus it and flash a ring.
 * Virtualized lists render the row a frame or two later, so retry briefly.
 */
function useRevealEffect() {
  const revealId = useUi((s) => s.revealId);
  const clearReveal = useUi((s) => s.clearReveal);
  useEffect(() => {
    if (!revealId) return;
    const selector = [
      `[data-bookmark-id="${CSS.escape(revealId)}"]`,
      `[data-folder-card="${CSS.escape(revealId)}"]`,
      `[data-folder-row="${CSS.escape(revealId)}"]`,
    ].join(',');
    let frame = 0;
    let attempts = 0;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const tryReveal = () => {
      const el = document.querySelector<HTMLElement>(selector);
      if (!el) {
        if (++attempts < 20) frame = requestAnimationFrame(tryReveal);
        return;
      }
      el.scrollIntoView({ block: 'center' });
      el.focus({ preventScroll: true });
      el.classList.add('ring-2', 'ring-accent');
      timer = setTimeout(() => {
        el.classList.remove('ring-2', 'ring-accent');
        clearReveal();
      }, 1600);
    };
    tryReveal();
    return () => {
      cancelAnimationFrame(frame);
      clearTimeout(timer);
    };
  }, [revealId, clearReveal]);
}
