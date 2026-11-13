import { useMemo, useState } from 'react';
import {
  findDuplicates,
  findEmptyFolders,
  siteGroups,
  sortedOrder,
  type DuplicateGroup,
  type TidySort,
} from '@/src/features/tidy/analyze';
import { groupBySite, removeAll, sortFolder } from '@/src/features/tidy/apply';
import { compactPath } from '@/src/features/tidy/normalize';
import { displayHost } from '@/src/lib/url';
import { useOverlays } from '@/src/store/overlays';
import { getBookmarkStore, useBookmarks } from '@/src/store/useBookmarks';
import { useUi } from '@/src/store/ui';
import { useAiRun } from '@/src/store/aiRun';
import { AiOrganize } from '../ai/AiOrganize';
import { FolderIcon } from '../icons';
import { Favicon } from '../main/Favicon';
import { Button, Dialog } from '../overlays/Dialog';

type Tab = 'duplicates' | 'empty' | 'sort' | 'group' | 'ai';
const TABS: Array<[Tab, string]> = [
  ['duplicates', 'Duplicates'],
  ['empty', 'Empty folders'],
  ['sort', 'Sort folder'],
  ['group', 'Group by site'],
  ['ai', 'AI organize'],
];

const SHOW_GROUPS = 60;

/**
 * Tidy up: local, private clean-up tools. Every change can be undone with
 * one click (or ⌘Z) afterwards.
 */
export default function TidyPanel() {
  const close = () => useOverlays.getState().setTidyOpen(false);
  const state = useBookmarks();
  const folderId = useUi((s) => s.currentFolderId);
  const folderTitle = state.nodes.get(folderId)?.title || 'this folder';
  // Reopen on the last tab; jump to AI organize while a run is going or waiting.
  const [tab, setTabState] = useState<Tab>(() => {
    if (useAiRun.getState().phase.kind !== 'ready') return 'ai';
    const last = useOverlays.getState().tidyTab;
    return TABS.some(([v]) => v === last) ? (last as Tab) : 'duplicates';
  });
  const setTab = (next: Tab) => {
    setTabState(next);
    useOverlays.getState().setTidyTab(next);
  };
  const [wholeLibrary, setWholeLibrary] = useState(true);
  const [busy, setBusy] = useState<{ done: number; total: number } | null>(null);

  const run = async (
    task: (progress: (d: number, t: number) => void) => Promise<unknown>,
  ) => {
    setBusy({ done: 0, total: 1 });
    try {
      await task((done, total) => setBusy({ done, total }));
    } finally {
      setBusy(null);
    }
  };

  return (
    <Dialog
      wide
      title="Tidy up"
      onClose={close}
      footer={
        <>
          {busy && (
            <div className="mr-auto flex items-center gap-2 text-xs" role="status">
              <div className="bg-hover h-1.5 w-40 overflow-hidden rounded-full">
                <div
                  className="bg-accent-strong h-full transition-[width] duration-150"
                  style={{
                    width: `${Math.round((busy.done / Math.max(1, busy.total)) * 100)}%`,
                  }}
                />
              </div>
              <span className="text-ink-muted tabular-nums">
                {busy.done} / {busy.total}
              </span>
            </div>
          )}
          <Button onClick={close}>Done</Button>
        </>
      }
    >
      <p className="text-ink-muted mb-3 text-xs">
        Runs on this device only. Nothing leaves your browser, and every change can be
        undone.
      </p>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div
          role="tablist"
          aria-label="Tidy tools"
          className="bg-hover flex rounded-lg p-0.5 text-[12px]"
        >
          {TABS.map(([value, label]) => (
            <button
              key={value}
              type="button"
              role="tab"
              aria-selected={tab === value}
              onClick={() => setTab(value)}
              className={`h-7 rounded-md px-2.5 transition-colors duration-150 ${
                tab === value
                  ? 'bg-surface-strong text-ink shadow-(--shadow-tile)'
                  : 'text-ink-muted hover:text-ink'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        {(tab === 'duplicates' || tab === 'empty') && (
          <label className="text-ink-muted flex items-center gap-2 text-xs">
            Look in
            <select
              className="border-line bg-surface h-7 rounded-md border px-2 text-xs"
              value={wholeLibrary ? 'all' : 'folder'}
              onChange={(e) => setWholeLibrary(e.target.value === 'all')}
            >
              <option value="all">Whole library</option>
              <option value="folder">“{folderTitle}”</option>
            </select>
          </label>
        )}
      </div>
      <div role="tabpanel" aria-label={TABS.find(([v]) => v === tab)?.[1]}>
        {tab === 'duplicates' && (
          <Duplicates
            within={wholeLibrary ? undefined : folderId}
            busy={!!busy}
            run={run}
          />
        )}
        {tab === 'empty' && (
          <EmptyFolders
            within={wholeLibrary ? undefined : folderId}
            busy={!!busy}
            run={run}
          />
        )}
        {tab === 'sort' && <SortFolder folderId={folderId} busy={!!busy} run={run} />}
        {tab === 'group' && <GroupBySite folderId={folderId} busy={!!busy} run={run} />}
        {tab === 'ai' && <AiOrganize />}
      </div>
    </Dialog>
  );
}

interface ToolProps {
  busy: boolean;
  run(
    task: (progress: (d: number, t: number) => void) => Promise<unknown>,
  ): Promise<void>;
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="text-ink-muted py-10 text-center text-[13px]">{children}</p>;
}

function Duplicates({ within, busy, run }: ToolProps & { within?: string }) {
  const state = useBookmarks();
  const groups = useMemo(() => findDuplicates(state, within), [state, within]);
  // Which copy to keep per group (defaults to the suggested one).
  const [keep, setKeep] = useState<Record<string, string>>({});
  const [confirming, setConfirming] = useState(false);
  const [showAll, setShowAll] = useState(false);
  // A remembered choice only counts if that copy is still in the group (it can
  // drop out when "Look in" changes or it's deleted elsewhere).
  const keepFor = (g: DuplicateGroup) => {
    const chosen = keep[g.key];
    return chosen && g.items.some((n) => n.id === chosen) ? chosen : g.items[0]?.id;
  };
  const extra = groups.reduce((n, g) => n + g.items.length - 1, 0);

  if (groups.length === 0) return <Empty>No duplicates found. Nice and tidy.</Empty>;

  const removeIds = () =>
    groups.flatMap((g) => g.items.filter((n) => n.id !== keepFor(g)).map((n) => n.id));

  return (
    <div>
      <div className="mb-3 flex items-center justify-between gap-3">
        <p className="text-[13px]">
          <strong>{extra.toLocaleString()}</strong> extra{' '}
          {extra === 1 ? 'copy' : 'copies'} of{' '}
          <strong>{groups.length.toLocaleString()}</strong>{' '}
          {groups.length === 1 ? 'page' : 'pages'}.
          <span className="text-ink-muted"> One copy of each is kept.</span>
        </p>
        <Button
          variant={confirming ? 'danger' : 'primary'}
          disabled={busy}
          onClick={() => {
            if (!confirming) return setConfirming(true);
            setConfirming(false);
            void run((progress) =>
              removeAll(
                removeIds(),
                `Removed ${extra} duplicate ${extra === 1 ? 'copy' : 'copies'}`,
                progress,
              ),
            );
          }}
        >
          {confirming ? `Confirm: remove ${extra}` : `Remove ${extra} duplicates`}
        </Button>
      </div>
      <ul className="flex flex-col gap-2">
        {(showAll ? groups : groups.slice(0, SHOW_GROUPS)).map((g) => {
          const first = g.items[0];
          if (!first) return null;
          return (
            <li
              key={g.key}
              className="border-line bg-surface rounded-xl border p-3"
              data-dup-group
            >
              <div className="mb-1.5 flex items-center gap-2">
                <Favicon url={first.url ?? ''} title={first.title} size={16} />
                <span className="min-w-0 flex-1 truncate text-[13px] font-medium">
                  {first.title || displayHost(first.url ?? '')}
                </span>
                <span className="text-ink-faint shrink-0 text-[11px]">
                  {g.items.length} copies
                </span>
              </div>
              <fieldset className="flex flex-col gap-1">
                <legend className="sr-only">Copy to keep</legend>
                {g.items.map((n) => (
                  <label
                    key={n.id}
                    className="text-ink-muted flex items-center gap-2 text-xs"
                  >
                    <input
                      type="radio"
                      name={`keep-${g.key}`}
                      className="accent-accent"
                      checked={keepFor(g) === n.id}
                      onChange={() => setKeep((k) => ({ ...k, [g.key]: n.id }))}
                    />
                    <FolderIcon width={12} height={12} className="shrink-0" />
                    <span className="truncate" title={g.paths.get(n.id)}>
                      {compactPath(g.paths.get(n.id) ?? '', 3)}
                    </span>
                    {keepFor(g) === n.id && (
                      <span className="text-accent shrink-0 text-[11px] font-medium">
                        keep
                      </span>
                    )}
                  </label>
                ))}
              </fieldset>
            </li>
          );
        })}
      </ul>
      {!showAll && groups.length > SHOW_GROUPS && (
        <div className="mt-3 text-center">
          <Button onClick={() => setShowAll(true)}>
            Show all {groups.length.toLocaleString()} pages
          </Button>
        </div>
      )}
    </div>
  );
}

function EmptyFolders({ within, busy, run }: ToolProps & { within?: string }) {
  const state = useBookmarks();
  const folders = useMemo(() => findEmptyFolders(state, within), [state, within]);
  if (folders.length === 0) return <Empty>No empty folders.</Empty>;
  return (
    <div>
      <div className="mb-3 flex items-center justify-between gap-3">
        <p className="text-[13px]">
          <strong>{folders.length}</strong>{' '}
          {folders.length === 1 ? 'folder has' : 'folders have'} no links inside.
        </p>
        <Button
          variant="primary"
          disabled={busy}
          onClick={() =>
            void run((progress) =>
              removeAll(
                folders.map((f) => f.id),
                `Removed ${folders.length} empty ${folders.length === 1 ? 'folder' : 'folders'}`,
                progress,
              ),
            )
          }
        >
          Remove {folders.length} empty {folders.length === 1 ? 'folder' : 'folders'}
        </Button>
      </div>
      <ul className="flex flex-col gap-1">
        {folders.map((f) => (
          <li key={f.id} className="text-ink-muted flex items-center gap-2 text-[13px]">
            <FolderIcon className="text-accent shrink-0" />
            <span className="truncate">{f.title || 'Untitled'}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

const SORTS: Array<[TidySort, string]> = [
  ['title', 'Title A–Z'],
  ['domain', 'Website'],
  ['newest', 'Newest first'],
  ['oldest', 'Oldest first'],
];

function SortFolder({ folderId, busy, run }: ToolProps & { folderId: string }) {
  const state = useBookmarks();
  const [mode, setMode] = useState<TidySort>('title');
  const folder = state.nodes.get(folderId);
  const order = useMemo(
    () => sortedOrder(state, folderId, mode),
    [state, folderId, mode],
  );
  if (!folder?.childIds?.length) return <Empty>This folder is empty.</Empty>;
  return (
    <div>
      <p className="text-ink-muted mb-3 text-[13px]">
        Re-orders “{folder.title || 'Untitled'}” for real, so the browser's bookmark bar
        and manager match. Folders stay first.
      </p>
      <div className="mb-3 flex items-center gap-2">
        <select
          aria-label="Sort by"
          className="border-line bg-surface h-8 rounded-lg border px-2 text-[13px]"
          value={mode}
          onChange={(e) => setMode(e.target.value as TidySort)}
        >
          {SORTS.map(([v, l]) => (
            <option key={v} value={v}>
              {l}
            </option>
          ))}
        </select>
        <Button
          variant="primary"
          disabled={busy}
          onClick={() =>
            void run(() => sortFolder(getBookmarkStore().getSnapshot(), folderId, mode))
          }
        >
          Sort {folder.childIds.length} items
        </Button>
      </div>
      <ol className="text-ink-muted flex flex-col gap-0.5 text-xs">
        {order.slice(0, 10).map((id, i) => (
          <li key={id} className="truncate">
            {i + 1}. {state.nodes.get(id)?.title || 'Untitled'}
          </li>
        ))}
        {order.length > 10 && <li>…and {order.length - 10} more</li>}
      </ol>
    </div>
  );
}

function GroupBySite({ folderId, busy, run }: ToolProps & { folderId: string }) {
  const state = useBookmarks();
  const groups = useMemo(() => siteGroups(state, folderId), [state, folderId]);
  const [skip, setSkip] = useState<Set<string>>(new Set());
  const chosen = groups.filter((g) => !skip.has(g.domain));
  const title = state.nodes.get(folderId)?.title || 'this folder';
  if (groups.length === 0) {
    return <Empty>No site appears 3 or more times directly in “{title}”.</Empty>;
  }
  return (
    <div>
      <div className="mb-3 flex items-center justify-between gap-3">
        <p className="text-[13px]">Make a folder per site in “{title}”:</p>
        <Button
          variant="primary"
          disabled={busy || chosen.length === 0}
          onClick={() => void run((progress) => groupBySite(folderId, chosen, progress))}
        >
          Create {chosen.length} {chosen.length === 1 ? 'folder' : 'folders'}
        </Button>
      </div>
      <ul className="flex flex-col gap-1.5">
        {groups.map((g) => (
          <li key={g.domain}>
            <label className="border-line bg-surface flex items-center gap-2.5 rounded-lg border px-3 py-2 text-[13px]">
              <input
                type="checkbox"
                className="accent-accent"
                checked={!skip.has(g.domain)}
                onChange={(e) =>
                  setSkip((s) => {
                    const next = new Set(s);
                    if (e.target.checked) next.delete(g.domain);
                    else next.add(g.domain);
                    return next;
                  })
                }
              />
              <Favicon url={g.items[0]?.url ?? ''} title={g.domain} size={16} />
              <span className="flex-1 font-medium">{g.domain}</span>
              <span className="text-ink-faint text-xs">{g.items.length} links</span>
            </label>
          </li>
        ))}
      </ul>
    </div>
  );
}
