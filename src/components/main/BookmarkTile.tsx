import { memo } from 'react';
import { displayHost } from '@/src/lib/url';
import type { BNode } from '@/src/store/bookmarkStore';
import type { Density } from '@/src/store/ui';
import { Favicon } from './Favicon';

interface BookmarkTileProps {
  bookmark: BNode;
  density: Density;
}

/** A bookmark in grid view. A real link, so ⌘-click and middle-click work. */
export const BookmarkTile = memo(function BookmarkTile({
  bookmark,
  density,
}: BookmarkTileProps) {
  const url = bookmark.url ?? '';
  const host = displayHost(url);
  const title = bookmark.title || host || url;

  if (density === 'compact') {
    return (
      <a
        href={url}
        title={`${title}\n${url}`}
        data-bookmark-id={bookmark.id}
        className="hover:bg-surface-strong flex h-10 items-center gap-2.5 rounded-xl px-2.5 transition-colors duration-150"
      >
        <Favicon url={url} title={title} size={16} />
        <span className="min-w-0 flex-1 truncate text-[13px]">{title}</span>
        <span className="text-ink-faint hidden max-w-[40%] truncate text-xs @[220px]:block">
          {host}
        </span>
      </a>
    );
  }

  return (
    <a
      href={url}
      title={`${title}\n${url}`}
      data-bookmark-id={bookmark.id}
      className="group border-line bg-surface hover:bg-surface-strong flex h-[132px] flex-col items-center justify-center gap-2.5 rounded-(--radius-tile) border px-3 text-center shadow-(--shadow-tile) backdrop-blur-md transition-[background-color,transform] duration-150 hover:-translate-y-px"
    >
      <span className="bg-surface-strong ring-line grid size-12 place-items-center rounded-2xl ring-1">
        <Favicon url={url} title={title} size={24} />
      </span>
      <span className="w-full min-w-0">
        <span className="line-clamp-2 text-[13px] leading-snug font-medium break-words">
          {title}
        </span>
        <span className="text-ink-faint mt-0.5 block truncate text-[11px]">{host}</span>
      </span>
    </a>
  );
});
