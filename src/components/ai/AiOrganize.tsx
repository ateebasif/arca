import { useEffect, useMemo, useState } from 'react';
import { chooseK } from '@/src/features/ai/kmeans';
import {
  DEFAULT_ORGANIZE_RULES,
  DEFAULT_TAG_RULES,
  estimateSeconds,
  tagsForGroup,
  type OrganizeItem,
  type Stage,
} from '@/src/features/ai/organize';
import { getMetaStore, useMeta } from '@/src/store/useMeta';
import { TagInput } from '../tags/TagInput';
import { RULES_MAX } from '@/src/store/settings';
import { useAiRun, type AiPhase } from '@/src/store/aiRun';
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

/**
 * Tidy up → AI organize: group the open folder's links by topic with local
 * Ollama. The run itself lives in useAiRun, so switching tabs or closing the
 * panel doesn't interrupt it.
 */
export function AiOrganize() {
  const state = useBookmarks();
  const settings = useSettings();
  const currentId = useUi((s) => s.currentFolderId);
  const run = useAiRun();
  const { phase } = run;
  const idle = phase.kind === 'ready' || phase.kind === 'error' || phase.kind === 'done';
  // While a run is going (or waiting for review) the panel is about that run's
  // folder, even if you've browsed somewhere else since.
  const folderId = !idle && run.folderId ? run.folderId : currentId;
  const folderTitle =
    state.nodes.get(folderId)?.title || run.folderTitle || 'this folder';
  const items = useMemo<OrganizeItem[]>(
    () =>
      linksWithin(state, currentId)
        .filter((l) => l.node.url && /^https?:/i.test(l.node.url))
        .map((l) => ({
          id: l.node.id,
          title: l.node.title,
          url: l.node.url ?? '',
          folder: l.folderLabel,
        })),
    [state, currentId],
  );
  const auto = chooseK(items.length);
  const meta = useMeta();
  const known = useMemo(
    () =>
      getMetaStore()
        .allTags()
        .map((t) => t.tag),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [meta.version],
  );

  if (!settings.aiEnabled && idle) {
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

  const start = () =>
    void run.start(
      { id: currentId, title: state.nodes.get(currentId)?.title || 'this folder' },
      items,
      {
        base: settings.ollamaUrl,
        embedModel: settings.embedModel,
        chatModel: settings.chatModel,
        groups: run.groupsWanted === -1 ? 'ai' : run.groupsWanted || undefined,
        organizeRules: settings.organizeRules,
        tagRules: settings.tagRules,
        knownTags: getMetaStore()
          .allTags()
          .map((t) => t.tag),
      },
    );

  return (
    <div className="flex flex-col gap-3">
      {idle ? (
        <p className="text-ink-muted text-xs leading-relaxed">
          Groups the <strong className="text-ink">{items.length.toLocaleString()}</strong>{' '}
          links in “{folderTitle}” (and its subfolders) by topic using{' '}
          <code>{settings.embedModel}</code> and <code>{settings.chatModel}</code>. You
          review everything before anything moves, and one Undo reverses it.
        </p>
      ) : (
        <p className="text-ink-muted text-xs leading-relaxed">
          Organizing “<span className="text-ink">{folderTitle}</span>”. This keeps running
          if you switch tabs, close this panel or open other folders; come back to Tidy up
          → AI organize to see it.
          {folderId !== currentId && (
            <>
              {' '}
              <button
                type="button"
                className="text-accent hover:underline"
                onClick={() => useUi.getState().openFolder(folderId)}
              >
                Go to folder
              </button>
            </>
          )}
        </p>
      )}

      {idle && (
        <div className="flex flex-wrap items-center gap-2">
          <label className="text-ink-muted flex items-center gap-2 text-xs">
            Folders
            <select
              className="border-line bg-surface h-8 rounded-lg border px-2 text-[13px]"
              value={run.groupsWanted}
              onChange={(e) => run.setGroupsWanted(Number(e.target.value))}
            >
              <option value={-1}>Let AI decide</option>
              <option value={0}>Quick estimate ({auto})</option>
              {[4, 6, 8, 10, 12, 15, 20, 25, 30, 40, 50, 60]
                .filter((n) => n < items.length)
                .map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
            </select>
          </label>
          <Button
            variant="primary"
            disabled={items.length < 4 || !settings.aiEnabled}
            onClick={start}
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

      {idle && <OrganizeRules />}

      {phase.kind === 'error' && <OllamaHelp error={phase.error} />}

      {phase.kind === 'running' && <RunProgress phase={phase} onCancel={run.cancel} />}

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
              <Button onClick={run.discard}>Discard</Button>
              <Button
                variant="primary"
                disabled={run.skipped.size === phase.groups.length}
                onClick={() => void run.apply()}
              >
                Apply {phase.groups.length - run.skipped.size} folders
              </Button>
            </div>
          </div>
          <label className="text-ink-muted flex items-center gap-2 text-xs">
            <input
              type="checkbox"
              className="accent-accent"
              checked={run.tagWithFolder}
              onChange={(e) => run.setTagWithFolder(e.target.checked)}
            />
            Also tag the links
            <span className="text-ink-faint">
              (suggested per folder below, following your tag rules; edit them freely;
              tags stay if you move links later)
            </span>
          </label>
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
                    aria-label={`Include ${run.names[i] ?? g.name}`}
                    className="accent-accent"
                    checked={!run.skipped.has(i)}
                    onChange={(e) => run.setIncluded(i, e.target.checked)}
                  />
                  <input
                    aria-label="Folder name"
                    className={`${inputClass} h-8 flex-1 font-medium`}
                    value={run.names[i] ?? g.name}
                    maxLength={60}
                    onChange={(e) => run.setName(i, e.target.value)}
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
                {run.tagWithFolder && !run.skipped.has(i) && (
                  <div className="mt-2 pl-6" data-ai-group-tags>
                    <TagInput
                      value={
                        run.groupTags[i] ??
                        tagsForGroup({ name: run.names[i] ?? g.name, tags: g.tags })
                      }
                      onChange={(tags) => run.setGroupTags(i, tags)}
                      suggestions={known}
                    />
                  </div>
                )}
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
  phase: Extract<AiPhase, { kind: 'running' }>;
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

/**
 * Optional instructions for AI organize: how to name folders and how to tag.
 * Empty boxes use Arca's defaults, shown as the placeholder text.
 */
function OrganizeRules() {
  const settings = useSettings();
  const [folders, setFolders] = useState(settings.organizeRules);
  const [tags, setTags] = useState(settings.tagRules);
  const custom = !!(settings.organizeRules || settings.tagRules);
  const save = (patch: { organizeRules?: string; tagRules?: string }) =>
    void settings.update(patch);
  const box = (
    label: string,
    value: string,
    set: (v: string) => void,
    key: 'organizeRules' | 'tagRules',
    placeholder: string,
  ) => (
    <label className="flex flex-col gap-1">
      <span className="text-ink flex items-center justify-between font-medium">
        {label}
        {value && (
          <button
            type="button"
            className="text-ink-faint hover:text-ink font-normal"
            onClick={() => {
              set('');
              save({ [key]: '' });
            }}
          >
            Use default
          </button>
        )}
      </span>
      <textarea
        aria-label={label}
        rows={3}
        maxLength={RULES_MAX}
        value={value}
        placeholder={placeholder}
        onChange={(e) => set(e.target.value)}
        onBlur={() => value !== settings[key] && save({ [key]: value.trim() })}
        onKeyDown={(e) => e.stopPropagation()}
        className={`${inputClass} placeholder:text-ink-faint min-h-16 resize-y py-2 leading-relaxed`}
      />
    </label>
  );
  return (
    <details className="border-line bg-surface rounded-xl border text-xs" open={custom}>
      <summary className="text-ink-muted hover:text-ink cursor-pointer px-3 py-2.5 select-none">
        Instructions for the AI{' '}
        <span className="text-ink-faint">
          (optional{custom ? ', using yours' : ', using defaults'})
        </span>
      </summary>
      <div className="flex flex-col gap-3 px-3 pb-3">
        <p className="text-ink-faint leading-relaxed">
          These shape folder names and tags. Which links go together comes from what
          they're about, so the folders themselves are found the same way. Leave a box
          empty to use the default shown in it.
        </p>
        {box(
          'Folder names',
          folders,
          setFolders,
          'organizeRules',
          DEFAULT_ORGANIZE_RULES,
        )}
        {box('Tags', tags, setTags, 'tagRules', DEFAULT_TAG_RULES)}
      </div>
    </details>
  );
}
