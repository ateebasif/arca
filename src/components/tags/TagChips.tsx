import { tagStyle } from '@/src/features/tags/style';

/** Small read-only tag pills (for tiles, rows and cards). */
export function TagChips({
  tags,
  max = 3,
  className = '',
}: {
  tags: readonly string[];
  max?: number;
  className?: string;
}) {
  if (tags.length === 0) return null;
  const shown = tags.slice(0, max);
  return (
    <span className={`flex min-w-0 flex-wrap items-center gap-1 ${className}`} data-tags>
      {shown.map((tag) => (
        <span
          key={tag}
          style={tagStyle(tag)}
          className="max-w-32 truncate rounded-full px-1.5 py-px text-[10px] leading-4 font-medium"
        >
          #{tag}
        </span>
      ))}
      {tags.length > max && (
        <span className="text-ink-faint text-[10px]">+{tags.length - max}</span>
      )}
    </span>
  );
}
