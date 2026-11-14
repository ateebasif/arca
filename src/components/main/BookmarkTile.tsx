import { useSelection } from '@/src/store/selection';
import { SelectBox } from '../select/SelectBox';
import { useTags } from '@/src/store/useMeta';
import { TagChips } from '../tags/TagChips';
import { memo } from 'react';
import { itemHandlers } from '@/src/features/editing/itemHandlers';
import { isDragActive } from '@/src/features/dnd/ids';
import { useDragItem } from '@/src/features/dnd/hooks';
import { bookmarkLinkProps } from '@/src/features/open';
import { displayHost, mainDomain } from '@/src/lib/url';
import type { BNode } from '@/src/store/bookmarkStore';
import { useOverlays } from '@/src/store/overlays';
import type { Density } from '@/src/store/ui';
import { InlineRename } from '../overlays/InlineRename';
import { FolderIcon } from '../icons';
import { Favicon } from './Favicon';
import { MoreButton } from './MoreButton';
import { useCover } from './useCoverTone';

interface BookmarkTileProps {
  bookmark: BNode;
  density: Density;
  /** Folder name to show instead of the host (all-links view). */
  folderLabel?: string;
}

/** A bookmark in grid view. A real link, so ⌘-click and middle-click work. */
export const BookmarkTile = memo(function BookmarkTile({
  bookmark,
  density,
  folderLabel,
}: BookmarkTileProps) {
  const renaming = useOverlays(
    (s) => s.renamingId === bookmark.id && s.renameIn === 'main',
  );
  const url = bookmark.url ?? '';
  const host = displayHost(url);
  const title = bookmark.title || host || url;
  const handlers = itemHandlers(bookmark);
  const link = bookmarkLinkProps(url);
  const drag = useDragItem(bookmark);
  const selected = useSelection((s) => s.ids.has(bookmark.id));
  const { onKeyDown: dragKeyDown, ...dragHandle } = (renaming ? {} : drag.handle) as {
    onKeyDown?: (e: React.KeyboardEvent) => void;
  };
  const linkProps = {
    ...dragHandle,
    href: link.href,
    role: link.role,
    tabIndex: link.tabIndex,
    title: renaming
      ? undefined
      : `${title}\n${url}${link.blocked ? '\nBlocked: Arca never opens this kind of link' : ''}`,
    'data-bookmark-id': bookmark.id,
    'data-blocked': link.blocked || undefined,
    // dnd-kit handles dragging; the browser's native link drag would cancel it.
    draggable: false,
    onClick: (e: React.MouseEvent) => {
      if (renaming) e.preventDefault();
      else link.onActivate?.(e);
    },
    onContextMenu: handlers.onContextMenu,
    onKeyDown: (e: React.KeyboardEvent<HTMLElement>) => {
      dragKeyDown?.(e);
      if (e.defaultPrevented) return;
      // Mid-drag, keys belong to the drag: also stop Enter following the link.
      if (isDragActive()) {
        if (e.key === 'Enter') e.preventDefault();
        return;
      }
      if (
        e.key === 'Enter' &&
        !renaming &&
        link.onActivate &&
        e.target === e.currentTarget
      ) {
        link.onActivate?.(e);
        return;
      }
      handlers.onKeyDown(e);
    },
  };
  const label = renaming ? (
    <InlineRename id={bookmark.id} initial={bookmark.title} className="h-6 text-[13px]" />
  ) : null;

  if (density === 'compact') {
    return (
      <div
        className="group relative rounded-xl data-[selected]:ring-2 data-[selected]:ring-accent"
        ref={drag.setNodeRef}
        style={drag.style}
        data-select-id={bookmark.id}
        data-selected={selected || undefined}
      >
        <SelectBox
          id={bookmark.id}
          title={title}
          className="absolute top-1/2 left-2 -translate-y-1/2"
        />
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
    <CoverTile
      {...{
        setNodeRef: drag.setNodeRef,
        dragStyle: drag.style,
        url,
        host,
        title,
        linkProps,
        label,
        folderLabel,
        bookmark,
        blocked: link.blocked,
      }}
    />
  );
});

interface CoverTileProps {
  setNodeRef: ReturnType<typeof useDragItem>['setNodeRef'];
  dragStyle: React.CSSProperties;
  url: string;
  host: string;
  title: string;
  linkProps: React.AnchorHTMLAttributes<HTMLAnchorElement> & Record<string, unknown>;
  label: React.ReactNode;
  folderLabel?: string;
  bookmark: BNode;
  blocked: boolean;
}

/** Comfortable grid tile: brand-coloured cover with the site, then title and folder. */
function CoverTile({
  setNodeRef,
  dragStyle,
  url,
  host,
  title,
  linkProps,
  label,
  folderLabel,
  bookmark,
  blocked,
}: CoverTileProps) {
  const cover = useCover(url, title);
  const tags = useTags(bookmark.id);
  const selected = useSelection((s) => s.ids.has(bookmark.id));
  return (
    <div
      className="group relative rounded-(--radius-tile) data-[selected]:ring-2 data-[selected]:ring-accent"
      ref={setNodeRef}
      style={dragStyle}
      data-select-id={bookmark.id}
      data-selected={selected || undefined}
    >
      <SelectBox id={bookmark.id} title={title} className="absolute top-2 left-2" />
      <a
        {...linkProps}
        style={{ '--glow': cover.glow } as React.CSSProperties}
        className="border-line bg-surface flex h-[144px] flex-col overflow-hidden rounded-(--radius-tile) border shadow-(--shadow-tile) backdrop-blur-md transition-[transform,box-shadow,border-color] duration-200 ease-(--ease-out-soft) hover:-translate-y-0.5 hover:border-white/15 hover:shadow-[0_16px_36px_-14px_var(--glow)] focus-visible:-translate-y-0.5"
      >
        <span
          aria-hidden="true"
          className="relative flex h-[64px] shrink-0 items-center gap-2.5 px-3"
          style={{
            background: blocked
              ? 'linear-gradient(135deg, hsl(0 60% 36%), hsl(350 60% 24%))'
              : cover.background,
          }}
        >
          <span className="pointer-events-none absolute inset-0 bg-[radial-gradient(120%_90%_at_0%_0%,rgb(255_255_255/0.2),transparent_60%)]" />
          <span className="relative grid size-9 shrink-0 place-items-center rounded-[10px] bg-white/95 shadow-sm transition-transform duration-200 ease-(--ease-out-soft) group-hover:scale-105">
            <Favicon url={url} title={title} size={20} />
          </span>
          <span className="relative min-w-0 truncate text-[13px] font-semibold tracking-tight text-white [text-shadow:0_1px_2px_rgb(0_0_0/0.25)]">
            {blocked ? 'Blocked link' : mainDomain(url) || title}
          </span>
        </span>
        <span className="flex min-w-0 flex-1 flex-col justify-center gap-1 px-3">
          {label ?? (
            <span className="line-clamp-2 text-[13px] leading-snug font-medium break-words">
              {title}
            </span>
          )}
          <span
            className={`flex min-w-0 items-center gap-1 text-[11px] ${blocked ? 'text-danger' : 'text-ink-faint'}`}
            title={folderLabel}
          >
            {folderLabel && !blocked && (
              <FolderIcon width={11} height={11} className="shrink-0" />
            )}
            <span className="truncate">
              {blocked
                ? "Arca won't open this"
                : folderLabel?.split(' / ').at(-1) || host}
            </span>
          </span>
          <TagChips tags={tags} max={2} className="flex-nowrap overflow-hidden" />
        </span>
      </a>
      <MoreButton
        id={bookmark.id}
        title={title}
        onCover
        className="absolute top-2 right-2"
      />
    </div>
  );
}
