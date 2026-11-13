import { memo, useEffect, useRef } from 'react';
import { openResult } from '@/src/features/search/actions';
import { highlightParts, type SearchResult } from '@/src/features/search/search';
import {
  RESULT_LIMIT,
  resultId,
  RESULTS_ID,
  useSearchResults,
} from '@/src/features/search/useSearch';
import { useOverlays } from '@/src/store/overlays';
import { useSettings } from '@/src/store/settings';
import { useBookmarks } from '@/src/store/useBookmarks';
import { useUi } from '@/src/store/ui';
import { compactPath } from '@/src/features/tidy/normalize';
import { FolderIcon, SparkleIcon } from '../icons';
import { Favicon } from '../main/Favicon';

/** Results that replace the folder view while a query is active. */
export function SearchResults() {
  const state = useBookmarks();
  const query = useUi((s) => s.query);
  const active = useUi((s) => s.activeResult);
  const setActive = useUi((s) => s.setActiveResult);
  const inFolder = useUi((s) => s.searchInFolder);
  const setInFolder = useUi((s) => s.setSearchInFolder);
  const folderId = useUi((s) => s.currentFolderId);
  const results = useSearchResults();
  const listRef = useRef<HTMLUListElement>(null);
  const folderTitle = state.nodes.get(folderId)?.title || 'this folder';
  const aiEnabled = useSettings((s) => s.aiEnabled);
  const askArca = () => useOverlays.getState().openAsk(query.trim());

  useEffect(() => {
    listRef.current
      ?.querySelector(`#${resultId(active)}`)
      ?.scrollIntoView({ block: 'nearest' });
  }, [active]);

  return (
    <div className="flex flex-col gap-3">
      <div
        className="flex items-center gap-2 text-xs"
        role="group"
        aria-label="Search filters"
      >
        <Chip pressed={!inFolder} onClick={() => setInFolder(false)}>
          All bookmarks
        </Chip>
        <Chip pressed={inFolder} onClick={() => setInFolder(true)}>
          In “{folderTitle}”
        </Chip>
        {aiEnabled && (
          <button
            type="button"
            onClick={askArca}
            className="text-accent hover:bg-hover ml-2 flex items-center gap-1 rounded-full px-2.5 py-1"
          >
            <SparkleIcon /> Ask Arca
          </button>
        )}
        <span className="text-ink-faint ml-auto" aria-live="polite">
          {results.length === RESULT_LIMIT
            ? `Top ${RESULT_LIMIT} results`
            : `${results.length} ${results.length === 1 ? 'result' : 'results'}`}
        </span>
      </div>

      {results.length === 0 ? (
        <div className="text-ink-muted flex flex-col items-center gap-1 py-20 text-center">
          <p className="text-ink text-[15px] font-medium">
            No matches for “{query.trim()}”
          </p>
          <p className="text-sm">
            {inFolder ? 'Try searching all bookmarks.' : 'Try fewer or different words.'}
          </p>
          {aiEnabled && (
            <button
              type="button"
              onClick={askArca}
              className="bg-accent-strong mt-4 flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-[13px] text-white hover:opacity-90"
            >
              <SparkleIcon /> Ask Arca about “{query.trim()}”
            </button>
          )}
        </div>
      ) : (
        <ul
          ref={listRef}
          id={RESULTS_ID}
          role="listbox"
          aria-label="Search results"
          className="animate-fade flex flex-col gap-px"
        >
          {results.map((result, index) => (
            <ResultRow
              key={result.entry.node.id}
              result={result}
              index={index}
              query={query}
              active={index === active}
              onHover={setActive}
            />
          ))}
        </ul>
      )}
      <p className="text-ink-faint text-center text-[11px]">
        ↑↓ to move · Enter to open · ⌘Enter new tab · ⌥Enter show in folder · Esc to clear
      </p>
    </div>
  );
}

interface ResultRowProps {
  result: SearchResult;
  index: number;
  query: string;
  active: boolean;
  onHover(index: number): void;
}

const ResultRow = memo(function ResultRow({
  result,
  index,
  query,
  active,
  onHover,
}: ResultRowProps) {
  const { entry } = result;
  const url = entry.node.url ?? '';
  return (
    <li
      id={resultId(index)}
      role="option"
      aria-selected={active}
      data-result-id={entry.node.id}
      onMouseMove={() => !active && onHover(index)}
      onClick={(e) =>
        openResult(
          result,
          e.altKey ? 'reveal' : e.metaKey || e.ctrlKey ? 'new-tab' : 'open',
        )
      }
      className={`flex h-12 items-center gap-3 rounded-xl px-3 ${
        active ? 'bg-surface-strong shadow-(--shadow-tile)' : ''
      }`}
    >
      {entry.kind === 'folder' ? (
        <span className="bg-accent-soft text-accent grid size-6 shrink-0 place-items-center rounded-md">
          <FolderIcon width={14} height={14} />
        </span>
      ) : (
        <span className="grid size-6 shrink-0 place-items-center">
          <Favicon url={url} title={entry.title} size={20} />
        </span>
      )}
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[13px]">
          {highlightParts(entry.title, query).map((part, i) =>
            part.match ? (
              <mark key={i} className="text-accent bg-transparent font-semibold">
                {part.text}
              </mark>
            ) : (
              <span key={i}>{part.text}</span>
            ),
          )}
        </span>
        <span className="text-ink-faint block truncate text-[11px]" title={entry.path}>
          {entry.kind === 'folder'
            ? compactPath(entry.path)
            : `${entry.hostLc}${entry.path ? ` · ${compactPath(entry.path)}` : ''}`}
        </span>
      </span>
      {result.copies.length > 0 && (
        <span
          className="border-line text-ink-muted shrink-0 rounded-full border px-2 py-0.5 text-[11px]"
          title={[entry, ...result.copies].map((c) => c.path).join('\n')}
        >
          in {result.copies.length + 1} folders
        </span>
      )}
    </li>
  );
});

function Chip({
  pressed,
  onClick,
  children,
}: {
  pressed: boolean;
  onClick(): void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      onClick={onClick}
      className={`max-w-56 truncate rounded-full border px-2.5 py-1 transition-colors duration-150 ${
        pressed
          ? 'border-accent/30 bg-accent-soft text-accent'
          : 'border-line text-ink-muted hover:text-ink'
      }`}
    >
      {children}
    </button>
  );
}
