import { rememberFolder } from '@/src/features/editing/recentFolders';
import { FolderPicker } from '../FolderPicker';
import { useUi } from '@/src/store/ui';
import { useMemo, useState } from 'react';
import { deleteMany, moveMany, openMany, retagMany } from '@/src/features/editing/bulk';
import { errorMessage } from '@/src/features/editing/actions';
import { tagStyle } from '@/src/features/tags/style';
import { useOverlays } from '@/src/store/overlays';
import { useSelection } from '@/src/store/selection';
import { getMetaStore, useMeta } from '@/src/store/useMeta';
import { useBookmarks } from '@/src/store/useBookmarks';
import { CloseIcon } from '../icons';
import { Button } from '../overlays/Dialog';
import { TagInput } from '../tags/TagInput';

type Panel = null | 'move' | 'tag' | 'open' | 'delete';
const OPEN_WARN = 10;

/** Floating bar while items are selected: move, tag, open all, delete. */
export function SelectionBar() {
  const state = useBookmarks();
  const meta = useMeta();
  const ids = useSelection((s) => s.ids);
  const sidebar = useUi((s) => (s.sidebarCollapsed ? 0 : s.sidebarWidth));
  const clear = useSelection((s) => s.clear);
  const [panel, setPanel] = useState<Panel>(null);
  const [target, setTarget] = useState('');
  const [addTags, setAddTags] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  const list = useMemo(() => [...ids].filter((id) => state.nodes.has(id)), [ids, state]);
  const links = list.filter((id) => state.nodes.get(id)?.url);
  const folders = list.length - links.length;
  // Tags on any selected item, offered for removal.
  const present = useMemo(() => {
    const set = new Set<string>();
    for (const id of list) for (const t of meta.byId.get(id)?.tags ?? []) set.add(t);
    return [...set].sort();
  }, [list, meta]);
  const known = useMemo(
    () =>
      getMetaStore()
        .allTags()
        .map((t) => t.tag),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [meta.version],
  );

  if (list.length === 0) return null;

  const run = async (task: () => Promise<unknown>, done = true) => {
    setBusy(true);
    try {
      await task();
      if (done) {
        setPanel(null);
        setAddTags([]);
      }
    } catch (e) {
      useOverlays.getState().toast(errorMessage(e), 'error');
    } finally {
      setBusy(false);
    }
  };
  const count = `${list.length} ${list.length === 1 ? 'item' : 'items'}`;

  return (
    <div
      role="region"
      aria-label="Selection"
      // Centred over the main area, not the whole window (the sidebar is on the left).
      style={{ left: `calc(${sidebar}px + (100vw - ${sidebar}px) / 2)` }}
      className="animate-pop fixed bottom-5 z-30 w-[min(40rem,calc(100vw-2rem))] -translate-x-1/2"
    >
      {panel && (
        <div className="border-line bg-surface-strong mb-2 rounded-xl border p-3 text-xs shadow-(--shadow-pop) backdrop-blur-xl">
          {panel === 'move' && (
            <div className="flex items-center gap-2">
              <FolderPicker
                label="Move to folder"
                value={target}
                onChange={setTarget}
                dropUp
                className="flex-1"
              />
              <Button
                variant="primary"
                disabled={!target || busy}
                onClick={() =>
                  void run(() =>
                    moveMany(list, target)
                      .then(() => rememberFolder(target))
                      .then(clear),
                  )
                }
              >
                Move {count}
              </Button>
            </div>
          )}
          {panel === 'tag' && (
            <div className="flex flex-col gap-2">
              <TagInput value={addTags} onChange={setAddTags} suggestions={known} />
              {present.length > 0 && (
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-ink-faint">Remove from all:</span>
                  {present.map((t) => (
                    <button
                      key={t}
                      type="button"
                      aria-label={`Remove tag ${t} from selected`}
                      style={tagStyle(t)}
                      disabled={busy}
                      onClick={() => void run(() => retagMany(list, [], [t]), false)}
                      className="flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px]"
                    >
                      #{t} <CloseIcon width={9} height={9} />
                    </button>
                  ))}
                </div>
              )}
              <div className="flex justify-end">
                <Button
                  variant="primary"
                  disabled={!addTags.length || busy}
                  onClick={() => void run(() => retagMany(list, addTags))}
                >
                  Add {addTags.length > 1 ? 'tags' : 'tag'} to {count}
                </Button>
              </div>
            </div>
          )}
          {panel === 'open' && (
            <div className="flex items-center gap-2">
              <span className="flex-1">
                Open {links.length} links in new tabs?
                {folders > 0 && ' Folders are skipped.'}
              </span>
              <Button
                variant="primary"
                disabled={busy}
                onClick={() => void run(() => openMany(list))}
              >
                Open {links.length} tabs
              </Button>
            </div>
          )}
          {panel === 'delete' && (
            <div className="flex items-center gap-2">
              <span className="flex-1">
                Delete {count}
                {folders > 0 &&
                  ` (including ${folders} ${folders === 1 ? 'folder' : 'folders'} and everything in them)`}
                ? You can undo this.
              </span>
              <Button
                variant="danger"
                disabled={busy}
                onClick={() => void run(() => deleteMany(list).then(clear))}
              >
                Delete {count}
              </Button>
            </div>
          )}
        </div>
      )}
      <div className="border-line bg-surface-strong flex items-center gap-1.5 rounded-xl border p-1.5 pl-3 text-xs shadow-(--shadow-pop) backdrop-blur-xl">
        <span className="text-ink flex-1 font-medium tabular-nums">{count} selected</span>
        {(
          [
            ['move', 'Move to…'],
            ['tag', 'Tag…'],
            ['open', 'Open all'],
            ['delete', 'Delete…'],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            aria-expanded={panel === key}
            disabled={busy || (key === 'open' && links.length === 0)}
            onClick={() => {
              // Small "open all" needs no confirmation.
              if (key === 'open' && links.length <= OPEN_WARN) {
                void run(() => openMany(list));
                return;
              }
              setPanel(panel === key ? null : key);
            }}
            className={`h-8 rounded-lg px-2.5 transition-colors disabled:opacity-40 ${
              panel === key
                ? 'bg-hover text-ink'
                : 'text-ink-muted hover:bg-hover hover:text-ink'
            } ${key === 'delete' ? 'hover:text-danger' : ''}`}
          >
            {label}
          </button>
        ))}
        <button
          type="button"
          aria-label="Clear selection (Esc)"
          title="Clear selection (Esc)"
          onClick={clear}
          className="text-ink-faint hover:text-ink hover:bg-hover grid size-8 place-items-center rounded-lg"
        >
          <CloseIcon />
        </button>
      </div>
    </div>
  );
}
