import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { askItems, keywordHits } from '@/src/features/ai/askItems';
import { estimateSeconds } from '@/src/features/ai/organize';
import { bookmarkLinkProps } from '@/src/features/open';
import { compactPath } from '@/src/features/tidy/normalize';
import { displayHost } from '@/src/lib/url';
import { useAskChat, type AskMessage } from '@/src/store/askChat';
import type { BookmarkSnapshot } from '@/src/store/bookmarkStore';
import { useOverlays } from '@/src/store/overlays';
import { useSettings } from '@/src/store/settings';
import { useBookmarks } from '@/src/store/useBookmarks';
import { useUi } from '@/src/store/ui';
import { FolderIcon, SparkleIcon } from '../icons';
import { Favicon } from '../main/Favicon';
import { Button, Dialog, inputClass } from '../overlays/Dialog';
import { OllamaHelp } from './OllamaHelp';

const EXAMPLES = [
  'I had some torrent sites saved somewhere',
  'that article about React effects',
  'Mac apps I wanted to try',
  'design inspiration I saved last year',
];

/** "Ask Arca": find bookmarks by describing them, using local Ollama models. */
export default function AskPanel() {
  const state = useBookmarks();
  const settings = useSettings();
  const draft = useOverlays((s) => s.ask?.draft ?? '');
  const close = useOverlays((s) => s.closeAsk);
  const { messages, status, error, send, cancel, clear } = useAskChat();
  const [text, setText] = useState(draft);
  const items = useMemo(() => askItems(state), [state]);
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const working = status.kind === 'working';

  useEffect(() => {
    listRef.current?.scrollTo?.({ top: listRef.current.scrollHeight });
  }, [messages.length, working]);

  const submit = (question: string) => {
    if (!question.trim() || working) return;
    setText('');
    void send(question, items, keywordHits(state, items, question), {
      base: settings.ollamaUrl,
      embedModel: settings.embedModel,
      chatModel: settings.chatModel,
    });
    inputRef.current?.focus();
  };

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    submit(text);
  };

  return (
    <Dialog
      wide
      title="Ask Arca"
      onClose={close}
      footer={
        <>
          {messages.length > 0 && <Button onClick={clear}>Clear chat</Button>}
          <Button onClick={close}>Done</Button>
        </>
      }
    >
      {!settings.aiEnabled ? (
        <div className="py-8 text-center text-[13px]">
          <p className="font-medium">Find bookmarks by describing them</p>
          <p className="text-ink-muted mx-auto mt-1 max-w-md text-xs leading-relaxed">
            Uses Ollama on this computer to understand what you mean, then points at your
            real bookmarks. Nothing leaves your machine.
          </p>
          <div className="mt-4">
            <Button
              variant="primary"
              onClick={() => useOverlays.getState().openSettings()}
            >
              Set up in Settings
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex min-h-[320px] flex-col gap-3">
          <div ref={listRef} className="flex flex-col gap-4" aria-live="polite">
            {messages.length === 0 && (
              <Intro
                count={items.length}
                model={settings.embedModel}
                onPick={(q) => submit(q)}
              />
            )}
            {messages.map((m) =>
              m.role === 'user' ? (
                <p
                  key={m.id}
                  className="bg-accent-strong/90 max-w-[80%] self-end rounded-2xl rounded-br-md px-3.5 py-2 text-[13px] text-white"
                >
                  {m.text}
                </p>
              ) : (
                <Answer key={m.id} message={m} state={state} onReveal={close} />
              ),
            )}
            {working && (
              <Working status={status} model={settings.chatModel} onCancel={cancel} />
            )}
            {error && <OllamaHelp error={error} />}
          </div>

          <form onSubmit={onSubmit} className="mt-auto flex gap-2 pt-1">
            <input
              ref={inputRef}
              autoFocus
              aria-label="Ask Arca"
              className={`${inputClass} flex-1`}
              placeholder={
                messages.length
                  ? 'Ask a follow-up, e.g. “only the movie ones”'
                  : 'Describe what you remember…'
              }
              value={text}
              maxLength={500}
              onChange={(e) => setText(e.target.value)}
            />
            <Button variant="primary" type="submit" disabled={!text.trim() || working}>
              Ask
            </Button>
          </form>
        </div>
      )}
    </Dialog>
  );
}

function Intro({
  count,
  model,
  onPick,
}: {
  count: number;
  model: string;
  onPick(question: string): void;
}) {
  const minutes = Math.round(estimateSeconds(model, count) / 60);
  return (
    <div className="text-ink-muted flex flex-col gap-3 text-[13px] leading-relaxed">
      <p className="flex items-start gap-2">
        <SparkleIcon className="text-accent mt-0.5 shrink-0" />
        <span>
          Describe a bookmark the way you remember it, even vaguely. Arca searches all{' '}
          {count.toLocaleString()} of your links by meaning and shows the ones that fit.
          Everything runs on this computer.
        </span>
      </p>
      {minutes >= 1 && (
        <p className="text-ink-faint text-xs">
          The first question reads your bookmarks once (about {minutes} min with{' '}
          <code>{model}</code>). After that, answers take a few seconds.
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        {EXAMPLES.map((q) => (
          <button
            key={q}
            type="button"
            onClick={() => onPick(q)}
            className="border-line hover:bg-hover hover:text-ink rounded-full border px-3 py-1 text-xs transition-colors"
          >
            {q}
          </button>
        ))}
      </div>
    </div>
  );
}

function Working({
  status,
  model,
  onCancel,
}: {
  status: Extract<ReturnType<typeof useAskChat.getState>['status'], { kind: 'working' }>;
  model: string;
  onCancel(): void;
}) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  const { index, stage, startedAt } = status;
  const indexing = stage === 'reading' && index && index.done < index.total;
  let label = 'Looking…';
  let detail = '';
  if (indexing && index) {
    label = `Reading your bookmarks once · ${index.done.toLocaleString()}/${index.total.toLocaleString()}`;
    const fresh = index.done - index.cached;
    const elapsed = (now - startedAt) / 1000;
    detail =
      fresh > 0 && elapsed > 2
        ? `about ${Math.max(1, Math.ceil(((index.total - index.done) * elapsed) / fresh / 60))} min left · only needed the first time`
        : 'starting the model…';
  } else if (stage === 'searching') {
    label = 'Searching by meaning…';
  } else if (stage === 'thinking') {
    label = `Picking the best matches with ${model}…`;
  }
  return (
    <div className="flex flex-col gap-1.5 text-xs" role="status">
      <div className="flex items-center gap-3">
        <span
          className="bg-accent size-1.5 shrink-0 animate-pulse rounded-full"
          aria-hidden
        />
        <span className="text-ink-muted flex-1 tabular-nums">{label}</span>
        <Button onClick={onCancel}>Cancel</Button>
      </div>
      {indexing && index && (
        <div className="bg-hover h-1 overflow-hidden rounded-full">
          <div
            className="bg-accent-strong h-full transition-[width] duration-200"
            style={{
              width: `${Math.round((index.done / Math.max(1, index.total)) * 100)}%`,
            }}
          />
        </div>
      )}
      {detail && <p className="text-ink-faint">{detail}</p>}
    </div>
  );
}

function Answer({
  message,
  state,
  onReveal,
}: {
  message: AskMessage;
  state: BookmarkSnapshot;
  onReveal(): void;
}) {
  // Bookmarks may have changed since the answer; show only those that still exist.
  const nodes = (message.ids ?? []).flatMap((id) => {
    const node = state.nodes.get(id);
    return node?.url ? [node] : [];
  });
  return (
    <div className="flex max-w-[92%] flex-col gap-2" data-ask-answer>
      <p className="text-[13px] leading-relaxed">{message.text}</p>
      {nodes.length > 0 && (
        <ul className="border-line bg-surface flex flex-col overflow-hidden rounded-xl border">
          {nodes.map((node) => (
            <ResultRow key={node.id} node={node} state={state} onReveal={onReveal} />
          ))}
        </ul>
      )}
    </div>
  );
}

function ResultRow({
  node,
  state,
  onReveal,
}: {
  node: NonNullable<ReturnType<BookmarkSnapshot['nodes']['get']>>;
  state: BookmarkSnapshot;
  onReveal(): void;
}) {
  const url = node.url ?? '';
  const title = node.title || displayHost(url) || url;
  const link = bookmarkLinkProps(url);
  const path: string[] = [];
  for (let p = node.parentId; p; p = state.nodes.get(p)?.parentId ?? null) {
    const folder = state.nodes.get(p);
    if (!folder || p === '0') break;
    path.unshift(folder.title || 'Untitled');
  }
  return (
    <li className="border-line group flex items-center gap-2 border-b last:border-b-0">
      <a
        href={link.href}
        role={link.role}
        tabIndex={0}
        data-ask-result={node.id}
        title={`${title}\n${url}`}
        onClick={(e) => link.onActivate?.(e)}
        onKeyDown={(e) => e.key === 'Enter' && !link.href && link.onActivate?.(e)}
        className="hover:bg-hover flex min-w-0 flex-1 items-center gap-2.5 px-3 py-2"
      >
        <Favicon url={url} title={title} size={16} />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[13px]">{title}</span>
          <span className="text-ink-faint block truncate text-[11px]">
            {displayHost(url)}
            {path.length > 0 && ` · ${compactPath(path.join(' / '))}`}
          </span>
        </span>
      </a>
      <button
        type="button"
        aria-label={`Show “${title}” in its folder`}
        title="Show in folder"
        className="text-ink-faint hover:text-ink hover:bg-hover mr-2 rounded-md p-1.5 opacity-0 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100 focus:opacity-100"
        onClick={() => {
          if (!node.parentId) return;
          useUi.getState().setQuery('');
          useUi.getState().reveal(node.id, node.parentId);
          onReveal();
        }}
      >
        <FolderIcon />
      </button>
    </li>
  );
}
