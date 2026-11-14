import { onStorageChange, storageGet, storageSet } from '@/src/lib/storage';
import { onIdRemap } from '../undo/undo';

/**
 * Tags (and, later, notes) for bookmarks and folders, stored in
 * chrome.storage.local as `meta: Record<id, { tags, note?, url }>` (PRD §8.7).
 * `url` is a fallback key: if ids change (import, sync), metadata re-links to
 * the bookmark with the same URL. Validated on every read.
 */

export const META_KEY = 'meta';
const MAX_TAGS = 20;
const MAX_TAG_LENGTH = 32;

export interface Meta {
  tags: string[];
  note?: string;
  url: string;
}

export interface MetaSnapshot {
  readonly byId: ReadonlyMap<string, Meta>;
  /** Colour chosen per tag (0–7); tags without one get a stable default. */
  readonly colors: ReadonlyMap<string, number>;
  readonly version: number;
}

export const COLORS_KEY = 'tagColors';

/** Validates stored tag colours. */
export function parseColors(raw: unknown): Map<string, number> {
  const out = new Map<string, number>();
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return out;
  for (const [tag, hue] of Object.entries(raw).slice(0, 2000)) {
    const t = cleanTag(tag);
    if (t && Number.isInteger(hue) && (hue as number) >= 0 && (hue as number) < 8) {
      out.set(t, hue as number);
    }
  }
  return out;
}

/** Key for spotting look-alike tags: "React.js", "reactjs", "react-js" → "react". */
export function tagStem(tag: string): string {
  return tag
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, '')
    .replace(/js$/, '')
    .replace(/(?<=..)s$/, '');
}

/** One tag: lowercase, trimmed, no control characters, at most 32 characters. */
export function cleanTag(raw: unknown): string {
  if (typeof raw !== 'string') return '';
  let out = '';
  for (const ch of raw.normalize('NFC')) {
    const code = ch.codePointAt(0) ?? 0;
    const hidden =
      code < 0x20 ||
      (code >= 0x7f && code < 0xa0) ||
      (code >= 0x200b && code <= 0x200f) ||
      (code >= 0x202a && code <= 0x202e) ||
      (code >= 0x2066 && code <= 0x2069);
    out += hidden ? ' ' : ch;
  }
  return out
    .trim()
    .replace(/^#+/, '')
    .replace(/[,;]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase()
    .slice(0, MAX_TAG_LENGTH)
    .trim();
}

export function cleanTags(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return [...new Set(raw.map(cleanTag).filter(Boolean))].slice(0, MAX_TAGS);
}

/** Validates stored metadata; anything malformed is dropped. */
export function parseMeta(raw: unknown): Map<string, Meta> {
  const out = new Map<string, Meta>();
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return out;
  for (const [id, value] of Object.entries(raw).slice(0, 50_000)) {
    if (!/^[\w-]{1,64}$/.test(id) || !value || typeof value !== 'object') continue;
    const v = value as Record<string, unknown>;
    const tags = cleanTags(v.tags);
    const note = typeof v.note === 'string' ? v.note.slice(0, 2000) : undefined;
    if (!tags.length && !note) continue;
    out.set(id, {
      tags,
      ...(note ? { note } : {}),
      url: typeof v.url === 'string' ? v.url.slice(0, 4096) : '',
    });
  }
  return out;
}

/** Stable colour slot (0–7) for a tag, so a tag looks the same everywhere. */
export function tagHue(tag: string): number {
  let h = 0;
  for (let i = 0; i < tag.length; i++) h = (h * 31 + tag.charCodeAt(i)) >>> 0;
  return h % 8;
}

type Listener = () => void;

export class MetaStore {
  private snapshot: MetaSnapshot = { byId: new Map(), colors: new Map(), version: 0 };
  private listeners = new Set<Listener>();
  private started: Promise<void> | null = null;
  private offs: Array<() => void> = [];

  getSnapshot = (): MetaSnapshot => this.snapshot;

  subscribe = (listener: Listener): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  start(): Promise<void> {
    this.started ??= (async () => {
      this.replaceColors(parseColors(await storageGet<unknown>(COLORS_KEY, {})));
      this.replace(parseMeta(await storageGet<unknown>(META_KEY, {})));
      this.offs.push(
        onStorageChange<unknown>(COLORS_KEY, (v) => this.replaceColors(parseColors(v))),
      );
      // Other Arca pages (popup, other tabs) edit too.
      this.offs.push(
        onStorageChange<unknown>(META_KEY, (v) => this.replace(parseMeta(v))),
      );
      // Undo recreated a deleted item with a new id: its tags follow.
      this.offs.push(onIdRemap((oldId, newId) => void this.remap(oldId, newId)));
    })();
    return this.started;
  }

  stop(): void {
    this.offs.forEach((off) => off());
    this.offs = [];
    this.started = null;
  }

  private replace(byId: Map<string, Meta>) {
    this.snapshot = { ...this.snapshot, byId, version: this.snapshot.version + 1 };
    this.listeners.forEach((l) => l());
  }

  private replaceColors(colors: Map<string, number>) {
    this.snapshot = { ...this.snapshot, colors, version: this.snapshot.version + 1 };
    this.listeners.forEach((l) => l());
  }

  /** Sets (or clears, with null) a tag's colour. */
  async setColor(tag: string, hue: number | null): Promise<void> {
    const colors = new Map(this.snapshot.colors);
    const t = cleanTag(tag);
    if (hue === null) colors.delete(t);
    else colors.set(t, Math.max(0, Math.min(7, Math.round(hue))));
    this.replaceColors(colors);
    await storageSet(COLORS_KEY, Object.fromEntries(colors));
  }

  /**
   * Applies `change` to every item's tags. Returns the previous entries of the
   * items that changed, so the edit can be undone with `restore`.
   */
  async transformTags(
    change: (tags: readonly string[]) => readonly string[],
  ): Promise<Map<string, Meta>> {
    const before = new Map<string, Meta>();
    const next = new Map(this.snapshot.byId);
    for (const [id, meta] of this.snapshot.byId) {
      const tags = cleanTags(change(meta.tags));
      if (tags.length === meta.tags.length && tags.every((t, i) => t === meta.tags[i]))
        continue;
      before.set(id, meta);
      if (tags.length || meta.note) next.set(id, { ...meta, tags });
      else next.delete(id);
    }
    if (before.size) await this.write(next);
    return before;
  }

  /** Puts back entries returned by transformTags (ids mapped through undo). */
  async restore(
    entries: ReadonlyMap<string, Meta>,
    mapId: (id: string) => string = (id) => id,
  ) {
    const next = new Map(this.snapshot.byId);
    for (const [id, meta] of entries) next.set(mapId(id), meta);
    await this.write(next);
  }

  private writing: Promise<void> = Promise.resolve();

  /**
   * Shows `byId` at once, then stores only what changed, merged into what is
   * in storage now: another Arca page may have written since our last
   * update arrived, and a whole-object write would wipe its edit.
   */
  private write(byId: Map<string, Meta>): Promise<void> {
    const prev = this.snapshot.byId;
    const changed = new Map<string, Meta | null>();
    for (const [id, meta] of byId) if (prev.get(id) !== meta) changed.set(id, meta);
    for (const id of prev.keys()) if (!byId.has(id)) changed.set(id, null);
    this.replace(byId);
    if (!changed.size) return this.writing;
    this.writing = this.writing
      .catch(() => {})
      .then(async () => {
        const stored = parseMeta(await storageGet<unknown>(META_KEY, {}));
        for (const [id, meta] of changed) {
          if (meta) stored.set(id, meta);
          else stored.delete(id);
        }
        await storageSet(META_KEY, Object.fromEntries(stored));
      });
    return this.writing;
  }

  tagsOf(id: string): string[] {
    return this.snapshot.byId.get(id)?.tags ?? [];
  }

  /** Sets an item's tags (url is kept so they can re-link if ids change). */
  async setTags(id: string, url: string, tags: readonly string[]): Promise<void> {
    await this.setTagsMany([{ id, url, tags }]);
  }

  /** Sets tags on many items with a single storage write. */
  async setTagsMany(
    entries: ReadonlyArray<{ id: string; url: string; tags: readonly string[] }>,
  ): Promise<void> {
    const next = new Map(this.snapshot.byId);
    for (const { id, url, tags } of entries) {
      const clean = cleanTags(tags);
      const current = next.get(id);
      if (clean.length || current?.note) {
        next.set(id, { ...current, tags: clean, url: url || current?.url || '' });
      } else {
        next.delete(id);
      }
    }
    await this.write(next);
  }

  private async remap(oldId: string, newId: string) {
    const meta = this.snapshot.byId.get(oldId);
    if (!meta) return;
    const next = new Map(this.snapshot.byId);
    next.delete(oldId);
    next.set(newId, meta);
    await this.write(next);
  }

  /**
   * Re-links metadata whose id no longer exists to the bookmark with the same
   * URL, and drops what matches nothing. `nodes` maps id → url ('' for folders).
   */
  async relink(nodes: ReadonlyMap<string, string>): Promise<void> {
    const byId = this.snapshot.byId;
    let changed = false;
    const next = new Map(byId);
    const byUrl = new Map<string, string>();
    for (const [id, url] of nodes) if (url && !byId.has(id)) byUrl.set(url, id);
    for (const [id, meta] of byId) {
      if (nodes.has(id)) continue;
      next.delete(id);
      changed = true;
      const target = meta.url ? byUrl.get(meta.url) : undefined;
      if (target) {
        next.set(target, meta);
        byUrl.delete(meta.url);
      }
    }
    if (changed) await this.write(next);
  }

  /** Every tag with how many items carry it, most used first. */
  allTags(): Array<{ tag: string; count: number }> {
    const counts = new Map<string, number>();
    for (const meta of this.snapshot.byId.values()) {
      for (const tag of meta.tags) counts.set(tag, (counts.get(tag) ?? 0) + 1);
    }
    return [...counts]
      .map(([tag, count]) => ({ tag, count }))
      .sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag));
  }

  idsWithTag(tag: string): string[] {
    const t = cleanTag(tag);
    return [...this.snapshot.byId]
      .filter(([, m]) => m.tags.includes(t))
      .map(([id]) => id);
  }
}
