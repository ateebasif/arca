import { useState } from 'react';
import type { OllamaError } from '@/src/lib/ollama';
import { extensionId } from '@/src/lib/permissions';

/** Explains an Ollama connection problem, with the exact fix when we know it. */
export function OllamaHelp({ error }: { error: OllamaError }) {
  const [copied, setCopied] = useState(false);
  const command = `launchctl setenv OLLAMA_ORIGINS "chrome-extension://${extensionId()}"`;
  return (
    <div
      role="alert"
      className="border-line bg-surface rounded-lg border p-3 text-xs leading-relaxed"
    >
      <p className="text-ink font-medium">{error.message}</p>
      {error.reason === 'UNREACHABLE' && (
        <p className="text-ink-muted mt-1">
          Open the Ollama app (or run <code>ollama serve</code>) and try again.
        </p>
      )}
      {error.reason === 'FORBIDDEN' && error.message.startsWith('Ollama') && (
        <>
          <p className="text-ink-muted mt-1">
            Ollama only accepts requests from apps it trusts. Allow Arca (only Arca) by
            running this in Terminal, then quit and reopen Ollama:
          </p>
          <div className="mt-2 flex items-center gap-2">
            <code className="bg-hover min-w-0 flex-1 truncate rounded px-2 py-1 font-mono text-[11px]">
              {command}
            </code>
            <button
              type="button"
              className="text-accent shrink-0 hover:underline"
              onClick={() =>
                void navigator.clipboard?.writeText(command).then(() => setCopied(true))
              }
            >
              {copied ? 'Copied' : 'Copy'}
            </button>
          </div>
        </>
      )}
      {error.reason === 'MODEL' && (
        <p className="text-ink-muted mt-1">
          Pick installed models in Settings → Local AI.
        </p>
      )}
    </div>
  );
}
