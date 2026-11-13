import { memo } from 'react';
import { displayHost } from '@/src/lib/url';
import type { BNode } from '@/src/store/bookmarkStore';
import { useUi, type SortMode } from '@/src/store/ui';
import { ChevronRight, FolderIcon } from '../icons';
import { Favicon } from './Favicon';

const dateFormat = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' });

export const LIST_COLUMNS =
  'grid-cols-[minmax(0,2.2fr)_minmax(0,2fr)_minmax(0,1.2fr)_8rem]';

interface Column {
  label: string;
  sort?: SortMode;
}

const COLUMNS: Column[] = [
  { label: 'Title', sort: 'title' },
  { label: 'URL', sort: 'domain' },
  { label: 'Folder' },
  { label: 'Added', sort: 'date' },
];

/** Header row; clicking a sortable column sorts by it, again to flip direction. */
export function ListHeader() {
  const sort = useUi((s) => s.sort);
  const direction = useUi((s) => s.sortDirection);
  const setSort = useUi((s) => s.setSort);

  return (
    <div
      role="row"
      className={`grid ${LIST_COLUMNS} text-ink-muted gap-3 px-3 pb-1 text-xs`}
    >
      {COLUMNS.map((col) => {
        const colSort = col.sort;
        const active = colSort !== undefined && colSort === sort;
        const ariaSort = active
          ? direction === 'asc'
            ? 'ascending'
            : 'descending'
          : undefined;
        return (
          <div
            key={col.label}
            role="columnheader"
            aria-sort={ariaSort}
            className="min-w-0"
          >
            {colSort ? (
              <button
                type="button"
                onClick={() =>
                  setSort(colSort, active && direction === 'asc' ? 'desc' : 'asc')
                }
                className={`hover:text-ink flex items-center gap-1 rounded py-1 ${active ? 'text-ink font-medium' : ''}`}
              >
                {col.label}
                {active && (
                  <ChevronRight
                    width={10}
                    height={10}
                    className={direction === 'asc' ? '-rotate-90' : 'rotate-90'}
                  />
                )}
              </button>
            ) : (
              <span className="block py-1">{col.label}</span>
            )}
          </div>
        );
      })}
    </div>
  );
}

interface FolderRowProps {
  folder: BNode;
  count: number;
  onOpen(id: string): void;
}

export const FolderRow = memo(function FolderRow({
  folder,
  count,
  onOpen,
}: FolderRowProps) {
  return (
    <div
      role="row"
      tabIndex={0}
      data-folder-row={folder.id}
      onClick={() => onOpen(folder.id)}
      onKeyDown={(e) => {
        if (e.key === 'Enter') onOpen(folder.id);
      }}
      className={`grid ${LIST_COLUMNS} hover:bg-surface-strong h-10 items-center gap-3 rounded-xl px-3 transition-colors duration-150`}
    >
      <div role="cell" className="flex min-w-0 items-center gap-2.5">
        <FolderIcon className="text-accent shrink-0" />
        <span className="truncate font-medium">{folder.title || 'Untitled'}</span>
      </div>
      <div role="cell" className="text-ink-faint truncate text-xs">
        {count === 1 ? '1 bookmark' : `${count} bookmarks`}
      </div>
      <div role="cell" />
      <div role="cell" className="text-ink-muted text-xs tabular-nums">
        {folder.dateAdded ? dateFormat.format(folder.dateAdded) : ''}
      </div>
    </div>
  );
});

interface BookmarkRowProps {
  bookmark: BNode;
  /** Parent folder path, e.g. "Bookmarks bar / Work". */
  folderPath: string;
}

export const BookmarkRow = memo(function BookmarkRow({
  bookmark,
  folderPath,
}: BookmarkRowProps) {
  const url = bookmark.url ?? '';
  const title = bookmark.title || displayHost(url) || url;
  return (
    <a
      role="row"
      href={url}
      title={`${title}\n${url}`}
      data-bookmark-id={bookmark.id}
      className={`grid ${LIST_COLUMNS} hover:bg-surface-strong h-10 items-center gap-3 rounded-xl px-3 transition-colors duration-150`}
    >
      <span role="cell" className="flex min-w-0 items-center gap-2.5">
        <Favicon url={url} title={title} size={16} />
        <span className="truncate">{title}</span>
      </span>
      <span role="cell" className="text-ink-muted truncate text-xs">
        {url.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '')}
      </span>
      <span role="cell" className="text-ink-faint truncate text-xs">
        {folderPath}
      </span>
      <span role="cell" className="text-ink-muted text-xs tabular-nums">
        {bookmark.dateAdded ? dateFormat.format(bookmark.dateAdded) : ''}
      </span>
    </a>
  );
});
