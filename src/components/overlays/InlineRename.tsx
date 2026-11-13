import { useEffect, useRef, useState } from 'react';
import { renameNode } from '@/src/features/editing/actions';
import { useOverlays } from '@/src/store/overlays';

interface InlineRenameProps {
  id: string;
  initial: string;
  className?: string;
}

/** Text field that replaces a title while renaming. Enter/blur saves, Esc cancels. */
export function InlineRename({ id, initial, className = '' }: InlineRenameProps) {
  const stop = useOverlays((s) => s.stopRename);
  const [value, setValue] = useState(initial);
  const ref = useRef<HTMLInputElement>(null);
  const done = useRef(false);

  useEffect(() => {
    ref.current?.focus();
    ref.current?.select();
  }, []);

  const commit = () => {
    if (done.current) return;
    done.current = true;
    stop();
    const next = value.trim();
    if (next && next !== initial) void renameNode(id, next);
  };

  return (
    <input
      ref={ref}
      aria-label="Name"
      value={value}
      onChange={(e) => setValue(e.target.value)}
      onClick={(e) => e.stopPropagation()}
      onBlur={commit}
      onKeyDown={(e) => {
        e.stopPropagation();
        if (e.key === 'Enter') {
          e.preventDefault();
          commit();
        } else if (e.key === 'Escape') {
          e.preventDefault();
          done.current = true;
          stop();
        }
      }}
      className={`border-accent/50 bg-surface-strong w-full min-w-0 rounded-md border px-1.5 outline-none ${className}`}
    />
  );
}
