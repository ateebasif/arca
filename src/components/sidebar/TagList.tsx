import { useMemo, useState } from 'react';
import { tagStyle } from '@/src/features/tags/style';
import { getMetaStore, useMeta } from '@/src/store/useMeta';
import { useUi } from '@/src/store/ui';
import { ChevronRight } from '../icons';

const SHOW = 12;

/** Sidebar "Tags": every tag with its count; click to see everything tagged. */
export function TagList() {
  const meta = useMeta();
  const active = useUi((s) => s.tagFilter);
  const setTagFilter = useUi((s) => s.setTagFilter);
  const [open, setOpen] = useState(true);
  const [all, setAll] = useState(false);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const tags = useMemo(() => getMetaStore().allTags(), [meta.version]);
  if (tags.length === 0) return null;
  const shown = all ? tags : tags.slice(0, SHOW);
  return (
    <section aria-label="Tags" className="px-2 pb-4">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className="text-ink-faint hover:text-ink-muted flex w-full items-center gap-1 px-2 py-1 text-[11px] font-medium tracking-wide uppercase"
      >
        <ChevronRight
          width={10}
          height={10}
          className={`transition-transform ${open ? 'rotate-90' : ''}`}
        />
        Tags
      </button>
      {open && (
        <ul className="flex flex-col gap-px">
          {shown.map(({ tag, count }) => (
            <li key={tag}>
              <button
                type="button"
                aria-pressed={active === tag}
                onClick={() => setTagFilter(active === tag ? null : tag)}
                className={`flex h-8 w-full items-center gap-2 rounded-lg px-2 text-left text-[13px] transition-colors ${
                  active === tag
                    ? 'bg-hover text-ink'
                    : 'text-ink-muted hover:bg-hover hover:text-ink'
                }`}
              >
                <span
                  style={tagStyle(tag)}
                  className="grid size-4 shrink-0 place-items-center rounded text-[10px] font-semibold"
                  aria-hidden
                >
                  #
                </span>
                <span className="min-w-0 flex-1 truncate">{tag}</span>
                <span className="text-ink-faint text-[11px] tabular-nums">{count}</span>
              </button>
            </li>
          ))}
          {tags.length > SHOW && (
            <li>
              <button
                type="button"
                onClick={() => setAll((a) => !a)}
                className="text-ink-faint hover:text-ink px-2 py-1 text-[11px]"
              >
                {all ? 'Show fewer' : `Show all ${tags.length}`}
              </button>
            </li>
          )}
        </ul>
      )}
    </section>
  );
}
