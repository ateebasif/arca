import { memo } from 'react';
import type { BNode } from '@/src/store/bookmarkStore';
import { FolderIcon } from '../icons';
import { Favicon } from './Favicon';

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
  return (
    <button
      type="button"
      onClick={() => onOpen(folder.id)}
      data-folder-card={folder.id}
      className="group border-line bg-surface hover:bg-surface-strong flex h-[72px] w-full items-center gap-3 rounded-(--radius-tile) border px-3.5 text-left shadow-(--shadow-tile) backdrop-blur-md transition-[background-color,transform] duration-150 hover:-translate-y-px"
    >
      <span className="bg-accent-soft text-accent grid size-10 shrink-0 place-items-center rounded-xl">
        <FolderIcon width={20} height={20} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate font-medium">{folder.title || 'Untitled'}</span>
        <span className="text-ink-muted block text-xs">
          {count === 1 ? '1 bookmark' : `${count} bookmarks`}
        </span>
      </span>
      {preview.length > 0 && (
        <span aria-hidden="true" className="flex shrink-0 -space-x-1.5">
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
    </button>
  );
});
