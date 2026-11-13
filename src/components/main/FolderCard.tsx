import { memo } from 'react';
import { itemHandlers } from '@/src/features/editing/itemHandlers';
import type { BNode } from '@/src/store/bookmarkStore';
import { useOverlays } from '@/src/store/overlays';
import { FolderIcon } from '../icons';
import { InlineRename } from '../overlays/InlineRename';
import { Favicon } from './Favicon';
import { MoreButton } from './MoreButton';

interface FolderCardProps {
  folder: BNode;
  count: number;
  /** First few bookmarks inside, shown as a favicon preview. */
  preview: BNode[];
  onOpen(id: string): void;
}

export const FolderCard = memo(function FolderCard({
  folder,
  count,
  preview,
  onOpen,
}: FolderCardProps) {
  const renaming = useOverlays((s) => s.renamingId === folder.id);
  const title = folder.title || 'Untitled';
  const body = (
    <>
      <span className="bg-accent-soft text-accent grid size-10 shrink-0 place-items-center rounded-xl">
        <FolderIcon width={20} height={20} />
      </span>
      <span className="min-w-0 flex-1">
        {renaming ? (
          <InlineRename
            id={folder.id}
            initial={folder.title}
            className="h-6 text-[13px]"
          />
        ) : (
          <span className="block truncate font-medium">{title}</span>
        )}
        <span className="text-ink-muted block truncate text-xs whitespace-nowrap">
          {count === 1 ? '1 bookmark' : `${count} bookmarks`}
        </span>
      </span>
      {preview.length > 0 && (
        <span
          aria-hidden="true"
          className="flex shrink-0 -space-x-1.5 group-hover:invisible"
        >
          {preview.map((b) =>
            b.url ? (
              <span
                key={b.id}
                className="bg-surface-strong ring-line rounded-md p-0.5 ring-1"
              >
                <Favicon url={b.url} title={b.title} size={16} />
              </span>
            ) : null,
          )}
        </span>
      )}
    </>
  );
  const className =
    'border-line bg-surface hover:bg-surface-strong flex h-[72px] w-full items-center gap-3 rounded-(--radius-tile) border px-3.5 pr-10 text-left shadow-(--shadow-tile) backdrop-blur-md transition-[background-color,transform] duration-150 hover:-translate-y-px';

  return (
    <div className="group relative">
      {renaming ? (
        <div className={className}>{body}</div>
      ) : (
        <button
          type="button"
          onClick={() => onOpen(folder.id)}
          data-folder-card={folder.id}
          className={className}
          {...itemHandlers(folder)}
        >
          {body}
        </button>
      )}
      <MoreButton
        id={folder.id}
        title={title}
        className="absolute top-1/2 right-2.5 -translate-y-1/2"
      />
    </div>
  );
});
