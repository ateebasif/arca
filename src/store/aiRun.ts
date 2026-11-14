import { create } from 'zustand';
import type {
  OrganizeItem,
  ProgressInfo,
  ProposedGroup,
  Stage,
} from '@/src/features/ai/organize';
import { OllamaError } from '@/src/lib/ollama';

/**
 * AI organize run state. It lives outside the Tidy up panel so a run keeps
 * going (and its suggestions stay) when you switch tabs, close the panel or
 * browse to another folder. Never persisted: a page reload starts fresh, but
 * embeddings already read are cached, so a re-run picks up quickly.
 */

export type AiPhase =
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

export interface RunOptions {
  base: string;
  embedModel: string;
  chatModel: string;
  groups?: number | 'ai';
  organizeRules?: string;
  tagRules?: string;
  knownTags?: readonly string[];
}

interface AiRunState {
  phase: AiPhase;
  /** Folder the run was started in; suggestions are applied there. */
  folderId: string | null;
  folderTitle: string;
  /** -1 = let AI decide, 0 = quick estimate, else a fixed number of folders. */
  groupsWanted: number;
  /** Also tag links with their new folder's name when applying. */
  tagWithFolder: boolean;
  setTagWithFolder(on: boolean): void;
  names: Record<number, string>;
  /** Tags you edited for a group (otherwise its suggested ones). */
  groupTags: Record<number, string[]>;
  setGroupTags(index: number, tags: string[]): void;
  skipped: Set<number>;
  setGroupsWanted(n: number): void;
  setName(index: number, name: string): void;
  setIncluded(index: number, included: boolean): void;
  start(
    folder: { id: string; title: string },
    items: OrganizeItem[],
    opts: RunOptions,
  ): Promise<void>;
  cancel(): void;
  discard(): void;
  apply(): Promise<void>;
}

let controller: AbortController | null = null;

const initial = {
  phase: { kind: 'ready' } as AiPhase,
  folderId: null,
  folderTitle: '',
  names: {},
  groupTags: {},
  skipped: new Set<number>(),
};

export const useAiRun = create<AiRunState>()((set, get) => ({
  ...initial,
  groupsWanted: -1,
  tagWithFolder: false,

  setGroupsWanted: (groupsWanted) => set({ groupsWanted }),
  setTagWithFolder: (tagWithFolder) => set({ tagWithFolder }),
  setName: (index, name) => set((s) => ({ names: { ...s.names, [index]: name } })),
  setGroupTags: (index, tags) =>
    set((s) => ({ groupTags: { ...s.groupTags, [index]: tags } })),
  setIncluded: (index, included) =>
    set((s) => {
      const skipped = new Set(s.skipped);
      if (included) skipped.delete(index);
      else skipped.add(index);
      return { skipped };
    }),

  async start(folder, items, opts) {
    if (get().phase.kind === 'running' || get().phase.kind === 'applying') return;
    controller = new AbortController();
    const signal = controller.signal;
    const startedAt = Date.now();
    set({
      folderId: folder.id,
      folderTitle: folder.title,
      names: {},
      groupTags: {},
      skipped: new Set(),
      phase: {
        kind: 'running',
        stage: 'embedding',
        done: 0,
        total: items.length,
        startedAt,
      },
    });
    try {
      // Loaded on first use so the sidebar's status doesn't pull AI code into New Tab.
      const { planGroups } = await import('@/src/features/ai/organize');
      const groups = await planGroups(items, {
        ...opts,
        signal,
        onProgress: (stage, done, total, info) => {
          if (signal.aborted) return;
          set((s) => ({
            phase: {
              kind: 'running',
              stage,
              done,
              total,
              // Keep the cache count from the embedding stage for the summary line.
              info: { ...(s.phase.kind === 'running' ? s.phase.info : {}), ...info },
              startedAt,
            },
          }));
        },
      });
      if (!signal.aborted) set({ phase: { kind: 'review', groups } });
    } catch (e) {
      if (signal.aborted || (e instanceof DOMException && e.name === 'AbortError')) {
        set({ phase: { kind: 'ready' } });
      } else {
        set({
          phase: {
            kind: 'error',
            error:
              e instanceof OllamaError ? e : new OllamaError('BAD_RESPONSE', String(e)),
          },
        });
      }
    } finally {
      if (controller?.signal === signal) controller = null;
    }
  },

  cancel() {
    controller?.abort();
    controller = null;
    set({ phase: { kind: 'ready' } });
  },

  discard: () => set({ ...initial, skipped: new Set() }),

  async apply() {
    const { phase, names, groupTags, skipped, folderId, tagWithFolder } = get();
    if (phase.kind !== 'review' || !folderId) return;
    const chosen = phase.groups
      .map((g, i) => ({
        ...g,
        name: (names[i] ?? g.name).trim() || g.name,
        tags: groupTags[i] ?? g.tags,
      }))
      .filter((_, i) => !skipped.has(i));
    const total = chosen.reduce((n, g) => n + g.ids.length, 0);
    set({ phase: { kind: 'applying', done: 0, total } });
    try {
      const { applyGroups } = await import('@/src/features/ai/organize');
      await applyGroups(
        folderId,
        chosen,
        (done) => set({ phase: { kind: 'applying', done, total } }),
        { tag: tagWithFolder },
      );
      set({ phase: { kind: 'done', count: chosen.length } });
    } catch (e) {
      set({
        phase: {
          kind: 'error',
          error: new OllamaError(
            'BAD_RESPONSE',
            `Couldn't finish moving links (${e instanceof Error ? e.message : String(e)}). Undo reverses what was moved.`,
          ),
        },
      });
    }
  },
}));

/** Test helper. */
export function resetAiRun(): void {
  controller?.abort();
  controller = null;
  useAiRun.setState({
    ...initial,
    skipped: new Set(),
    groupsWanted: -1,
    tagWithFolder: false,
  });
}
