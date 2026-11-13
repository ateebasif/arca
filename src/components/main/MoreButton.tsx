import { openMenuAt } from '@/src/features/editing/itemHandlers';
import { MoreIcon } from '../icons';

/** ⋯ button shown on hover/focus that opens the item menu. */
export function MoreButton({
  id,
  title,
  className = '',
  onCover = false,
}: {
  id: string;
  title: string;
  className?: string;
  /** Sits on a coloured tile cover: translucent dark chip with white icon. */
  onCover?: boolean;
}) {
  const tone = onCover
    ? 'bg-black/25 text-white hover:bg-black/45 backdrop-blur-sm'
    : 'text-ink-muted hover:text-ink hover:bg-hover bg-surface-strong';
  return (
    <button
      type="button"
      aria-label={`More actions for ${title}`}
      aria-haspopup="menu"
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        openMenuAt(id, e.currentTarget);
      }}
      className={`${tone} grid size-7 place-items-center rounded-lg opacity-0 transition-opacity duration-150 group-hover:opacity-100 group-focus-within:opacity-100 focus-visible:opacity-100 ${className}`}
    >
      <MoreIcon />
    </button>
  );
}
