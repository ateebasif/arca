import { useEffect, useMemo } from 'react';
import { sortNodes } from '@/src/features/sort';
import { folderCounts, folderPreview, getChildren, getPath } from '@/src/store/selectors';
import { useBookmarks } from '@/src/store/useBookmarks';
import { useUi } from '@/src/store/ui';
import { BookmarkRow, FolderRow, ListHeader } from './BookmarkList';
import { BookmarkTile } from './BookmarkTile';
import { FolderCard } from './FolderCard';
import { VIRTUALIZE_OVER } from './scrollParent';
import { VirtualRows } from './Virtual';

/** Contents of the open folder: folders first, then bookmarks, in grid or list. */
export function FolderView() {
  const state = useBookmarks();
  const currentFolderId = useUi((s) => s.currentFolderId);
  const density = useUi((s) => s.density);
  const view = useUi((s) => s.view);
  const sort = useUi((s) => s.sort);
  const direction = useUi((s) => s.sortDirection);
  const openFolder = useUi((s) => s.openFolder);

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
      <div role="table" aria-label="Folder contents" className="flex flex-col">
        <ListHeader />
        <div role="rowgroup" className="flex flex-col gap-px">
          {rows.length > VIRTUALIZE_OVER ? (
            <VirtualRows
              items={rows}
              rowHeight={41}
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
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {folders.length > 0 && (
        <section aria-label="Folders">
          <ul className="grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-3">
            {folders.map((folder) => (
              <li key={folder.id}>
                <FolderCard
                  folder={folder}
                  count={counts.get(folder.id) ?? 0}
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
              rowHeight={density === 'compact' ? 44 : 144}
              minColumnWidth={density === 'compact' ? 220 : 132}
              gap={density === 'compact' ? 4 : 12}
              getKey={(b) => b.id}
              render={(b) => <BookmarkTile bookmark={b} density={density} />}
              scrollToIndex={
                revealId ? bookmarks.findIndex((b) => b.id === revealId) : undefined
              }
            />
          ) : (
            <ul
              className={
                density === 'compact'
                  ? 'grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-1'
                  : 'grid grid-cols-[repeat(auto-fill,minmax(132px,1fr))] gap-3'
              }
            >
              {bookmarks.map((bookmark) => (
                <li key={bookmark.id} className="@container min-w-0">
                  <BookmarkTile bookmark={bookmark} density={density} />
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
    </div>
  );
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
