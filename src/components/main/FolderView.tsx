import { useMemo } from 'react';
import { sortNodes } from '@/src/features/sort';
import { folderCounts, folderPreview, getChildren, getPath } from '@/src/store/selectors';
import { useBookmarks } from '@/src/store/useBookmarks';
import { useUi } from '@/src/store/ui';
import { BookmarkRow, FolderRow, ListHeader } from './BookmarkList';
import { BookmarkTile } from './BookmarkTile';
import { FolderCard } from './FolderCard';

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
    return (
      <div role="table" aria-label="Folder contents" className="flex flex-col">
        <ListHeader />
        <div role="rowgroup" className="flex flex-col gap-px">
          {folders.map((folder) => (
            <FolderRow
              key={folder.id}
              folder={folder}
              count={counts.get(folder.id) ?? 0}
              onOpen={openFolder}
            />
          ))}
          {bookmarks.map((bookmark) => (
            <BookmarkRow key={bookmark.id} bookmark={bookmark} folderPath={folderPath} />
          ))}
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
        </section>
      )}
    </div>
  );
}
