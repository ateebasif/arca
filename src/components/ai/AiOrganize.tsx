import { useMemo, useRef, useState } from 'react';
import { chooseK } from '@/src/features/ai/kmeans';
import {
  applyGroups,
  estimateSeconds,
  planGroups,
  type OrganizeItem,
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
  | { kind: 'running'; stage: Stage; done: number; total: number }
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
    setPhase({ kind: 'running', stage: 'embedding', done: 0, total: items.length });
    try {
      const groups = await planGroups(items, {
        base: settings.ollamaUrl,
        embedModel: settings.embedModel,
        chatModel: settings.chatModel,
        groups: groupsWanted || undefined,
        signal: abort.current.signal,
        onProgress: (stage, done, total) =>
          setPhase({ kind: 'running', stage, done, total }),
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

      {(phase.kind === 'running' || phase.kind === 'applying') && (
        <div className="flex items-center gap-3 text-xs" role="status">
          <div className="bg-hover h-1.5 flex-1 overflow-hidden rounded-full">
            <div
              className="bg-accent-strong h-full transition-[width] duration-200"
              style={{
                width: `${Math.round((phase.done / Math.max(1, phase.total)) * 100)}%`,
              }}
            />
          </div>
          <span className="text-ink-muted tabular-nums">
            {phase.kind === 'running' ? STAGE_LABEL[phase.stage] : 'Moving links'} ·{' '}
            {phase.done}/{phase.total}
          </span>
          {phase.kind === 'running' && (
            <Button onClick={() => abort.current?.abort()}>Cancel</Button>
          )}
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
