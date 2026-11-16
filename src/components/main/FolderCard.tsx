import { useSelection } from '@/src/store/selection';
import { SelectBox } from '../select/SelectBox';
import { useTags } from '@/src/store/useMeta';
import { TagChips } from '../tags/TagChips';
import { memo } from 'react';
import { isDragActive } from '@/src/features/dnd/ids';
import { useDragItem, useFolderDrop } from '@/src/features/dnd/hooks';
import { itemHandlers } from '@/src/features/editing/itemHandlers';
import type { BNode } from '@/src/store/bookmarkStore';
import { useOverlays } from '@/src/store/overlays';
import { FolderGlyph } from '../FolderGlyph';
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
  /** Small tiles: a compact row like small bookmark tiles. */
  density?: 'comfortable' | 'compact';
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
  density = 'comfortable',
}: FolderCardProps) {
  const selected = useSelection((s) => s.ids.has(folder.id));
  const tags = useTags(folder.id);
  const renaming = useOverlays(
    (s) => s.renamingId === folder.id && s.renameIn === 'main',
  );
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

  if (density === 'compact') {
    return (
      <div
        className="group relative rounded-xl data-[selected]:ring-2 data-[selected]:ring-accent"
        ref={drag.setNodeRef}
        style={drag.style}
        data-select-id={folder.id}
        data-selected={selected || undefined}
      >
        <SelectBox
          id={folder.id}
          title={title}
          variant="row"
          className="absolute top-1/2 left-2.5 -translate-y-1/2"
        />
        <button
          type="button"
          onClick={() => !renaming && onOpen(folder.id)}
          data-folder-card={folder.id}
          aria-label={`${title}, ${meta}`}
          {...(renaming ? {} : dragHandle)}
          onContextMenu={handlers.onContextMenu}
          onKeyDown={(e) => {
            dragKeyDown?.(e);
            if (isDragActive()) {
              if (e.key === 'Enter') e.preventDefault();
              return;
            }
            if (!e.defaultPrevented && !renaming) handlers.onKeyDown(e);
          }}
          className="hover:bg-surface-strong flex h-10 w-full items-center rounded-xl pr-9 pl-9 text-left transition-colors duration-150"
        >
          <span
            ref={drop.setDropRef}
            data-drop-folder={folder.id}
            className={`flex h-full min-w-0 flex-1 items-center gap-2.5 rounded-lg ${
              drop.blocked
                ? 'shadow-[inset_0_0_0_2px_var(--color-danger)]'
                : drop.isOver
                  ? 'shadow-[inset_0_0_0_2px_var(--color-accent)]'
                  : ''
            }`}
          >
            <FolderGlyph id={folder.id} className="text-accent shrink-0" />
            {renaming ? (
              <InlineRename
                id={folder.id}
                initial={folder.title}
                className="h-7 text-[13px]"
              />
            ) : (
              <span className="min-w-0 flex-1 truncate text-[13px] font-medium">
                {title}
              </span>
            )}
            <span className="text-ink-faint shrink-0 text-xs tabular-nums">
              {count.toLocaleString()}
            </span>
          </span>
        </button>
        <MoreButton id={folder.id} title={title} className="absolute top-1.5 right-1.5" />
      </div>
    );
  }

  const body = (
    <>
      <span
        ref={drop.setDropRef}
        aria-hidden="true"
        data-drop-folder={folder.id}
        className={`relative flex h-[64px] shrink-0 items-center justify-between gap-2 pr-11 pl-3 transition-shadow duration-150 ${
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
          <FolderGlyph id={folder.id} size={18} />
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
        <span className="flex min-w-0 items-center gap-2">
          <span className="text-ink-faint shrink-0 truncate text-[11px]">{meta}</span>
          <TagChips tags={tags} max={2} wrap={false} className="overflow-hidden" />
        </span>
      </span>
    </>
  );
  const className =
    'border-line bg-surface flex h-[144px] w-full flex-col overflow-hidden rounded-(--radius-tile) border shadow-(--shadow-tile) backdrop-blur-md transition-[transform,box-shadow,border-color] duration-200 ease-(--ease-out-soft) hover:-translate-y-0.5 hover:border-accent/35 hover:shadow-[0_16px_36px_-16px_var(--color-accent)] focus-visible:-translate-y-0.5';

  return (
    <div
      className="group relative rounded-(--radius-tile) data-[selected]:ring-2 data-[selected]:ring-accent"
      ref={drag.setNodeRef}
      style={drag.style}
      data-select-id={folder.id}
      data-selected={selected || undefined}
    >
      <SelectBox id={folder.id} title={title} className="absolute top-[23px] right-3" />
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
            if (isDragActive()) {
              if (e.key === 'Enter') e.preventDefault();
              return;
            }
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
        className="absolute top-[18px] right-9"
      />
    </div>
  );
});
