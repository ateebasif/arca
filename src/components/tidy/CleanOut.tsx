import { useMemo, useState } from 'react';
import { analyzePurge, type PurgeGroup, type PurgeItem } from '@/src/features/tidy/purge';
import { archiveAll, removeAll } from '@/src/features/tidy/apply';
import { displayHost } from '@/src/lib/url';
import { usePurge } from '@/src/store/purgeRun';
import { linksWithin } from '@/src/store/selectors';
import { useSettings } from '@/src/store/settings';
import { useBookmarks } from '@/src/store/useBookmarks';
import { Favicon } from '../main/Favicon';
import { Button } from '../overlays/Dialog';

const date = new Intl.DateTimeFormat(undefined, { month: 'short', year: 'numeric' });
const SHOW = 8;

interface Props {
  baseId: string;
  busy: boolean;
  run(
    task: (progress: (d: number, t: number) => void) => Promise<unknown>,
  ): Promise<void>;
}

/**
 * Tidy up → Clean out: bookmarks that look saved on impulse, grouped by why,
 * plus an optional AI second opinion. Nothing changes until you pick items and
 * choose Archive (default, reversible) or Delete; one Undo reverses either.
 */
export function CleanOut({ baseId, busy, run }: Props) {
  const state = useBookmarks();
  const settings = useSettings();
  const { selected, verdicts, review, reviewError, toggle, setMany, clearSelection } =
    usePurge();
  const [confirmDelete, setConfirmDelete] = useState(false);

  const groups = useMemo(() => analyzePurge(state, baseId), [state, baseId]);
  const allLinks = useMemo(
    () => linksWithin(state, baseId).filter((l) => /^https?:/i.test(l.node.url ?? '')),
    [state, baseId],
  );
  // The AI's picks that the stronger rules didn't already catch.
  const aiGroup: PurgeGroup | null = useMemo(() => {
    // Age alone is a weak hint, so AI picks that were only "old" still show here.
    const flagged = new Set(
      groups
        .filter((g) => g.reason !== 'old')
        .flatMap((g) => g.items.map((i) => i.node.id)),
    );
    const items: PurgeItem[] = allLinks
      .filter((l) => verdicts.get(l.node.id)?.keep === false && !flagged.has(l.node.id))
      .map((l) => ({ node: l.node, folder: l.folderLabel, reasons: [] }));
    return items.length
      ? {
          reason: 'old',
          label: 'The AI thinks these were one-off saves',
          hint: 'From titles and addresses only, so double-check before removing.',
          items,
        }
      : null;
  }, [groups, allLinks, verdicts]);

  const live = [...selected].filter((id) => state.nodes.get(id)?.url);
  const shown = aiGroup ? [aiGroup, ...groups] : groups;

  const act = (kind: 'archive' | 'delete') =>
    void run(async (progress) => {
      if (kind === 'archive') await archiveAll(live, progress);
      else await removeAll(live, `Deleted ${live.length} links`, progress);
      clearSelection();
      setConfirmDelete(false);
    });

  const minutes = Math.max(1, Math.round(((allLinks.length / 10) * 3) / 60));

  return (
    <div className="flex flex-col gap-4">
      <p className="text-ink-muted text-xs leading-relaxed">
        Bookmarks that look saved on impulse and probably aren't worth keeping. Nothing
        changes until you pick some. <strong className="text-ink">Archive</strong> moves
        them into “Archived by Arca” (still searchable); one Undo reverses either action.
      </p>

      {settings.aiEnabled && (
        <div className="border-line bg-surface flex flex-wrap items-center gap-3 rounded-xl border p-3 text-xs">
          {review ? (
            <>
              <div className="bg-hover h-1.5 min-w-32 flex-1 overflow-hidden rounded-full">
                <div
                  className="bg-accent-strong h-full transition-[width] duration-200"
                  style={{
                    width: `${Math.round((review.done / Math.max(1, review.total)) * 100)}%`,
                  }}
                />
              </div>
              <span className="text-ink-muted tabular-nums">
                AI reviewing {review.done.toLocaleString()}/
                {review.total.toLocaleString()}
              </span>
              <Button onClick={() => usePurge.getState().cancelReview()}>Stop</Button>
            </>
          ) : (
            <>
              <span className="text-ink-muted flex-1">
                {verdicts.size
                  ? `The AI reviewed ${verdicts.size.toLocaleString()} links.`
                  : `Ask your local AI which of the ${allLinks.length.toLocaleString()} links look like one-off saves (about ${minutes} min; keeps going if you close this).`}
              </span>
              {verdicts.size < allLinks.length && (
                <Button
                  onClick={() =>
                    void usePurge.getState().startReview(
                      allLinks.map((l) => ({
                        id: l.node.id,
                        title: l.node.title,
                        url: l.node.url ?? '',
                        folder: l.folderLabel,
                      })),
                      {
                        base: settings.ollamaUrl,
                        chatModel: settings.askModel || settings.chatModel,
                      },
                    )
                  }
                >
                  {verdicts.size ? 'Review the rest' : 'Ask AI for a second opinion'}
                </Button>
              )}
            </>
          )}
          {reviewError && <span className="text-danger w-full">{reviewError}</span>}
        </div>
      )}

      {shown.length === 0 ? (
        <p className="text-ink-muted py-8 text-center text-[13px]">
          Nothing looks disposable here. Nice and tidy.
        </p>
      ) : (
        shown.map((g) => (
          <Group
            key={g.label}
            group={g}
            selected={selected}
            verdicts={verdicts}
            onToggle={toggle}
            onAll={(on) =>
              setMany(
                g.items.map((i) => i.node.id),
                on,
              )
            }
          />
        ))
      )}

      {live.length > 0 && (
        <div className="bg-surface-strong border-line sticky bottom-0 flex items-center gap-2 rounded-xl border p-2 pl-3 text-xs shadow-(--shadow-pop)">
          <span className="text-ink flex-1 font-medium">
            {live.length.toLocaleString()} selected
          </span>
          <Button onClick={clearSelection} disabled={busy}>
            Clear
          </Button>
          {confirmDelete ? (
            <Button variant="danger" disabled={busy} onClick={() => act('delete')}>
              Delete {live.length} for real
            </Button>
          ) : (
            <Button disabled={busy} onClick={() => setConfirmDelete(true)}>
              Delete…
            </Button>
          )}
          <Button variant="primary" disabled={busy} onClick={() => act('archive')}>
            Archive {live.length}
          </Button>
        </div>
      )}
    </div>
  );
}

function Group({
  group,
  selected,
  verdicts,
  onToggle,
  onAll,
}: {
  group: PurgeGroup;
  selected: ReadonlySet<string>;
  verdicts: ReadonlyMap<string, { keep: boolean; why: string }>;
  onToggle(id: string, on: boolean): void;
  onAll(on: boolean): void;
}) {
  const [more, setMore] = useState(false);
  const all = group.items.every((i) => selected.has(i.node.id));
  const items = more ? group.items : group.items.slice(0, SHOW);
  return (
    <section
      aria-label={group.label}
      className="border-line rounded-xl border"
      data-purge-group
    >
      <header className="flex items-center gap-3 px-3 pt-3 pb-2">
        <input
          type="checkbox"
          aria-label={`Select all: ${group.label}`}
          className="accent-accent"
          checked={all}
          onChange={(e) => onAll(e.target.checked)}
        />
        <div className="min-w-0 flex-1">
          <p className="text-[13px] font-medium">
            {group.label}{' '}
            <span className="text-ink-faint font-normal tabular-nums">
              {group.items.length.toLocaleString()}
            </span>
          </p>
          <p className="text-ink-faint text-[11px]">{group.hint}</p>
        </div>
      </header>
      <ul className="flex flex-col">
        {items.map(({ node, folder }) => {
          const verdict = verdicts.get(node.id);
          return (
            <li key={node.id} className="border-line border-t">
              <label className="hover:bg-hover flex cursor-pointer items-center gap-3 px-3 py-1.5">
                <input
                  type="checkbox"
                  aria-label={`Select ${node.title || node.url}`}
                  className="accent-accent"
                  checked={selected.has(node.id)}
                  onChange={(e) => onToggle(node.id, e.target.checked)}
                />
                <Favicon url={node.url ?? ''} title={node.title} size={16} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13px]">
                    {node.title || displayHost(node.url ?? '')}
                  </span>
                  <span className="text-ink-faint block truncate text-[11px]">
                    {displayHost(node.url ?? '')} · {folder.split(' / ').at(-1)} ·{' '}
                    {node.dateAdded ? date.format(node.dateAdded) : 'unknown date'}
                  </span>
                </span>
                {verdict && (
                  <span
                    className={`max-w-48 shrink-0 truncate rounded-full px-2 py-0.5 text-[10px] ${
                      verdict.keep
                        ? 'bg-hover text-ink-muted'
                        : 'bg-accent-soft text-accent'
                    }`}
                    title={verdict.why}
                  >
                    {verdict.keep ? 'AI: keep' : 'AI: one-off'}
                    {verdict.why && ` · ${verdict.why}`}
                  </span>
                )}
              </label>
            </li>
          );
        })}
      </ul>
      {group.items.length > SHOW && (
        <button
          type="button"
          onClick={() => setMore((m) => !m)}
          className="text-accent border-line w-full border-t px-3 py-2 text-left text-xs hover:underline"
        >
          {more ? 'Show fewer' : `Show all ${group.items.length.toLocaleString()}`}
        </button>
      )}
    </section>
  );
}
