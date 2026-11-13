import { useEffect, useRef, useState } from 'react';
import { useOverlays } from '@/src/store/overlays';
import { useBookmarks } from '@/src/store/useBookmarks';
import { useUi } from '@/src/store/ui';
import { FolderIcon, PlusIcon } from '../icons';

/** "+" button with New bookmark / New folder, created in the open folder. */
export function AddMenu() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const state = useBookmarks();
  const folderId = useUi((s) => s.currentFolderId);
  const openEditor = useOverlays((s) => s.openEditor);
  const parentId = state.nodes.get(folderId)?.childIds
    ? folderId
    : (state.rootIds[0] ?? '1');

  useEffect(() => {
    if (!open) return;
    ref.current?.querySelector<HTMLElement>('[role=menuitem]')?.focus();
    const onDown = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener('mousedown', onDown);
    return () => window.removeEventListener('mousedown', onDown);
  }, [open]);

  const create = (kind: 'bookmark' | 'folder') => {
    setOpen(false);
    openEditor({ mode: 'create', kind, parentId });
  };

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-label="Add"
        aria-haspopup="menu"
        aria-expanded={open}
        title="Add bookmark or folder"
        onClick={() => setOpen(!open)}
        className="bg-accent-strong grid size-8 place-items-center rounded-lg text-white transition-opacity duration-150 hover:opacity-90"
      >
        <PlusIcon />
      </button>
      {open && (
        <div
          role="menu"
          aria-label="Add"
          onKeyDown={(e) => {
            const items = [
              ...(ref.current?.querySelectorAll<HTMLElement>('[role=menuitem]') ?? []),
            ];
            const i = items.indexOf(document.activeElement as HTMLElement);
            if (e.key === 'Escape') {
              e.stopPropagation();
              setOpen(false);
            } else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
              e.preventDefault();
              items[
                (i + (e.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length
              ]?.focus();
            }
          }}
          className="animate-pop border-line bg-surface-strong absolute top-10 right-0 z-30 min-w-44 rounded-xl border p-1 shadow-(--shadow-pop) backdrop-blur-xl"
        >
          <MenuItem onClick={() => create('bookmark')} icon={<PlusIcon />}>
            New bookmark
          </MenuItem>
          <MenuItem onClick={() => create('folder')} icon={<FolderIcon />}>
            New folder
          </MenuItem>
        </div>
      )}
    </div>
  );
}

function MenuItem({
  onClick,
  icon,
  children,
}: {
  onClick(): void;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      role="menuitem"
      tabIndex={-1}
      onClick={onClick}
      className="hover:bg-hover focus:bg-hover flex h-8 w-full items-center gap-2 rounded-lg px-2.5 text-left text-[13px] outline-none"
    >
      <span className="text-ink-muted">{icon}</span>
      {children}
    </button>
  );
}
