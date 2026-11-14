import { useEffect, useSyncExternalStore } from 'react';
import { useSettings } from '@/src/store/settings';
import { useUi } from '@/src/store/ui';

/**
 * Light front end for list-view descriptions: rows ask for theirs, requests
 * are batched, and the heavy module (Ollama, IndexedDB, preview cache) loads
 * only once descriptions are actually needed.
 */

const known = new Map<string, string>();
const queued = new Map<string, { title: string; url: string }>();
const inFlight = new Set<string>();
const listeners = new Set<() => void>();
let version = 0;
let timer: ReturnType<typeof setTimeout> | null = null;
let running = false;

const emit = () => {
  version++;
  listeners.forEach((l) => l());
};

export const descKey = (id: string, title: string, url: string) =>
  `${id}\n${title}\n${url}`;

async function flush() {
  timer = null;
  if (running || queued.size === 0) return;
  running = true;
  try {
    const s = useSettings.getState();
    // One model call's worth at a time, so rows fill in as each batch lands.
    const requests = [...queued].slice(0, 12).map(([key, v]) => ({ key, ...v }));
    requests.forEach((r) => {
      queued.delete(r.key);
      inFlight.add(r.key);
    });
    const { describe } = await import('./describe');
    const result = await describe(requests, {
      base: s.ollamaUrl,
      chatModel: s.askModel || s.chatModel,
      previews: s.linkPreviews,
    });
    for (const r of requests) {
      known.set(r.key, result.get(r.key) ?? '');
      inFlight.delete(r.key);
    }
    emit();
  } finally {
    running = false;
    if (queued.size) timer = setTimeout(() => void flush(), 50);
  }
}

function request(key: string, title: string, url: string) {
  if (known.has(key) || inFlight.has(key) || queued.has(key)) return;
  queued.set(key, { title, url });
  timer ??= setTimeout(() => void flush(), 150);
}

/** Whether list rows should show descriptions (and make room for them). */
export function useDescriptionsOn(): boolean {
  const ai = useSettings((s) => s.aiEnabled && s.aiDescriptions);
  const list = useUi((s) => s.view === 'list');
  return ai && list;
}

/** A row's description: undefined while loading, '' when there isn't one. */
export function useDescription(
  id: string,
  title: string,
  url: string,
): string | undefined {
  const on = useDescriptionsOn();
  const key = descKey(id, title, url);
  useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => version,
  );
  useEffect(() => {
    if (on && /^https?:/i.test(url)) request(key, title, url);
  }, [on, key, title, url]);
  return on ? known.get(key) : undefined;
}

/** After "Clear cached AI data". */
export function forgetDescriptions(): void {
  known.clear();
  emit();
}
