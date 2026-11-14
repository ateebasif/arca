import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { normalizeInputUrl } from '@/src/features/editing/url';
import { highlightParts, search, type SearchResult } from '@/src/features/search/search';
import { defaultDisposition, openSafely } from '@/src/features/open';
import type { OpenDisposition } from '@/src/lib/tabs';
import { useBookmarks } from '@/src/store/useBookmarks';
import { FolderIcon, SearchIcon } from '../icons';
import { Favicon } from '../main/Favicon';

interface QuickSearchProps {
  limit: number;
  /** Scroll the results (about ten rows tall) and show how many matched. */
  scroll?: boolean;
  placeholder?: string;
  /** Called after a result opens (the popup closes itself). */
  onOpened?(): void;
  /** Called for folder results; omit to hide folders. */
  onOpenFolder?(id: string): void;
  /** Reports whether a query is typed (the popup hides its sections then). */
  onSearchingChange?(searching: boolean): void;
  className?: string;
}

/**
 * Compact search used by the popup and the minimal New Tab page.
 * Enter opens the highlighted result (⌘Enter in a new tab). With no match,
 * Enter opens what was typed if it looks like a URL.
 */
export function QuickSearch({
  limit,
  scroll = false,
  placeholder = 'Search bookmarks',
  onOpened,
  onOpenFolder,
  onSearchingChange,
  className = '',
}: QuickSearchProps) {
  const state = useBookmarks();
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const listId = useId();

  const results = useMemo(
    () =>
      search(state, query, { limit: limit * 2 })
        .filter((r) => onOpenFolder || r.entry.kind === 'bookmark')
        .slice(0, limit),
    [state, query, limit, onOpenFolder],
  );
  const typedUrl = results.length === 0 ? normalizeInputUrl(query) : null;
  const listRef = useRef<HTMLUListElement>(null);
  useEffect(() => {
    listRef.current
      ?.querySelector(`#${CSS.escape(`${listId}-${active}`)}`)
      ?.scrollIntoView({ block: 'nearest' });
  }, [active, listId]);

  const open = async (result: SearchResult, disposition: OpenDisposition) => {
    const { node } = result.entry;
    if (!node.url) {
      onOpenFolder?.(node.id);
      return;
    }
    if (await openSafely(node.url, disposition)) onOpened?.();
  };

  const onKeyDown = async (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive((i) => Math.min(i + 1, results.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const disposition: OpenDisposition =
        e.metaKey || e.ctrlKey ? 'background' : defaultDisposition();
      const result = results[active];
      if (result) await open(result, disposition);
      else if (typedUrl) {
        if (await openSafely(typedUrl, disposition)) onOpened?.();
      }
    } else if (e.key === 'Escape' && query) {
      e.preventDefault();
      setQuery('');
      onSearchingChange?.(false);
    }
  };

  return (
    <div className={className}>
      <div className="border-line bg-surface-strong focus-within:border-accent/40 flex h-11 items-center gap-2.5 rounded-xl border px-3.5 shadow-(--shadow-tile)">
        <SearchIcon className="text-ink-faint shrink-0" />
        <input
          autoFocus
          type="text"
          role="combobox"
          aria-label={placeholder}
          aria-expanded={results.length > 0}
          aria-controls={listId}
          aria-activedescendant={results[active] ? `${listId}-${active}` : undefined}
          placeholder={placeholder}
          spellCheck={false}
          autoComplete="off"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setActive(0);
            onSearchingChange?.(e.target.value.trim().length > 0);
          }}
          onKeyDown={(e) => void onKeyDown(e)}
          className="placeholder:text-ink-faint min-w-0 flex-1 bg-transparent text-sm outline-none"
        />
      </div>
      {query.trim() && scroll && results.length > 0 && (
        <p className="text-ink-faint mt-2 px-1 text-[11px]" aria-live="polite">
          {results.length >= limit
            ? `${limit.toLocaleString()}+ results`
            : `${results.length.toLocaleString()} ${results.length === 1 ? 'result' : 'results'}`}
        </p>
      )}
      {query.trim() && (
        <ul
          ref={listRef}
          id={listId}
          role="listbox"
          aria-label="Results"
          className={`flex flex-col gap-px ${
            scroll
              ? 'mt-1 max-h-[452px] overflow-y-auto overscroll-contain pr-0.5'
              : 'mt-2'
          }`}
        >
          {results.map((result, index) => {
            const { entry } = result;
            return (
              <li
                key={entry.node.id}
                id={`${listId}-${index}`}
                role="option"
                aria-selected={index === active}
                onMouseMove={() => setActive(index)}
                onClick={(e) =>
                  void open(
                    result,
                    e.metaKey || e.ctrlKey ? 'background' : defaultDisposition(),
                  )
                }
                className={`flex h-11 shrink-0 items-center gap-3 rounded-lg px-3 ${
                  index === active ? 'bg-surface-strong shadow-(--shadow-tile)' : ''
                }`}
              >
                {entry.node.url ? (
                  <Favicon url={entry.node.url} title={entry.title} size={16} />
                ) : (
                  <FolderIcon className="text-accent shrink-0" />
                )}
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13px]">
                    {highlightParts(entry.title, query).map((p, i) =>
                      p.match ? (
                        <mark
                          key={i}
                          className="text-accent bg-transparent font-semibold"
                        >
                          {p.text}
                        </mark>
                      ) : (
                        <span key={i}>{p.text}</span>
                      ),
                    )}
                  </span>
                  <span className="text-ink-faint block truncate text-[11px]">
                    {entry.hostLc || entry.path}
                  </span>
                </span>
              </li>
            );
          })}
          {results.length === 0 && (
            <li className="text-ink-muted px-3 py-3 text-[13px]">
              {typedUrl ? (
                <>
                  Press Enter to open <span className="text-ink">{typedUrl}</span>
                </>
              ) : (
                'No matching bookmarks'
              )}
            </li>
          )}
        </ul>
      )}
    </div>
  );
}
