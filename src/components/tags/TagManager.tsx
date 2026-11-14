import { useMemo, useState } from 'react';
import { cleanTag } from '@/src/features/tags/meta';
import { deleteTag, lookAlikes, mergeTags, renameTag } from '@/src/features/tags/manage';
import { TAG_COLOR_NAMES, TAG_HUES, tagSlot, tagStyle } from '@/src/features/tags/style';
import { useOverlays } from '@/src/store/overlays';
import { getMetaStore, useMeta } from '@/src/store/useMeta';
import { useUi } from '@/src/store/ui';
import { CloseIcon, SearchIcon } from '../icons';
import { Button, Dialog, inputClass } from '../overlays/Dialog';

/**
 * Tag manager: rename, merge, recolour and delete tags across all bookmarks.
 * Every change is one undo (toast or ⌘Z).
 */
export default function TagManager() {
  const close = () => useOverlays.getState().setTagManagerOpen(false);
  const meta = useMeta();
  const [query, setQuery] = useState('');
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [palette, setPalette] = useState<string | null>(null);
  const [target, setTarget] = useState('');

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const all = useMemo(() => getMetaStore().allTags(), [meta.version]);
  const exists = useMemo(() => new Set(all.map((t) => t.tag)), [all]);
  const similar = useMemo(() => lookAlikes(all), [all]);
  const q = cleanTag(query);
  const shown = q ? all.filter((t) => t.tag.includes(q)) : all;
  const picked = [...checked].filter((t) => exists.has(t));

  const commitRename = async (from: string) => {
    const to = cleanTag(draft);
    setEditing(null);
    if (to && to !== from) await renameTag(from, to);
  };

  const toggle = (tag: string, on: boolean) =>
    setChecked((s) => {
      const next = new Set(s);
      if (on) next.add(tag);
      else next.delete(tag);
      return next;
    });

  return (
    <Dialog
      wide
      title="Manage tags"
      onClose={close}
      footer={<Button onClick={close}>Done</Button>}
    >
      {all.length === 0 ? (
        <p className="text-ink-muted py-10 text-center text-[13px]">
          No tags yet. Add them in a bookmark's Edit dialog, with multi-select, or let AI
          organize tag links with their folder name.
        </p>
      ) : (
        <div className="flex flex-col gap-3">
          <div className="border-line bg-surface flex h-9 items-center gap-2 rounded-lg border px-2.5">
            <SearchIcon className="text-ink-faint shrink-0" width={14} height={14} />
            <input
              aria-label="Find a tag"
              placeholder={`Find among ${all.length} tags…`}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="placeholder:text-ink-faint min-w-0 flex-1 bg-transparent text-[13px] outline-none"
            />
          </div>

          {similar.length > 0 && !q && (
            <section
              aria-label="Look-alike tags"
              className="border-line bg-surface flex flex-col gap-1.5 rounded-xl border p-3 text-xs"
            >
              <p className="text-ink font-medium">These look like the same tag</p>
              {similar.slice(0, 6).map((group) => (
                <div key={group.join()} className="flex flex-wrap items-center gap-1.5">
                  {group.map((t) => (
                    <span
                      key={t}
                      style={tagStyle(t, meta.colors)}
                      className="rounded-full px-2 py-0.5"
                    >
                      #{t}
                    </span>
                  ))}
                  <button
                    type="button"
                    onClick={() => void mergeTags(group.slice(1), group[0] ?? '')}
                    className="text-accent ml-auto hover:underline"
                  >
                    Merge into #{group[0]}
                  </button>
                </div>
              ))}
            </section>
          )}

          {picked.length >= 2 && (
            <div className="bg-accent-soft flex flex-wrap items-center gap-2 rounded-xl p-2.5 text-xs">
              <span className="text-ink font-medium">
                Merge {picked.length} tags into
              </span>
              <input
                aria-label="Merged tag name"
                list="arca-merge-targets"
                className={`${inputClass} h-8 w-48`}
                placeholder={picked[0]}
                value={target}
                onChange={(e) => setTarget(e.target.value)}
              />
              <datalist id="arca-merge-targets">
                {picked.map((t) => (
                  <option key={t} value={t} />
                ))}
              </datalist>
              <Button
                variant="primary"
                onClick={() => {
                  const to = cleanTag(target) || picked[0] || '';
                  void mergeTags(picked, to).then(() => {
                    setChecked(new Set());
                    setTarget('');
                  });
                }}
              >
                Merge
              </Button>
              <button
                type="button"
                className="text-ink-muted hover:text-ink ml-auto"
                onClick={() => setChecked(new Set())}
              >
                Clear
              </button>
            </div>
          )}

          <ul aria-label="Tags" className="border-line flex flex-col rounded-xl border">
            {shown.map(({ tag, count }) => (
              <li
                key={tag}
                className="border-line border-b last:border-b-0"
                data-tag-row={tag}
              >
                <div className="flex h-11 items-center gap-2.5 px-3">
                  <input
                    type="checkbox"
                    aria-label={`Select #${tag}`}
                    className="accent-accent"
                    checked={checked.has(tag)}
                    onChange={(e) => toggle(tag, e.target.checked)}
                  />
                  <button
                    type="button"
                    aria-label={`Colour of #${tag}`}
                    aria-expanded={palette === tag}
                    onClick={() => setPalette(palette === tag ? null : tag)}
                    className="size-4 shrink-0 rounded-full ring-1 ring-white/20"
                    style={{
                      backgroundColor: `hsl(${TAG_HUES[tagSlot(tag, meta.colors)]} 70% 60%)`,
                    }}
                  />
                  {editing === tag ? (
                    <input
                      autoFocus
                      aria-label={`Rename #${tag}`}
                      className={`${inputClass} h-8 flex-1`}
                      value={draft}
                      onChange={(e) => setDraft(e.target.value)}
                      onBlur={() => void commitRename(tag)}
                      onKeyDown={(e) => {
                        e.stopPropagation();
                        if (e.key === 'Enter') void commitRename(tag);
                        if (e.key === 'Escape') setEditing(null);
                      }}
                    />
                  ) : (
                    <button
                      type="button"
                      title="Rename"
                      onClick={() => {
                        setEditing(tag);
                        setDraft(tag);
                      }}
                      className="min-w-0 flex-1 truncate text-left text-[13px]"
                    >
                      <span
                        style={tagStyle(tag, meta.colors)}
                        className="rounded-full px-2 py-0.5 font-medium"
                      >
                        #{tag}
                      </span>
                    </button>
                  )}
                  {editing === tag &&
                    exists.has(cleanTag(draft)) &&
                    cleanTag(draft) !== tag && (
                      <span className="text-ink-faint shrink-0 text-[11px]">
                        merges into #{cleanTag(draft)}
                      </span>
                    )}
                  <span className="text-ink-faint w-16 shrink-0 text-right text-xs tabular-nums">
                    {count} {count === 1 ? 'item' : 'items'}
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      useUi.getState().setTagFilter(tag);
                      close();
                    }}
                    className="text-ink-muted hover:text-ink hover:bg-hover h-7 shrink-0 rounded-md px-2 text-xs"
                  >
                    View
                  </button>
                  <button
                    type="button"
                    aria-label={`Delete #${tag}`}
                    title="Remove this tag from every item"
                    onClick={() => void deleteTag(tag)}
                    className="text-ink-faint hover:text-danger hover:bg-hover grid size-7 shrink-0 place-items-center rounded-md"
                  >
                    <CloseIcon width={12} height={12} />
                  </button>
                </div>
                {palette === tag && (
                  <div
                    className="flex items-center gap-1.5 px-3 pb-2.5 pl-12"
                    role="group"
                    aria-label={`Colours for #${tag}`}
                  >
                    {TAG_HUES.map((hue, slot) => (
                      <button
                        key={hue}
                        type="button"
                        aria-label={TAG_COLOR_NAMES[slot]}
                        aria-pressed={tagSlot(tag, meta.colors) === slot}
                        onClick={() => {
                          void getMetaStore().setColor(tag, slot);
                          setPalette(null);
                        }}
                        className={`size-5 rounded-full transition-transform hover:scale-110 ${
                          tagSlot(tag, meta.colors) === slot ? 'ring-2 ring-white/80' : ''
                        }`}
                        style={{ backgroundColor: `hsl(${hue} 70% 60%)` }}
                      />
                    ))}
                  </div>
                )}
              </li>
            ))}
            {shown.length === 0 && (
              <li className="text-ink-muted px-3 py-3 text-xs">
                No tag matches “{query}”.
              </li>
            )}
          </ul>
          <p className="text-ink-faint text-[11px]">
            Click a tag to rename it (renaming to an existing tag merges them). Every
            change can be undone.
          </p>
        </div>
      )}
    </Dialog>
  );
}
