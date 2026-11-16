import { create } from 'zustand';
import type { AskItem, AskTurn } from '@/src/features/ai/ask';
import type { EmbedProgress } from '@/src/features/ai/embedTexts';
import { OllamaError } from '@/src/lib/ollama';

/**
 * "Ask Arca" conversation. Lives outside the panel so closing it (or a slow
 * first read) doesn't lose anything. It's also kept in this tab's
 * sessionStorage, so opening a result in the same tab and coming back
 * restores it; it's gone when the tab closes, and never synced or saved
 * anywhere else.
 */

export interface AskMessage {
  id: number;
  role: 'user' | 'arca';
  text: string;
  /** The chat model's picks (arca only), best first. */
  ids?: string[];
  /** Every match, picks first; shown as soon as they're found. */
  matches?: string[];
  /** True while the chat model is still writing this answer. */
  pending?: boolean;
  /** False when the chat model failed and only matches are shown. */
  fromModel?: boolean;
  /** A follow-up that narrowed the previous results (no new search). */
  narrowed?: boolean;
  /** Why each pick fits, by bookmark id. */
  reasons?: Record<string, string>;
}

export type AskStatus =
  | { kind: 'idle' }
  | {
      kind: 'working';
      stage: 'reading' | 'searching' | 'thinking';
      startedAt: number;
    };

export interface AskSendOptions {
  base: string;
  embedModel: string;
  chatModel: string;
}

interface AskChatState {
  messages: AskMessage[];
  status: AskStatus;
  /** Progress of reading bookmarks (first time only); null when done/idle. */
  index: (EmbedProgress & { startedAt: number }) | null;
  error: OllamaError | null;
  /** Starts reading bookmarks in the background so the first answer is quick. */
  warm(items: AskItem[], opts: AskSendOptions): void;
  /** Stops reading the library (panel closed, AI turned off). */
  stopWarming(): void;
  send(
    question: string,
    items: AskItem[],
    keywordHits: number[],
    opts: AskSendOptions,
  ): Promise<void>;
  cancel(): void;
  clear(): void;
}

const SESSION_KEY = 'arca.ask';
const MAX_SAVED = 40;

const strings = (v: unknown, max: number): string[] | undefined =>
  Array.isArray(v)
    ? v.filter((x): x is string => typeof x === 'string' && x.length <= 64).slice(0, max)
    : undefined;

function parseReasons(v: unknown): Record<string, string> | undefined {
  if (!v || typeof v !== 'object' || Array.isArray(v)) return undefined;
  const out: Record<string, string> = {};
  for (const [id, why] of Object.entries(v).slice(0, 40)) {
    if (id.length <= 64 && typeof why === 'string') out[id] = why.slice(0, 160);
  }
  return Object.keys(out).length ? out : undefined;
}

/** Messages saved in this tab, validated like anything read from storage. */
export function parseSaved(raw: unknown): { messages: AskMessage[]; open: boolean } {
  const empty = { messages: [], open: false };
  if (!raw || typeof raw !== 'object') return empty;
  const r = raw as { messages?: unknown; open?: unknown };
  if (!Array.isArray(r.messages)) return empty;
  const messages: AskMessage[] = [];
  for (const m of r.messages.slice(-MAX_SAVED)) {
    if (!m || typeof m !== 'object') continue;
    const x = m as Record<string, unknown>;
    if ((x.role !== 'user' && x.role !== 'arca') || typeof x.text !== 'string') continue;
    if (!Number.isInteger(x.id)) continue;
    messages.push({
      id: x.id as number,
      role: x.role,
      text: x.text.slice(0, 2000),
      ids: strings(x.ids, 40),
      matches: strings(x.matches, 60),
      fromModel: x.fromModel === false ? false : undefined,
      narrowed: x.narrowed === true ? true : undefined,
      reasons: parseReasons(x.reasons),
    });
  }
  return { messages, open: r.open === true };
}

function readSession(): { messages: AskMessage[]; open: boolean } {
  try {
    return parseSaved(JSON.parse(sessionStorage.getItem(SESSION_KEY) ?? 'null'));
  } catch {
    return { messages: [], open: false };
  }
}

let panelOpen = false;
function writeSession(messages: AskMessage[]): void {
  try {
    const saved = messages.filter((m) => !m.pending).slice(-MAX_SAVED);
    sessionStorage.setItem(
      SESSION_KEY,
      JSON.stringify({ messages: saved, open: panelOpen }),
    );
  } catch {
    // Storage full or unavailable: the chat just isn't kept.
  }
}

/** The panel records whether it's open, so coming back to this tab reopens it. */
export function setAskPanelOpen(open: boolean): void {
  panelOpen = open;
  writeSession(useAskChat.getState().messages);
}

/** True if Ask Arca was open when this tab last navigated away. */
export function askPanelWasOpen(): boolean {
  return readSession().open;
}

let controller: AbortController | null = null;
let warming: { key: string; done: Promise<void>; abort: AbortController } | null = null;
const restored = readSession();
let nextId = Math.max(0, ...restored.messages.map((m) => m.id)) + 1;

const warmKey = (items: AskItem[], opts: AskSendOptions) =>
  `${opts.base}|${opts.embedModel}|${items.length}`;

export const useAskChat = create<AskChatState>()((set, get) => ({
  messages: restored.messages,
  status: { kind: 'idle' },
  index: null,
  error: null,

  warm(items, opts) {
    const key = warmKey(items, opts);
    if (warming?.key === key || items.length === 0) return;
    warming?.abort.abort();
    const abort = new AbortController();
    const startedAt = Date.now();
    const done = (async () => {
      const { indexDocs, pruneStaleReadings } = await import('@/src/features/ai/ask');
      await indexDocs(items, {
        ...opts,
        signal: abort.signal,
        onIndexProgress: (p) => {
          if (abort.signal.aborted) return;
          set({ index: p.done < p.total ? { ...p, startedAt } : null });
        },
      });
      // The whole library is read now, so readings nothing uses can go.
      if (!abort.signal.aborted) await pruneStaleReadings(items, opts.embedModel);
    })()
      .catch((e: unknown) => {
        // Errors surface on the next question; a failed warm-up can be retried.
        if (warming?.abort === abort) warming = null;
        if (!(e instanceof DOMException && e.name === 'AbortError')) {
          set({
            error:
              e instanceof OllamaError ? e : new OllamaError('BAD_RESPONSE', String(e)),
          });
        }
      })
      .finally(() => {
        if (!abort.signal.aborted) set({ index: null });
      });
    warming = { key, done, abort };
  },

  stopWarming() {
    // A question in progress needs the reading; let it finish.
    if (!warming || get().status.kind === 'working') return;
    warming.abort.abort();
    warming = null;
    set({ index: null });
  },

  async send(question, items, keywordHits, opts) {
    const text = question.trim();
    if (!text || get().status.kind === 'working') return;
    const history: AskTurn[] = get().messages.map((m) => ({
      role: m.role,
      text: m.text,
    }));
    // What the last answer showed (its picks first), for follow-up questions.
    const last = [...get().messages].reverse().find((m) => m.role === 'arca');
    const previous = last ? (last.matches ?? last.ids ?? []).slice(0, 20) : [];
    controller = new AbortController();
    const signal = controller.signal;
    set((s) => ({
      messages: [...s.messages, { id: nextId++, role: 'user', text }],
      status: { kind: 'working', stage: 'reading', startedAt: Date.now() },
      error: null,
    }));
    const stage = (next: 'reading' | 'searching' | 'thinking') => {
      if (!signal.aborted)
        set((s) =>
          s.status.kind === 'working' ? { status: { ...s.status, stage: next } } : {},
        );
    };
    const answerId = nextId++;
    try {
      // Reuse a background read that's already going instead of reading twice.
      get().warm(items, opts);
      await warming?.done;
      if (signal.aborted) return;
      const { ask } = await import('@/src/features/ai/ask');
      const answer = await ask(text, history, items, keywordHits, {
        ...opts,
        signal,
        onStage: stage,
        previous,
        // Matches show right away; the chat model's answer fills in after.
        onMatches: (matches) => {
          if (signal.aborted) return;
          set((s) => ({
            messages: [
              ...s.messages,
              { id: answerId, role: 'arca', text: '', matches, pending: true },
            ],
          }));
        },
      });
      if (signal.aborted) return;
      const final: AskMessage = {
        id: answerId,
        role: 'arca',
        text: answer.reply,
        ids: answer.ids,
        matches: answer.matches,
        fromModel: answer.fromModel,
        narrowed: answer.about === 'previous' || undefined,
        reasons: answer.reasons,
      };
      set((s) => ({
        messages: s.messages.some((m) => m.id === answerId)
          ? s.messages.map((m) => (m.id === answerId ? final : m))
          : [...s.messages, final],
        status: { kind: 'idle' },
      }));
    } catch (e) {
      if (signal.aborted || (e instanceof DOMException && e.name === 'AbortError'))
        return;
      set((s) => ({
        // Keep matches already shown; just stop waiting for the model.
        messages: s.messages.map((m) =>
          m.id === answerId ? { ...m, pending: false, fromModel: false } : m,
        ),
        status: { kind: 'idle' },
        error: e instanceof OllamaError ? e : new OllamaError('BAD_RESPONSE', String(e)),
      }));
    } finally {
      if (controller?.signal === signal) controller = null;
    }
  },

  cancel() {
    controller?.abort();
    controller = null;
    set((s) => ({
      // A cancelled answer keeps its matches.
      messages: s.messages.map((m) =>
        m.pending
          ? { ...m, pending: false, text: 'Stopped. These are the matches so far.' }
          : m,
      ),
      status: { kind: 'idle' },
    }));
  },

  clear() {
    controller?.abort();
    controller = null;
    set({ messages: [], status: { kind: 'idle' }, error: null });
  },
}));

useAskChat.subscribe((state, prev) => {
  if (state.messages !== prev.messages) writeSession(state.messages);
});

/** Test helper. */
export function resetAskChat(): void {
  panelOpen = false;
  try {
    sessionStorage.removeItem(SESSION_KEY);
  } catch {
    // ignore
  }
  useAskChat.getState().clear();
  warming?.abort.abort();
  warming = null;
  useAskChat.setState({ index: null });
}
