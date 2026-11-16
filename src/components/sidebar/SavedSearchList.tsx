import { useEffect } from 'react';
import { useBrokenLinks } from '@/src/store/brokenLinks';
import { useSavedSearches } from '@/src/store/savedSearches';
import { useUi } from '@/src/store/ui';
import { CloseIcon, SearchIcon } from '../icons';

/** Sidebar "Saved searches": click to run one again, × to forget it. */
export function SavedSearchList() {
  const { list, load, remove } = useSavedSearches();
  const query = useUi((s) => s.query);
  useEffect(() => void load(), [load]);
  if (list.length === 0) return null;
  return (
    <section aria-label="Saved searches" className="px-2 pb-4">
      <p className="text-ink-faint px-2 py-1 text-[11px] font-medium tracking-wide uppercase">
        Saved searches
      </p>
      <ul className="flex flex-col gap-px">
        {list.map((s) => (
          <li key={s.id} className="group flex items-center">
            <button
              type="button"
              aria-pressed={query === s.query}
              title={s.query}
              onClick={() => {
                const ui = useUi.getState();
                ui.setQuery(s.query);
                ui.setFilters(s.filters);
                if (s.filters.broken) void useBrokenLinks.getState().load();
              }}
              className="text-ink-muted hover:bg-hover hover:text-ink flex h-8 min-w-0 flex-1 items-center gap-2 rounded-lg px-2 text-left text-[13px]"
            >
              <SearchIcon width={13} height={13} className="text-ink-faint shrink-0" />
              <span className="truncate">{s.name}</span>
            </button>
            <button
              type="button"
              aria-label={`Forget saved search ${s.name}`}
              onClick={() => void remove(s.id)}
              className="text-ink-faint hover:text-ink grid size-6 shrink-0 place-items-center rounded-md opacity-0 group-hover:opacity-100 focus-visible:opacity-100"
            >
              <CloseIcon width={11} height={11} />
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
