import { SORT_LABELS } from '@/src/features/sort';
import { useUi, type SortMode } from '@/src/store/ui';
import { IconButton } from '../IconButton';
import { AddMenu } from './AddMenu';
import { ChevronRight, DensityIcon, GridIcon, ListIcon, SortIcon } from '../icons';

export function Toolbar() {
  const view = useUi((s) => s.view);
  const setView = useUi((s) => s.setView);
  const density = useUi((s) => s.density);
  const setDensity = useUi((s) => s.setDensity);
  const sort = useUi((s) => s.sort);
  const direction = useUi((s) => s.sortDirection);
  const setSort = useUi((s) => s.setSort);

  return (
    <div className="flex shrink-0 items-center gap-1">
      <label className="text-ink-muted hover:bg-hover hover:text-ink relative flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-[13px]">
        <SortIcon />
        <span className="sr-only">Sort by</span>
        <select
          aria-label="Sort by"
          value={sort}
          onChange={(e) => setSort(e.target.value as SortMode, direction)}
          className="cursor-default appearance-none bg-transparent pr-1 outline-none"
        >
          {(Object.keys(SORT_LABELS) as SortMode[]).map((mode) => (
            <option key={mode} value={mode}>
              {SORT_LABELS[mode]}
            </option>
          ))}
        </select>
      </label>
      {sort !== 'manual' && (
        <IconButton
          label={direction === 'asc' ? 'Ascending' : 'Descending'}
          onClick={() => setSort(sort, direction === 'asc' ? 'desc' : 'asc')}
        >
          <ChevronRight
            width={12}
            height={12}
            className={direction === 'asc' ? '-rotate-90' : 'rotate-90'}
          />
        </IconButton>
      )}
      <span className="bg-line mx-1 h-4 w-px" aria-hidden="true" />
      {view === 'grid' && (
        <IconButton
          label={density === 'compact' ? 'Comfortable density' : 'Compact density'}
          pressed={density === 'compact'}
          onClick={() => setDensity(density === 'compact' ? 'comfortable' : 'compact')}
        >
          <DensityIcon />
        </IconButton>
      )}
      <div role="group" aria-label="View" className="bg-hover flex rounded-lg p-0.5">
        <ViewButton
          label="Grid view"
          active={view === 'grid'}
          onClick={() => setView('grid')}
        >
          <GridIcon />
        </ViewButton>
        <ViewButton
          label="List view"
          active={view === 'list'}
          onClick={() => setView('list')}
        >
          <ListIcon />
        </ViewButton>
      </div>
      <span className="bg-line mx-1 h-4 w-px" aria-hidden="true" />
      <AddMenu />
    </div>
  );
}

function ViewButton({
  label,
  active,
  onClick,
  children,
}: {
  label: string;
  active: boolean;
  onClick(): void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={active}
      title={label}
      onClick={onClick}
      className={`grid h-7 w-8 place-items-center rounded-md transition-colors duration-150 ${
        active
          ? 'bg-surface-strong text-ink shadow-(--shadow-tile)'
          : 'text-ink-muted hover:text-ink'
      }`}
    >
      {children}
    </button>
  );
}
