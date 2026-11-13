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
            Ollama blocks browser extensions unless you allow them. To allow Arca (only
            Arca):
          </p>
          <ol className="text-ink-muted mt-2 list-decimal space-y-1.5 pl-4">
            <li>
              Copy this command, paste it into Terminal and press Return:
              <div className="mt-1.5 flex items-start gap-2">
                <code className="bg-hover text-ink min-w-0 flex-1 rounded px-2 py-1 font-mono text-[11px] break-all select-all">
                  {command}
                </code>
                <button
                  type="button"
                  className="text-accent shrink-0 py-1 hover:underline"
                  onClick={() =>
                    void navigator.clipboard
                      ?.writeText(command)
                      .then(() => setCopied(true))
                  }
                >
                  {copied ? 'Copied' : 'Copy'}
                </button>
              </div>
            </li>
            <li>
              Quit Ollama from the menu bar (llama icon → Quit Ollama), then open it
              again. Closing its window isn't enough.
            </li>
            <li>Come back here and press Test connection or try again.</li>
          </ol>
          <p className="text-ink-faint mt-2">
            Running <code>ollama serve</code> in Terminal instead? Start it with{' '}
            <code className="break-all">
              OLLAMA_ORIGINS=&quot;chrome-extension://{extensionId()}&quot; ollama serve
            </code>
            . The setting resets when the Mac restarts; run step 1 again if this message
            comes back.
          </p>
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
