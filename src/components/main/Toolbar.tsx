import { SORT_LABELS } from '@/src/features/sort';
import { useUi, type SortMode } from '@/src/store/ui';
import { IconButton } from '../IconButton';
import { FolderIcon, LinkIcon } from '../icons';
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
      <div
        role="radiogroup"
        aria-label="Layout"
        className="bg-hover flex gap-0.5 rounded-lg p-0.5"
      >
        <ViewButton
          label="Large tiles"
          active={view === 'grid' && density === 'comfortable'}
          onClick={() => {
            setView('grid');
            setDensity('comfortable');
          }}
        >
          <GridIcon />
        </ViewButton>
        <ViewButton
          label="Small tiles"
          active={view === 'grid' && density === 'compact'}
          onClick={() => {
            setView('grid');
            setDensity('compact');
          }}
        >
          <DensityIcon />
        </ViewButton>
        <ViewButton label="List" active={view === 'list'} onClick={() => setView('list')}>
          <ListIcon />
        </ViewButton>
      </div>
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
      role="radio"
      aria-label={label}
      aria-checked={active}
      title={label}
      onClick={onClick}
      className={`grid h-7 w-8 place-items-center rounded-md transition-colors duration-150 focus-visible:outline-offset-[-2px] ${
        active
          ? 'bg-surface-strong text-accent shadow-(--shadow-tile)'
          : 'text-ink-muted hover:bg-surface/60 hover:text-ink'
      }`}
    >
      {children}
    </button>
  );
}

/** Folders / All links switch. */
export function ScopeSwitch() {
  const scope = useUi((s) => s.scope);
  const setScope = useUi((s) => s.setScope);
  return (
    <div
      role="radiogroup"
      aria-label="Show"
      className="bg-hover flex rounded-lg p-0.5 text-[12px]"
    >
      {(
        [
          ['folders', 'Folders', FolderIcon],
          ['all', 'All links', LinkIcon],
        ] as const
      ).map(([value, label, Icon]) => (
        <button
          key={value}
          type="button"
          role="radio"
          aria-checked={scope === value}
          title={
            value === 'all'
              ? 'Every link in this folder and its subfolders'
              : "This folder's items"
          }
          onClick={() => setScope(value)}
          className={`flex h-7 items-center gap-1.5 rounded-md px-2.5 transition-colors duration-150 ${
            scope === value
              ? 'bg-surface-strong text-ink shadow-(--shadow-tile)'
              : 'text-ink-muted hover:text-ink'
          }`}
        >
          <Icon width={13} height={13} />
          {label}
        </button>
      ))}
    </div>
  );
}
