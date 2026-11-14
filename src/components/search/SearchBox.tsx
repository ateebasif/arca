import { useRef, type KeyboardEvent } from 'react';
import { openResult } from '@/src/features/search/actions';
import { resultId, RESULTS_ID, useSearchResults } from '@/src/features/search/useSearch';
import { useHotkeys } from '@/src/lib/hotkeys';
import { useUi } from '@/src/store/ui';
import { useMeaningResults } from '@/src/store/meaningResults';
import { CloseIcon, SearchIcon } from '../icons';

/** Global search field (combobox). ⌘K or / focuses it. */
export function SearchBox() {
  const inputRef = useRef<HTMLInputElement>(null);
  const query = useUi((s) => s.query);
  const setQuery = useUi((s) => s.setQuery);
  const active = useUi((s) => s.activeResult);
  const setActive = useUi((s) => s.setActiveResult);
  const keyword = useSearchResults();
  const meaning = useMeaningResults((s) => s.results);
  // ↑↓ move through keyword results, then the "Related by meaning" ones.
  const results = meaning.length ? [...keyword, ...meaning] : keyword;
  const open = query.trim().length > 0;

  useHotkeys({
    'mod+k': () => {
      inputRef.current?.focus();
      inputRef.current?.select();
    },
    '/': () => inputRef.current?.focus(),
    // Escape anywhere clears an active search (inside the field, onKeyDown handles it).
    escape: () => {
      if (!useUi.getState().query) return false;
      setQuery('');
      inputRef.current?.focus();
      return true;
    },
  });

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      if (query) setQuery('');
      else inputRef.current?.blur();
      return;
    }
    if (!open || results.length === 0) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive(Math.min(active + 1, results.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive(Math.max(active - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const result = results[active];
      if (!result) return;
      const mode = e.altKey ? 'reveal' : e.metaKey || e.ctrlKey ? 'new-tab' : 'open';
      openResult(result, mode);
      if (mode === 'reveal') inputRef.current?.blur();
    }
  };

  return (
    <div className="border-line bg-surface focus-within:bg-surface-strong focus-within:border-accent/40 relative flex h-9 w-full max-w-xl items-center gap-2 rounded-xl border px-3 shadow-(--shadow-tile) backdrop-blur-md transition-colors duration-150">
      <SearchIcon className="text-ink-faint shrink-0" />
      <input
        ref={inputRef}
        type="text"
        role="combobox"
        aria-label="Search bookmarks"
        aria-expanded={open}
        aria-controls={RESULTS_ID}
        aria-autocomplete="list"
        aria-activedescendant={open && results.length > 0 ? resultId(active) : undefined}
        placeholder="Search bookmarks"
        spellCheck={false}
        autoComplete="off"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onKeyDown={onKeyDown}
        className="placeholder:text-ink-faint min-w-0 flex-1 bg-transparent text-[13px] outline-none"
      />
      {query ? (
        <button
          type="button"
          aria-label="Clear search"
          onClick={() => {
            setQuery('');
            inputRef.current?.focus();
          }}
          className="text-ink-faint hover:text-ink grid size-5 place-items-center rounded"
        >
          <CloseIcon width={12} height={12} />
        </button>
      ) : (
        <kbd className="text-ink-faint border-line rounded border px-1.5 text-[11px] font-sans">
          ⌘K
        </kbd>
      )}
    </div>
  );
}
