import { openMenuAt } from '@/src/features/editing/itemHandlers';
import { MoreIcon } from '../icons';

/** ⋯ button shown on hover/focus that opens the item menu. */
export function MoreButton({
  id,
  title,
  className = '',
}: {
  id: string;
  title: string;
  className?: string;
}) {
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
      className={`text-ink-muted hover:text-ink hover:bg-hover bg-surface-strong grid size-7 place-items-center rounded-lg opacity-0 transition-opacity duration-150 group-hover:opacity-100 group-focus-within:opacity-100 focus-visible:opacity-100 ${className}`}
    >
      <MoreIcon />
    </button>
  );
}
