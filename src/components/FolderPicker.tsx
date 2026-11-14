import {
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
} from 'react';
import { createPortal } from 'react-dom';
import { createFolder } from '@/src/features/editing/actions';
import { loadRecentFolders } from '@/src/features/editing/recentFolders';
import { folderList, type FolderEntry } from '@/src/store/selectors';
import { useBookmarks } from '@/src/store/useBookmarks';
import { ChevronRight, FolderIcon, PlusIcon, SearchIcon } from './icons';

interface Props {
  value: string;
  onChange(id: string): void;
  label: string;
  /** Hide this folder and everything inside it (can't move a folder into itself). */
  excludeId?: string;
  /** Open upwards (e.g. in a bar at the bottom of the screen). */
  dropUp?: boolean;
  className?: string;
}

/**
 * Folder chooser: shows the chosen folder with its path; opens a searchable
 * list with recent folders first, then the whole tree. Type to filter,
 * ↑↓ and Enter to pick, Esc to close.
 */
export function FolderPicker({
  value,
  onChange,
  label,
  excludeId,
  dropUp = false,
  className = '',
}: Props) {
  const state = useBookmarks();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const [recent, setRecent] = useState<string[]>([]);
  /** Typing a name for a new folder inside the chosen one. */
  const [creating, setCreating] = useState(false);
  const [busy, setBusy] = useState(false);
  const listId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [pos, setPos] = useState<{
    left: number;
    width: number;
    top?: number;
    bottom?: number;
  }>();

  // The list floats above everything (dialogs scroll and would clip it), next
  // to the button: below it, or above when there isn't room (or dropUp).
  useLayoutEffect(() => {
    if (!open) return;
    const place = () => {
      const r = rootRef.current?.getBoundingClientRect();
      if (!r) return;
      const width = Math.max(r.width, 260);
      const left = Math.max(8, Math.min(r.left, window.innerWidth - width - 8));
      const below = window.innerHeight - r.bottom;
      const up = dropUp || (below < 320 && r.top > below);
      setPos(
        up
          ? { left, width, bottom: window.innerHeight - r.top + 6 }
          : { left, width, top: r.bottom + 6 },
      );
    };
    place();
    window.addEventListener('resize', place);
    return () => window.removeEventListener('resize', place);
  }, [open, dropUp]);

  const all = useMemo(() => folderList(state, excludeId), [state, excludeId]);
  const chosen = all.find((f) => f.id === value) ?? all.find((f) => f.id === '1');

  useEffect(() => {
    if (open) void loadRecentFolders().then(setRecent);
  }, [open]);

  // Focus the search (or new-name) field once the list is placed: it's
  // hidden until then, and hidden inputs can't take focus.
  useEffect(() => {
    if (open && pos) inputRef.current?.focus();
  }, [open, pos, creating]);

  // Close when clicking elsewhere.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (!rootRef.current?.contains(t) && !panelRef.current?.contains(t)) setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);

  const q = query.trim().toLowerCase();
  const rows: Array<FolderEntry & { section?: string; flat?: boolean }> = useMemo(() => {
    if (q) {
      return all
        .filter((f) => f.title.toLowerCase().includes(q))
        .sort((a, b) => {
          // Names starting with the query first.
          const sa = a.title.toLowerCase().startsWith(q) ? 0 : 1;
          const sb = b.title.toLowerCase().startsWith(q) ? 0 : 1;
          return sa - sb;
        })
        .map((f) => ({ ...f, flat: true }));
    }
    const byId = new Map(all.map((f) => [f.id, f]));
    const recents = recent
      .map((id) => byId.get(id))
      .filter((f): f is FolderEntry => !!f)
      .slice(0, 4)
      .map((f, i) => ({ ...f, flat: true, section: i === 0 ? 'Recent' : undefined }));
    return [
      ...recents,
      ...all.map((f, i) => ({ ...f, section: i === 0 ? 'All folders' : undefined })),
    ];
  }, [all, recent, q]);

  useEffect(() => {
    listRef.current
      ?.querySelector(`[data-index="${active}"]`)
      ?.scrollIntoView({ block: 'nearest' });
  }, [active]);

  const pick = (id: string) => {
    onChange(id);
    setOpen(false);
    setQuery('');
    setCreating(false);
  };

  // New folders go inside the currently chosen folder.
  const parent = chosen ?? all[0];
  const name = query.trim();
  const offerCreate = !creating && !!q && !all.some((f) => f.title.toLowerCase() === q);
  const total = rows.length + (offerCreate ? 1 : 0);
  const create = async (title: string) => {
    if (!parent || !title.trim() || busy) return;
    setBusy(true);
    const id = await createFolder(parent.id, title);
    setBusy(false);
    if (id) pick(id);
  };

  const onKeyDown = (e: KeyboardEvent) => {
    if (creating) {
      if (e.key === 'Enter') {
        e.preventDefault();
        void create(name);
      } else if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        setCreating(false);
        setQuery('');
      }
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive((i) => Math.min(i + 1, total - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const row = rows[active];
      if (row) pick(row.id);
      else if (offerCreate && active === rows.length) void create(name);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      setOpen(false);
    }
  };

  return (
    <div ref={rootRef} className={`relative min-w-0 ${className}`}>
      <button
        type="button"
        aria-label={label}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => {
          setOpen((o) => !o);
          setActive(0);
        }}
        className="border-line bg-surface hover:border-accent/40 flex h-8 w-full min-w-0 items-center gap-2 rounded-lg border px-2.5 text-left text-[13px] transition-colors"
      >
        <FolderIcon className="text-accent shrink-0" width={14} height={14} />
        <span className="min-w-0 flex-1 truncate">
          {chosen?.title ?? 'Choose a folder'}
          {chosen?.path && (
            <span className="text-ink-faint text-[11px]">
              {' '}
              · {chosen.path.split(' / ').at(-1)}
            </span>
          )}
        </span>
        <ChevronRight
          width={12}
          height={12}
          className={`text-ink-faint shrink-0 transition-transform ${open ? '-rotate-90' : 'rotate-90'}`}
        />
      </button>
      {open &&
        createPortal(
          <div
            ref={panelRef}
            style={{ ...pos, visibility: pos ? 'visible' : 'hidden' }}
            className="animate-pop border-line bg-surface-strong fixed z-[60] flex flex-col overflow-hidden rounded-xl border shadow-(--shadow-pop) backdrop-blur-xl"
          >
            <div className="border-line flex items-center gap-2 border-b px-2.5">
              {creating ? (
                <PlusIcon className="text-accent shrink-0" width={14} height={14} />
              ) : (
                <SearchIcon className="text-ink-faint shrink-0" width={14} height={14} />
              )}
              <input
                key={creating ? 'create' : 'find'}
                ref={inputRef}
                role="combobox"
                aria-label={creating ? 'New folder name' : 'Find a folder'}
                aria-controls={listId}
                aria-expanded
                aria-activedescendant={rows[active] ? `${listId}-${active}` : undefined}
                placeholder={
                  creating ? `New folder in “${parent?.title ?? ''}”…` : 'Find a folder…'
                }
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setActive(0);
                }}
                onKeyDown={onKeyDown}
                className="placeholder:text-ink-faint h-9 min-w-0 flex-1 bg-transparent text-[13px] outline-none"
              />
            </div>
            {creating ? (
              <p className="text-ink-faint px-3 py-2.5 text-xs">
                {busy ? 'Creating…' : 'Enter to create · Esc to go back'}
              </p>
            ) : (
              <>
                <ul
                  ref={listRef}
                  id={listId}
                  role="listbox"
                  aria-label="Folders"
                  className="max-h-64 overflow-y-auto overscroll-contain p-1"
                >
                  {rows.length === 0 && !offerCreate && (
                    <li className="text-ink-muted px-2.5 py-2 text-xs">
                      No folder matches “{query}”
                    </li>
                  )}
                  {rows.map((row, index) => (
                    <li
                      key={`${row.section ?? ''}${row.flat ? 'f' : 't'}${row.id}`}
                      role="presentation"
                    >
                      {row.section && (
                        <p className="text-ink-faint px-2.5 pt-1.5 pb-1 text-[10px] font-medium tracking-wide uppercase">
                          {row.section}
                        </p>
                      )}
                      <div
                        id={`${listId}-${index}`}
                        data-index={index}
                        role="option"
                        aria-selected={index === active}
                        onMouseMove={() => setActive(index)}
                        onClick={() => pick(row.id)}
                        className={`flex h-8 cursor-default items-center gap-2 rounded-lg pr-2.5 text-[13px] ${
                          index === active ? 'bg-hover text-ink' : 'text-ink-muted'
                        }`}
                        style={{ paddingLeft: row.flat ? 10 : 10 + row.depth * 14 }}
                      >
                        <FolderIcon
                          width={14}
                          height={14}
                          className={`shrink-0 ${row.id === value ? 'text-accent' : 'text-ink-faint'}`}
                        />
                        <span className="min-w-0 flex-1 truncate">
                          <span
                            className={row.id === value ? 'text-ink font-medium' : ''}
                          >
                            {row.title}
                          </span>
                          {row.flat && row.path && (
                            <span className="text-ink-faint text-[11px]">
                              {' '}
                              · {row.path}
                            </span>
                          )}
                        </span>
                        {row.id === value && (
                          <span className="text-accent text-xs">✓</span>
                        )}
                      </div>
                    </li>
                  ))}
                  {offerCreate && (
                    <li role="presentation">
                      <div
                        id={`${listId}-${rows.length}`}
                        data-index={rows.length}
                        role="option"
                        aria-selected={active === rows.length}
                        onMouseMove={() => setActive(rows.length)}
                        onClick={() => void create(name)}
                        className={`flex h-8 cursor-default items-center gap-2 rounded-lg px-2.5 text-[13px] ${
                          active === rows.length ? 'bg-hover text-ink' : 'text-accent'
                        }`}
                      >
                        <PlusIcon width={14} height={14} className="shrink-0" />
                        <span className="min-w-0 flex-1 truncate">
                          Create “{name}”
                          <span className="text-ink-faint text-[11px]">
                            {' '}
                            in {parent?.title}
                          </span>
                        </span>
                      </div>
                    </li>
                  )}
                </ul>
                <button
                  type="button"
                  onClick={() => {
                    setCreating(true);
                    setQuery('');
                  }}
                  className="border-line text-ink-muted hover:text-ink hover:bg-hover flex h-9 items-center gap-2 border-t px-3 text-left text-xs"
                >
                  <PlusIcon width={13} height={13} className="text-accent shrink-0" />
                  <span className="min-w-0 flex-1 truncate">
                    New folder in “{parent?.title}”
                  </span>
                </button>
              </>
            )}
          </div>,
          document.body,
        )}
    </div>
  );
}
