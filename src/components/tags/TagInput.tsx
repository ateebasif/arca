import { useId, useMemo, useState, type KeyboardEvent } from 'react';
import { cleanTag } from '@/src/features/tags/meta';
import { CloseIcon } from '../icons';
import { tagStyle } from '@/src/features/tags/style';

/**
 * Tag editor: type a tag and press Enter or comma; Backspace on an empty field
 * removes the last one. Suggests tags already used elsewhere.
 */
export function TagInput({
  value,
  onChange,
  suggestions,
}: {
  value: string[];
  onChange(tags: string[]): void;
  suggestions: readonly string[];
}) {
  const [draft, setDraft] = useState('');
  const listId = useId();
  const add = (raw: string) => {
    const tag = cleanTag(raw);
    if (tag && !value.includes(tag) && value.length < 20) onChange([...value, tag]);
    setDraft('');
  };
  const matches = useMemo(() => {
    const q = cleanTag(draft);
    return suggestions
      .filter((t) => !value.includes(t) && (!q || t.includes(q)))
      .slice(0, 6);
  }, [draft, suggestions, value]);

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if ((e.key === 'Enter' || e.key === ',') && draft.trim()) {
      e.preventDefault();
      add(draft);
    } else if (e.key === 'Backspace' && !draft && value.length) {
      onChange(value.slice(0, -1));
    }
  };

  return (
    <div>
      <div className="border-line bg-surface focus-within:border-accent/60 flex min-h-9 flex-wrap items-center gap-1 rounded-lg border px-2 py-1">
        {value.map((tag) => (
          <span
            key={tag}
            style={tagStyle(tag)}
            className="flex items-center gap-0.5 rounded-full py-0.5 pr-1 pl-2 text-xs font-medium"
          >
            #{tag}
            <button
              type="button"
              aria-label={`Remove tag ${tag}`}
              className="rounded-full p-0.5 opacity-70 hover:opacity-100"
              onClick={() => onChange(value.filter((t) => t !== tag))}
            >
              <CloseIcon width={10} height={10} />
            </button>
          </span>
        ))}
        <input
          aria-label="Add tag"
          list={listId}
          className="min-w-24 flex-1 bg-transparent py-1 text-[13px] outline-none"
          placeholder={value.length ? '' : 'Add tags, e.g. work, read-later'}
          value={draft}
          maxLength={40}
          onChange={(e) => {
            const v = e.target.value;
            // Picking a suggestion (or typing a comma) adds it right away.
            if (v.endsWith(',') || suggestions.includes(v)) add(v);
            else setDraft(v);
          }}
          onKeyDown={onKeyDown}
          onBlur={() => draft.trim() && add(draft)}
        />
        <datalist id={listId}>
          {matches.map((t) => (
            <option key={t} value={t} />
          ))}
        </datalist>
      </div>
      {matches.length > 0 && !draft && value.length === 0 && (
        <div className="mt-1.5 flex flex-wrap gap-1">
          {matches.map((t) => (
            <button
              key={t}
              type="button"
              style={tagStyle(t)}
              className="rounded-full px-2 py-0.5 text-[11px] opacity-80 hover:opacity-100"
              onClick={() => add(t)}
            >
              #{t}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
