import { pageOrder, useSelection } from '@/src/store/selection';

/**
 * Round checkbox shown on hover (and on every item while selecting).
 * Click to select; ⇧-click selects a range.
 */
export function SelectBox({
  id,
  title,
  className = '',
}: {
  id: string;
  title: string;
  className?: string;
}) {
  const selected = useSelection((s) => s.ids.has(id));
  const selecting = useSelection((s) => s.ids.size > 0);
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={selected}
      aria-label={`Select ${title}`}
      data-select-box
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        const s = useSelection.getState();
        if (e.shiftKey && s.anchor) s.extendTo(id, pageOrder());
        else s.toggle(id);
      }}
      className={`z-10 grid size-5 place-items-center rounded-full border transition-opacity duration-150 ${
        selected
          ? 'bg-accent-strong border-accent-strong text-white opacity-100'
          : `border-white/50 bg-black/35 text-transparent backdrop-blur-sm ${selecting ? 'opacity-100' : 'opacity-0 group-hover:opacity-100 focus-visible:opacity-100'}`
      } ${className}`}
    >
      <svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden="true">
        <path
          d="M2 5.2 4.1 7.3 8 3"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </button>
  );
}
