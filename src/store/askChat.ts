import { create } from 'zustand';
import type { AskItem, AskTurn } from '@/src/features/ai/ask';
import type { EmbedProgress } from '@/src/features/ai/embedTexts';
import { OllamaError } from '@/src/lib/ollama';

/**
 * "Ask Arca" conversation. Lives outside the panel so closing it (or a slow
 * first read) doesn't lose anything. Never persisted.
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
  send(
    question: string,
    items: AskItem[],
    keywordHits: number[],
    opts: AskSendOptions,
  ): Promise<void>;
  cancel(): void;
  clear(): void;
}

let controller: AbortController | null = null;
let warming: { key: string; done: Promise<void>; abort: AbortController } | null = null;
let nextId = 1;

const warmKey = (items: AskItem[], opts: AskSendOptions) =>
  `${opts.base}|${opts.embedModel}|${items.length}`;

export const useAskChat = create<AskChatState>()((set, get) => ({
  messages: [],
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
      const { indexDocs } = await import('@/src/features/ai/ask');
      await indexDocs(items, {
        ...opts,
        signal: abort.signal,
        onIndexProgress: (p) => {
          if (abort.signal.aborted) return;
          set({ index: p.done < p.total ? { ...p, startedAt } : null });
        },
      });
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

  async send(question, items, keywordHits, opts) {
    const text = question.trim();
    if (!text || get().status.kind === 'working') return;
    const history: AskTurn[] = get().messages.map((m) => ({
      role: m.role,
      text: m.text,
    }));
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

/** Test helper. */
export function resetAskChat(): void {
  useAskChat.getState().clear();
  warming?.abort.abort();
  warming = null;
  useAskChat.setState({ index: null });
}
