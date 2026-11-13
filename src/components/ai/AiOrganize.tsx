import { useEffect, useMemo, useRef, useState } from 'react';
import { chooseK } from '@/src/features/ai/kmeans';
import {
  applyGroups,
  estimateSeconds,
  planGroups,
  type OrganizeItem,
  type ProgressInfo,
  type ProposedGroup,
  type Stage,
} from '@/src/features/ai/organize';
import { OllamaError } from '@/src/lib/ollama';
import { useOverlays } from '@/src/store/overlays';
import { linksWithin } from '@/src/store/selectors';
import { useSettings } from '@/src/store/settings';
import { useBookmarks } from '@/src/store/useBookmarks';
import { useUi } from '@/src/store/ui';
import { Button, inputClass } from '../overlays/Dialog';
import { OllamaHelp } from './OllamaHelp';

const STAGE_LABEL: Record<Stage, string> = {
  embedding: 'Reading bookmarks',
  grouping: 'Grouping by topic',
  naming: 'Naming folders',
};

type Phase =
  | { kind: 'ready' }
  | {
      kind: 'running';
      stage: Stage;
      done: number;
      total: number;
      info?: ProgressInfo;
      startedAt: number;
    }
  | { kind: 'review'; groups: ProposedGroup[] }
  | { kind: 'applying'; done: number; total: number }
  | { kind: 'done'; count: number }
  | { kind: 'error'; error: OllamaError };

/** Tidy up → AI organize: group the open folder's links by topic with local Ollama. */
export function AiOrganize() {
  const state = useBookmarks();
  const settings = useSettings();
  const folderId = useUi((s) => s.currentFolderId);
  const folderTitle = state.nodes.get(folderId)?.title || 'this folder';
  const items = useMemo<OrganizeItem[]>(
    () =>
      linksWithin(state, folderId)
        .filter((l) => l.node.url && /^https?:/i.test(l.node.url))
        .map((l) => ({
          id: l.node.id,
          title: l.node.title,
          url: l.node.url ?? '',
          folder: l.folderLabel,
        })),
    [state, folderId],
  );
  const auto = chooseK(items.length);
  const [groupsWanted, setGroupsWanted] = useState(0); // 0 = auto
  const [phase, setPhase] = useState<Phase>({ kind: 'ready' });
  const [names, setNames] = useState<Record<number, string>>({});
  const [skipped, setSkipped] = useState<Set<number>>(new Set());
  const abort = useRef<AbortController | null>(null);

  if (!settings.aiEnabled) {
    return (
      <div className="py-8 text-center text-[13px]">
        <p className="font-medium">Group links by topic with a local AI</p>
        <p className="text-ink-muted mx-auto mt-1 max-w-md text-xs leading-relaxed">
          Uses Ollama on this computer: an embedding model groups similar links, a small
          chat model names each folder. Nothing leaves your machine.
        </p>
        <div className="mt-4">
          <Button variant="primary" onClick={() => useOverlays.getState().openSettings()}>
            Set up in Settings
          </Button>
        </div>
      </div>
    );
  }

  const run = async () => {
    abort.current = new AbortController();
    setNames({});
    setSkipped(new Set());
    const startedAt = Date.now();
    setPhase({
      kind: 'running',
      stage: 'embedding',
      done: 0,
      total: items.length,
      startedAt,
    });
    try {
      const groups = await planGroups(items, {
        base: settings.ollamaUrl,
        embedModel: settings.embedModel,
        chatModel: settings.chatModel,
        groups: groupsWanted || undefined,
        signal: abort.current.signal,
        onProgress: (stage, done, total, info) =>
          setPhase((prev) => ({
            kind: 'running',
            stage,
            done,
            total,
            // Keep the cache count from the embedding stage for the summary line.
            info: { ...(prev.kind === 'running' ? prev.info : {}), ...info },
            startedAt,
          })),
      });
      setPhase({ kind: 'review', groups });
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError')
        setPhase({ kind: 'ready' });
      else
        setPhase({
          kind: 'error',
          error:
            e instanceof OllamaError ? e : new OllamaError('BAD_RESPONSE', String(e)),
        });
    }
  };

  const apply = async (groups: ProposedGroup[]) => {
    const chosen = groups
      .map((g, i) => ({ ...g, name: (names[i] ?? g.name).trim() || g.name }))
      .filter((_, i) => !skipped.has(i));
    const total = chosen.reduce((n, g) => n + g.ids.length, 0);
    setPhase({ kind: 'applying', done: 0, total });
    await applyGroups(folderId, chosen, (done) =>
      setPhase({ kind: 'applying', done, total }),
    );
    setPhase({ kind: 'done', count: chosen.length });
  };

  return (
    <div className="flex flex-col gap-3">
      <p className="text-ink-muted text-xs leading-relaxed">
        Groups the <strong className="text-ink">{items.length.toLocaleString()}</strong>{' '}
        links in “{folderTitle}” (and its subfolders) by topic using{' '}
        <code>{settings.embedModel}</code> and <code>{settings.chatModel}</code>. You
        review everything before anything moves, and one Undo reverses it.
      </p>

      {(phase.kind === 'ready' || phase.kind === 'error' || phase.kind === 'done') && (
        <div className="flex flex-wrap items-center gap-2">
          <label className="text-ink-muted flex items-center gap-2 text-xs">
            Folders
            <select
              className="border-line bg-surface h-8 rounded-lg border px-2 text-[13px]"
              value={groupsWanted}
              onChange={(e) => setGroupsWanted(Number(e.target.value))}
            >
              <option value={0}>Auto ({auto})</option>
              {[4, 6, 8, 10, 12, 15, 20, 25, 30].map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </label>
          <Button
            variant="primary"
            disabled={items.length < 4}
            onClick={() => void run()}
          >
            Suggest folders
          </Button>
          {phase.kind === 'ready' && items.length > 200 && (
            <span className="text-ink-faint text-xs">
              First run ≈{' '}
              {Math.max(
                1,
                Math.round(estimateSeconds(settings.embedModel, items.length) / 60),
              )}{' '}
              min · later runs only read new links
            </span>
          )}
          {phase.kind === 'done' && (
            <span className="text-ink-muted text-xs" role="status">
              Created {phase.count} folders in “Organized by Arca”. Undo is in the toast
              or ⌘Z.
            </span>
          )}
        </div>
      )}

      {phase.kind === 'error' && <OllamaHelp error={phase.error} />}

      {phase.kind === 'running' && (
        <RunProgress phase={phase} onCancel={() => abort.current?.abort()} />
      )}

      {phase.kind === 'applying' && (
        <div className="flex items-center gap-3 text-xs" role="status">
          <Bar done={phase.done} total={phase.total} />
          <span className="text-ink-muted tabular-nums">
            Moving links · {phase.done}/{phase.total}
          </span>
        </div>
      )}

      {phase.kind === 'review' && (
        <>
          <div className="flex items-center justify-between gap-2">
            <p className="text-[13px]">
              {phase.groups.length} suggested folders. Rename or untick any before
              applying.
            </p>
            <div className="flex gap-2">
              <Button onClick={() => setPhase({ kind: 'ready' })}>Discard</Button>
              <Button
                variant="primary"
                disabled={skipped.size === phase.groups.length}
                onClick={() => void apply(phase.groups)}
              >
                Apply {phase.groups.length - skipped.size} folders
              </Button>
            </div>
          </div>
          <ul className="flex flex-col gap-2">
            {phase.groups.map((g, i) => (
              <li
                key={i}
                className="border-line bg-surface rounded-xl border p-3"
                data-ai-group
              >
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    aria-label={`Include ${names[i] ?? g.name}`}
                    className="accent-accent"
                    checked={!skipped.has(i)}
                    onChange={(e) =>
                      setSkipped((s) => {
                        const next = new Set(s);
                        if (e.target.checked) next.delete(i);
                        else next.add(i);
                        return next;
                      })
                    }
                  />
                  <input
                    aria-label="Folder name"
                    className={`${inputClass} h-8 flex-1 font-medium`}
                    value={names[i] ?? g.name}
                    maxLength={60}
                    onChange={(e) => setNames((n) => ({ ...n, [i]: e.target.value }))}
                  />
                  <span className="text-ink-faint shrink-0 text-xs">
                    {g.ids.length} links
                  </span>
                </div>
                <p
                  className="text-ink-muted mt-1.5 truncate pl-6 text-xs"
                  title={g.samples.join('\n')}
                >
                  {g.samples.join(' · ')}
                </p>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}

function Bar({ done, total }: { done: number; total: number }) {
  return (
    <div className="bg-hover h-1.5 flex-1 overflow-hidden rounded-full">
      <div
        className="bg-accent-strong h-full transition-[width] duration-200"
        style={{ width: `${Math.round((done / Math.max(1, total)) * 100)}%` }}
      />
    </div>
  );
}

const clock = (seconds: number) => {
  const s = Math.max(0, Math.round(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};

/**
 * Live progress while AI organize runs: elapsed time, an estimate of what's
 * left (from the speed so far), and which links are being read right now.
 */
function RunProgress({
  phase,
  onCancel,
}: {
  phase: Extract<Phase, { kind: 'running' }>;
  onCancel(): void;
}) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  const { stage, done, total, info, startedAt } = phase;
  const elapsed = (now - startedAt) / 1000;
  const cached = info?.cached ?? 0;
  const fresh = done - cached; // read from Ollama during this run
  const loading = stage === 'embedding' && fresh <= 0 && total > cached;
  const left =
    stage === 'embedding' && fresh > 0 && elapsed > 2
      ? ((total - done) * elapsed) / fresh
      : null;
  const label = loading ? 'Starting the model' : STAGE_LABEL[stage];

  return (
    <div className="space-y-1.5 text-xs" role="status">
      <div className="flex items-center gap-3">
        <Bar done={done} total={total} />
        <span className="text-ink-muted tabular-nums">
          {label} · {done}/{total}
        </span>
        <Button onClick={onCancel}>Cancel</Button>
      </div>
      <p className="text-ink-faint tabular-nums">
        {clock(elapsed)} elapsed
        {left !== null &&
          ` · about ${left < 60 ? 'under a minute' : `${Math.ceil(left / 60)} min`} left`}
        {loading && ' · the first batch takes longer while Ollama loads the model'}
        {cached > 0 && ` · ${cached} links already read on an earlier run`}
      </p>
      {info?.titles && info.titles.length > 0 && stage !== 'grouping' && (
        <p className="text-ink-faint truncate" title={info.titles.join('\n')}>
          {stage === 'naming' ? 'Naming the group with: ' : 'Now reading: '}
          {info.titles.slice(0, 3).filter(Boolean).join(' · ')}
          {stage === 'embedding' &&
            info.titles.length > 3 &&
            ` +${info.titles.length - 3} more`}
        </p>
      )}
    </div>
  );
}
