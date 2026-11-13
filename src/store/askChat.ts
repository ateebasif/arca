import { create } from 'zustand';
import type { AskItem, AskTurn } from '@/src/features/ai/ask';
import type { EmbedProgress } from '@/src/features/ai/embedTexts';
import { OllamaError } from '@/src/lib/ollama';

/**
 * "Ask Arca" conversation. Lives outside the panel so closing it (or a slow
 * first index) doesn't lose anything. Never persisted.
 */

export interface AskMessage {
  id: number;
  role: 'user' | 'arca';
  text: string;
  /** Bookmark ids the answer points at (arca only). */
  ids?: string[];
  /** False when the chat model failed and these are closest matches only. */
  fromModel?: boolean;
}

export type AskStatus =
  | { kind: 'idle' }
  | {
      kind: 'working';
      stage: 'reading' | 'searching' | 'thinking';
      index?: EmbedProgress;
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
  error: OllamaError | null;
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
let nextId = 1;

export const useAskChat = create<AskChatState>()((set, get) => ({
  messages: [],
  status: { kind: 'idle' },
  error: null,

  async send(question, items, keywordHits, opts) {
    const text = question.trim();
    if (!text || get().status.kind === 'working') return;
    const history: AskTurn[] = get().messages.map((m) => ({
      role: m.role,
      text: m.text,
    }));
    controller = new AbortController();
    const signal = controller.signal;
    const startedAt = Date.now();
    set((s) => ({
      messages: [...s.messages, { id: nextId++, role: 'user', text }],
      status: { kind: 'working', stage: 'reading', startedAt },
      error: null,
    }));
    const update = (patch: Partial<Extract<AskStatus, { kind: 'working' }>>) => {
      if (signal.aborted) return;
      set((s) =>
        s.status.kind === 'working' ? { status: { ...s.status, ...patch } } : {},
      );
    };
    try {
      // Loaded on first question, keeping New Tab light.
      const { ask } = await import('@/src/features/ai/ask');
      const answer = await ask(text, history, items, keywordHits, {
        ...opts,
        signal,
        onIndexProgress: (index) => update({ index }),
        onStage: (stage) => update({ stage }),
      });
      if (signal.aborted) return;
      set((s) => ({
        messages: [
          ...s.messages,
          {
            id: nextId++,
            role: 'arca',
            text: answer.reply,
            ids: answer.ids,
            fromModel: answer.fromModel,
          },
        ],
        status: { kind: 'idle' },
      }));
    } catch (e) {
      if (signal.aborted || (e instanceof DOMException && e.name === 'AbortError'))
        return;
      set({
        status: { kind: 'idle' },
        error: e instanceof OllamaError ? e : new OllamaError('BAD_RESPONSE', String(e)),
      });
    } finally {
      if (controller?.signal === signal) controller = null;
    }
  },

  cancel() {
    controller?.abort();
    controller = null;
    set({ status: { kind: 'idle' } });
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
}
