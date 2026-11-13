import { memo } from 'react';
import { useDragItem, useFolderDrop } from '@/src/features/dnd/hooks';
import { itemHandlers } from '@/src/features/editing/itemHandlers';
import type { BNode } from '@/src/store/bookmarkStore';
import { useOverlays } from '@/src/store/overlays';
import { FolderIcon } from '../icons';
import { InlineRename } from '../overlays/InlineRename';
import { Favicon } from './Favicon';
import { MoreButton } from './MoreButton';

interface FolderCardProps {
  folder: BNode;
  /** Bookmarks inside, at any depth. */
  count: number;
  /** Direct subfolders. */
  subfolders: number;
  /** First few bookmarks inside, shown as a favicon stack. */
  preview: BNode[];
  onOpen(id: string): void;
}

const plural = (n: number, word: string) =>
  `${n.toLocaleString()} ${word}${n === 1 ? '' : 's'}`;

/** Folder in the grid: same shape as a bookmark tile, with an accent cover. */
export const FolderCard = memo(function FolderCard({
  folder,
  count,
  subfolders,
  preview,
  onOpen,
}: FolderCardProps) {
  const renaming = useOverlays((s) => s.renamingId === folder.id);
  const title = folder.title || 'Untitled';
  const drag = useDragItem(folder);
  const drop = useFolderDrop(folder.id, 'card');
  const { onKeyDown: dragKeyDown, ...dragHandle } = (renaming ? {} : drag.handle) as {
    onKeyDown?: (e: React.KeyboardEvent) => void;
  };
  const handlers = itemHandlers(folder);
  const meta = [plural(count, 'link'), subfolders > 0 && plural(subfolders, 'folder')]
    .filter(Boolean)
    .join(' · ');

  const body = (
    <>
      <span
        ref={drop.setDropRef}
        aria-hidden="true"
        data-drop-folder={folder.id}
        className={`relative flex h-[64px] shrink-0 items-center justify-between gap-2 px-3 transition-shadow duration-150 ${
          drop.blocked
            ? 'shadow-[inset_0_0_0_2px_var(--color-danger)]'
            : drop.isOver
              ? 'shadow-[inset_0_0_0_2px_var(--color-accent)]'
              : ''
        }`}
        style={{
          background:
            'linear-gradient(135deg, color-mix(in oklab, var(--color-accent) 34%, transparent), color-mix(in oklab, var(--color-accent) 10%, transparent))',
        }}
      >
        <span className="bg-accent-strong grid size-9 shrink-0 place-items-center rounded-[10px] text-white shadow-sm transition-transform duration-200 ease-(--ease-out-soft) group-hover:scale-105">
          <FolderIcon width={18} height={18} />
        </span>
        {drop.isOver && (
          <span className="bg-surface-strong text-ink animate-pop absolute inset-x-2 bottom-1.5 rounded-md px-2 py-0.5 text-center text-[11px] font-medium">
            {drop.blocked ? "Can't move here" : 'Move here'}
          </span>
        )}
        {preview.length > 0 && (
          <span className="mr-7 flex shrink-0 -space-x-1.5">
            {preview.map((b) =>
              b.url ? (
                <span
                  key={b.id}
                  className="ring-surface-strong rounded-md bg-white p-0.5 ring-2"
                >
                  <Favicon url={b.url} title={b.title} size={16} />
                </span>
              ) : null,
            )}
          </span>
        )}
      </span>
      <span className="flex min-w-0 flex-1 flex-col justify-center gap-1 px-3 text-left">
        {renaming ? (
          <InlineRename
            id={folder.id}
            initial={folder.title}
            className="h-6 text-[13px]"
          />
        ) : (
          <span className="line-clamp-2 text-[13px] leading-snug font-semibold break-words">
            {title}
          </span>
        )}
        <span className="text-ink-faint truncate text-[11px]">{meta}</span>
      </span>
    </>
  );
  const className =
    'border-line bg-surface flex h-[144px] w-full flex-col overflow-hidden rounded-(--radius-tile) border shadow-(--shadow-tile) backdrop-blur-md transition-[transform,box-shadow,border-color] duration-200 ease-(--ease-out-soft) hover:-translate-y-0.5 hover:border-accent/35 hover:shadow-[0_16px_36px_-16px_var(--color-accent)] focus-visible:-translate-y-0.5';

  return (
    <div className="group relative" ref={drag.setNodeRef} style={drag.style}>
      {renaming ? (
        <div className={className}>{body}</div>
      ) : (
        <button
          type="button"
          onClick={() => onOpen(folder.id)}
          data-folder-card={folder.id}
          aria-label={`${title}, ${meta}`}
          className={className}
          {...dragHandle}
          onContextMenu={handlers.onContextMenu}
          onKeyDown={(e) => {
            dragKeyDown?.(e);
            if (!e.defaultPrevented) handlers.onKeyDown(e);
          }}
        >
          {body}
        </button>
      )}
      <MoreButton
        id={folder.id}
        title={title}
        onCover
        className="absolute top-2 right-2"
      />
    </div>
  );
});
