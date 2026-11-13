import { useEffect, useState } from 'react';
import { hasOrigin, requestOrigin } from '@/src/lib/permissions';
import {
  isEmbeddingModel,
  listModels,
  localOllamaUrl,
  originPattern,
  OllamaError,
  type OllamaModel,
} from '@/src/lib/ollama';
import { useSettings } from '@/src/store/settings';
import { inputClass } from '../overlays/Dialog';
import { OllamaHelp } from './OllamaHelp';

type Status =
  | { kind: 'idle' }
  | { kind: 'checking' }
  | { kind: 'ok'; models: OllamaModel[] }
  | { kind: 'error'; error: OllamaError };

/** Settings → Local AI. Everything stays on this computer (localhost only). */
export function AiSettings() {
  const s = useSettings();
  const [url, setUrl] = useState(s.ollamaUrl);
  const [status, setStatus] = useState<Status>({ kind: 'idle' });

  const check = async (base = s.ollamaUrl) => {
    setStatus({ kind: 'checking' });
    try {
      setStatus({ kind: 'ok', models: await listModels(base) });
    } catch (e) {
      setStatus({
        kind: 'error',
        error: e instanceof OllamaError ? e : new OllamaError('UNREACHABLE', String(e)),
      });
    }
  };

  useEffect(() => {
    if (s.aiEnabled)
      void hasOrigin(originPattern(s.ollamaUrl)).then((ok) => ok && void check());
    // Only on open.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const toggle = async () => {
    if (s.aiEnabled) {
      await s.update({ aiEnabled: false });
      setStatus({ kind: 'idle' });
      return;
    }
    const base = localOllamaUrl(url);
    if (!base) {
      setStatus({
        kind: 'error',
        error: new OllamaError('NOT_LOCAL', 'Use a localhost address.'),
      });
      return;
    }
    // Inside the click, so the browser can show its prompt.
    const granted = await requestOrigin(originPattern(base)).catch(() => false);
    if (!granted) {
      setStatus({
        kind: 'error',
        error: new OllamaError(
          'FORBIDDEN',
          'Arca needs permission to talk to Ollama on this computer.',
        ),
      });
      return;
    }
    await s.update({ aiEnabled: true, ollamaUrl: base });
    await check(base);
  };

  const models = status.kind === 'ok' ? status.models : [];
  const embedders = models.filter(isEmbeddingModel);
  const chatters = models.filter((m) => !isEmbeddingModel(m));
  const pick = (list: OllamaModel[], current: string) =>
    list.some((m) => m.name === current) ? current : (list[0]?.name ?? current);

  return (
    <div className="border-line mt-4 border-t pt-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p id="ai-label" className="text-[13px] font-medium">
            Local AI (Ollama)
          </p>
          <p className="text-ink-muted mt-0.5 text-xs leading-relaxed">
            Powers “AI organize” in Tidy up. Uses Ollama running on this computer;
            bookmark titles never leave it.
          </p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={s.aiEnabled}
          aria-labelledby="ai-label"
          onClick={() => void toggle()}
          className={`relative mt-0.5 h-5 w-9 shrink-0 rounded-full transition-colors duration-150 ${
            s.aiEnabled ? 'bg-accent-strong' : 'bg-line'
          }`}
        >
          <span
            className={`absolute top-0.5 left-0.5 size-4 rounded-full bg-white shadow transition-transform duration-150 ${
              s.aiEnabled ? 'translate-x-4' : ''
            }`}
          />
        </button>
      </div>

      <label className="mt-3 block">
        <span className="text-ink-muted mb-1 block text-xs font-medium">
          Ollama address
        </span>
        <input
          className={inputClass}
          value={url}
          spellCheck={false}
          disabled={s.aiEnabled}
          onChange={(e) => setUrl(e.target.value)}
        />
      </label>

      {s.aiEnabled && (
        <div className="mt-3 flex flex-col gap-2">
          <div className="flex items-center gap-2 text-xs" role="status">
            {status.kind === 'checking' && (
              <span className="text-ink-muted">Connecting…</span>
            )}
            {status.kind === 'ok' && (
              <span className="text-ink-muted">
                <span className="text-accent">●</span> Connected · {models.length} models
              </span>
            )}
            <button
              type="button"
              onClick={() => void check()}
              className="text-accent ml-auto rounded px-1 hover:underline"
            >
              Test connection
            </button>
          </div>
          {status.kind === 'error' && <OllamaHelp error={status.error} />}
          {status.kind === 'ok' && (
            <div className="grid grid-cols-2 gap-2">
              <ModelSelect
                label="Grouping model (embeddings)"
                value={pick(embedders, s.embedModel)}
                models={embedders.length ? embedders : models}
                onChange={(embedModel) => void s.update({ embedModel })}
                hint="Recommended: nomic-embed-text"
              />
              <ModelSelect
                label="Naming model"
                value={pick(chatters, s.chatModel)}
                models={chatters.length ? chatters : models}
                onChange={(chatModel) => void s.update({ chatModel })}
                hint="Recommended: llama3.2"
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function ModelSelect({
  label,
  value,
  models,
  onChange,
  hint,
}: {
  label: string;
  value: string;
  models: OllamaModel[];
  onChange(name: string): void;
  hint: string;
}) {
  return (
    <label className="block">
      <span className="text-ink-muted mb-1 block text-xs font-medium">{label}</span>
      <select
        className={inputClass}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        {models.map((m) => (
          <option key={m.name} value={m.name}>
            {m.name} ({(m.size / 1e9).toFixed(1)} GB)
          </option>
        ))}
      </select>
      <span className="text-ink-faint mt-1 block text-[11px]">{hint}</span>
    </label>
  );
}
