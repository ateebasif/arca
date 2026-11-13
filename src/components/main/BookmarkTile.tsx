import { memo } from 'react';
import { itemHandlers } from '@/src/features/editing/itemHandlers';
import { displayHost } from '@/src/lib/url';
import type { BNode } from '@/src/store/bookmarkStore';
import { useOverlays } from '@/src/store/overlays';
import type { Density } from '@/src/store/ui';
import { InlineRename } from '../overlays/InlineRename';
import { Favicon } from './Favicon';
import { MoreButton } from './MoreButton';

interface BookmarkTileProps {
  bookmark: BNode;
  density: Density;
}

/** A bookmark in grid view. A real link, so ⌘-click and middle-click work. */
export const BookmarkTile = memo(function BookmarkTile({
  bookmark,
  density,
}: BookmarkTileProps) {
  const renaming = useOverlays((s) => s.renamingId === bookmark.id);
  const url = bookmark.url ?? '';
  const host = displayHost(url);
  const title = bookmark.title || host || url;
  const handlers = itemHandlers(bookmark);
  const linkProps = {
    href: url,
    title: renaming ? undefined : `${title}\n${url}`,
    'data-bookmark-id': bookmark.id,
    draggable: !renaming,
    onClick: (e: React.MouseEvent) => renaming && e.preventDefault(),
    ...handlers,
  };
  const label = renaming ? (
    <InlineRename id={bookmark.id} initial={bookmark.title} className="h-6 text-[13px]" />
  ) : null;

  if (density === 'compact') {
    return (
      <div className="group relative">
        <a
          {...linkProps}
          className="hover:bg-surface-strong flex h-10 items-center gap-2.5 rounded-xl px-2.5 pr-9 transition-colors duration-150"
        >
          <Favicon url={url} title={title} size={16} />
          {label ?? <span className="min-w-0 flex-1 truncate text-[13px]">{title}</span>}
          {!renaming && (
            <span className="text-ink-faint hidden max-w-[40%] truncate text-xs @[260px]:block">
              {host}
            </span>
          )}
        </a>
        <MoreButton
          id={bookmark.id}
          title={title}
          className="absolute top-1.5 right-1.5"
        />
      </div>
    );
  }

  return (
    <div className="group relative">
      <a
        {...linkProps}
        className="border-line bg-surface hover:bg-surface-strong flex h-[132px] flex-col items-center justify-center gap-2.5 rounded-(--radius-tile) border px-3 text-center shadow-(--shadow-tile) backdrop-blur-md transition-[background-color,transform] duration-150 hover:-translate-y-px"
      >
        <span className="bg-surface-strong ring-line grid size-12 place-items-center rounded-2xl ring-1">
          <Favicon url={url} title={title} size={24} />
        </span>
        <span className="w-full min-w-0">
          {label ?? (
            <span className="line-clamp-2 text-[13px] leading-snug font-medium break-words">
              {title}
            </span>
          )}
          <span className="text-ink-faint mt-0.5 block truncate text-[11px]">{host}</span>
        </span>
      </a>
      <MoreButton id={bookmark.id} title={title} className="absolute top-1.5 right-1.5" />
    </div>
  );
});
