/**
 * Minimal client for a LOCAL Ollama server (https://ollama.com).
 * - Only loopback hosts are allowed (localhost, 127.0.0.1, [::1]): bookmark
 *   titles never go to another machine.
 * - No credentials, timeouts on every call, responses validated.
 */

export const DEFAULT_OLLAMA_URL = 'http://localhost:11434';

/**
 * Keep models loaded between questions (Ollama unloads after 5 minutes by
 * default, and reloading a 4 GB model adds seconds to the next answer).
 */
const KEEP_ALIVE = '30m';
const LOOPBACK = new Set(['localhost', '127.0.0.1', '[::1]']);

export type OllamaErrorCode =
  'NOT_LOCAL' | 'UNREACHABLE' | 'FORBIDDEN' | 'MODEL' | 'BAD_RESPONSE';

export class OllamaError extends Error {
  constructor(
    readonly reason: OllamaErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'OllamaError';
  }
}

/** Normalized base URL if it points at this machine, else null. */
export function localOllamaUrl(raw: string): string | null {
  try {
    const url = new URL(raw.trim() || DEFAULT_OLLAMA_URL);
    if (!/^https?:$/.test(url.protocol) || !LOOPBACK.has(url.hostname)) return null;
    if (url.username || url.password) return null;
    return `${url.protocol}//${url.host}`;
  } catch {
    return null;
  }
}

/** Origin pattern for host permissions, e.g. "http://localhost:11434/*". */
export function originPattern(base: string): string {
  return `${base}/*`;
}

async function call<T>(
  base: string,
  path: string,
  init: RequestInit & { timeoutMs: number },
): Promise<T> {
  const root = localOllamaUrl(base);
  if (!root)
    throw new OllamaError('NOT_LOCAL', 'Ollama must run on this computer (localhost).');
  let res: Response;
  try {
    res = await fetch(`${root}${path}`, {
      ...init,
      credentials: 'omit',
      referrerPolicy: 'no-referrer',
      signal: AbortSignal.timeout(init.timeoutMs),
      headers: { 'Content-Type': 'application/json' },
    });
  } catch {
    throw new OllamaError('UNREACHABLE', `Can't reach Ollama at ${root}. Is it running?`);
  }
  if (res.status === 403) {
    throw new OllamaError('FORBIDDEN', 'Ollama refused the request from this extension.');
  }
  if (res.status === 404) throw new OllamaError('MODEL', 'Model not found in Ollama.');
  if (!res.ok)
    throw new OllamaError('BAD_RESPONSE', `Ollama returned HTTP ${res.status}.`);
  try {
    return (await res.json()) as T;
  } catch {
    throw new OllamaError('BAD_RESPONSE', 'Ollama sent something that is not JSON.');
  }
}

export interface OllamaModel {
  name: string;
  size: number;
  family: string;
}

export async function listModels(base: string): Promise<OllamaModel[]> {
  const data = await call<{ models?: unknown }>(base, '/api/tags', {
    method: 'GET',
    timeoutMs: 4000,
  });
  if (!Array.isArray(data.models)) return [];
  return data.models
    .map((m: Record<string, unknown>) => ({
      name: typeof m.name === 'string' ? m.name : '',
      size: typeof m.size === 'number' ? m.size : 0,
      family:
        typeof (m.details as Record<string, unknown> | undefined)?.family === 'string'
          ? String((m.details as Record<string, unknown>).family)
          : '',
    }))
    .filter((m) => m.name.length > 0 && m.name.length < 200);
}

/**
 * Checks that Ollama accepts requests from this extension. Listing models is
 * a GET, which browsers send without an Origin header, so it succeeds even
 * when OLLAMA_ORIGINS doesn't allow Arca; the real work is POST, which does
 * carry the origin. This cheap POST surfaces that 403 up front.
 */
export async function checkAccess(base: string, model: string): Promise<void> {
  try {
    await call(base, '/api/show', {
      method: 'POST',
      body: JSON.stringify({ model }),
      timeoutMs: 4000,
    });
  } catch (e) {
    // A missing model still proves the request got through.
    if (!(e instanceof OllamaError && e.reason === 'MODEL')) throw e;
  }
}

/** True for models meant for embeddings (by name or family). */
export const isEmbeddingModel = (m: OllamaModel) =>
  /embed|bert|nomic|mxbai|bge|e5/i.test(`${m.name} ${m.family}`);

/** Embeds a batch of texts. Returns one vector per input, in order. */
export async function embed(
  base: string,
  model: string,
  input: string[],
): Promise<number[][]> {
  const data = await call<{ embeddings?: unknown }>(base, '/api/embed', {
    method: 'POST',
    body: JSON.stringify({ model, input, truncate: true, keep_alive: KEEP_ALIVE }),
    timeoutMs: 120_000,
  });
  const vectors = data.embeddings;
  if (
    !Array.isArray(vectors) ||
    vectors.length !== input.length ||
    !vectors.every(
      (v) => Array.isArray(v) && v.length > 0 && v.every((x) => typeof x === 'number'),
    )
  ) {
    throw new OllamaError('BAD_RESPONSE', 'Unexpected embedding response from Ollama.');
  }
  return vectors as number[][];
}

/**
 * One chat turn with JSON output constrained by `schema` (Ollama structured
 * outputs). Returns the parsed object; the caller validates its fields.
 */
export async function chatJson(
  base: string,
  model: string,
  system: string,
  user: string,
  schema: object,
): Promise<unknown> {
  const data = await call<{ message?: { content?: unknown } }>(base, '/api/chat', {
    method: 'POST',
    body: JSON.stringify({
      model,
      stream: false,
      format: schema,
      keep_alive: KEEP_ALIVE,
      // Short JSON answers only; stops a model that rambles from taking minutes.
      options: { temperature: 0.2, num_predict: 400 },
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
    }),
    timeoutMs: 90_000,
  });
  const content = data.message?.content;
  if (typeof content !== 'string')
    throw new OllamaError('BAD_RESPONSE', 'Empty reply from Ollama.');
  try {
    return JSON.parse(content);
  } catch {
    throw new OllamaError('BAD_RESPONSE', 'Ollama reply was not valid JSON.');
  }
}
