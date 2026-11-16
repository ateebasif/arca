import { useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent } from 'react';
import { createPortal } from 'react-dom';
import { requestDelete, ungroupFolder } from '@/src/features/editing/actions';
import { defaultDisposition, openSafely } from '@/src/features/open';
import { useOverlays, type MenuState } from '@/src/store/overlays';
import { useBookmarks } from '@/src/store/useBookmarks';
import { useUi } from '@/src/store/ui';
import { LockIcon } from '../icons';

interface Item {
  label: string;
  shortcut?: string;
  danger?: boolean;
  disabled?: boolean;
  run(): void;
}

/** Context menu for a bookmark or folder (⋯ button, right-click or Shift+F10). */
export function ItemMenu({ menu }: { menu: MenuState }) {
  const state = useBookmarks();
  const close = useOverlays((s) => s.closeMenu);
  const openEditor = useOverlays((s) => s.openEditor);
  const startRename = useOverlays((s) => s.startRename);
  const openFolder = useUi((s) => s.openFolder);
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ x: menu.x, y: menu.y });
  const node = state.nodes.get(menu.id);

  // Keep the menu inside the viewport.
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const { width, height } = el.getBoundingClientRect();
    setPos({
      x: Math.max(8, Math.min(menu.x, window.innerWidth - width - 8)),
      y: Math.max(8, Math.min(menu.y, window.innerHeight - height - 8)),
    });
    el.querySelector<HTMLElement>('[role=menuitem]:not([aria-disabled=true])')?.focus();
  }, [menu.x, menu.y]);

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) close();
    };
    window.addEventListener('mousedown', onDown);
    window.addEventListener('blur', close);
    return () => {
      window.removeEventListener('mousedown', onDown);
      window.removeEventListener('blur', close);
    };
  }, [close]);

  if (!node) return null;
  const locked = node.isRoot;
  const isFolder = node.childIds !== null;

  const items: Item[] = [
    ...(isFolder
      ? [{ label: 'Open', run: () => openFolder(node.id) }]
      : [
          { label: 'Open', run: () => void openSafely(node.url, defaultDisposition()) },
          {
            label: 'Open in new tab',
            run: () => void openSafely(node.url, 'new-tab'),
          },
          {
            label: 'Open in mini window',
            run: () => void openSafely(node.url, 'window'),
          },
        ]),
    {
      label: 'Edit…',
      disabled: locked,
      run: () => openEditor({ mode: 'edit', id: node.id }),
    },
    {
      label: 'Rename',
      shortcut: 'F2',
      disabled: locked,
      run: () => startRename(node.id, menu.from),
    },
    ...(isFolder
      ? [
          {
            label: 'Icon…',
            disabled: locked,
            run: () => useOverlays.getState().setIconFor(node.id),
          },
          {
            label: 'Ungroup',
            disabled: locked || (node.childIds?.length ?? 0) === 0,
            run: () => void ungroupFolder(node.id),
          },
        ]
      : []),
    {
      label: 'Delete',
      shortcut: '⌘⌫',
      danger: true,
      disabled: locked,
      run: () => requestDelete(node.id),
    },
  ];

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const buttons = [
      ...(ref.current?.querySelectorAll<HTMLElement>(
        '[role=menuitem]:not([aria-disabled=true])',
      ) ?? []),
    ];
    const index = buttons.indexOf(document.activeElement as HTMLElement);
    if (e.key === 'Escape' || e.key === 'Tab') {
      e.preventDefault();
      e.stopPropagation();
      close();
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      buttons[(index + 1) % buttons.length]?.focus();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      buttons[(index - 1 + buttons.length) % buttons.length]?.focus();
    }
  };

  return createPortal(
    <div
      ref={ref}
      role="menu"
      aria-label={`Actions for ${node.title || 'Untitled'}`}
      onKeyDown={onKeyDown}
      className="animate-pop border-line bg-surface-strong fixed z-40 min-w-48 rounded-xl border p-1 shadow-(--shadow-pop) backdrop-blur-xl"
      style={{ left: pos.x, top: pos.y }}
    >
      {items.map((item) => (
        <button
          key={item.label}
          type="button"
          role="menuitem"
          aria-disabled={item.disabled || undefined}
          tabIndex={-1}
          onClick={() => {
            if (item.disabled) return;
            close();
            item.run();
          }}
          className={`flex h-8 w-full items-center gap-2 rounded-lg px-2.5 text-left text-[13px] outline-none ${
            item.disabled
              ? 'text-ink-faint'
              : `${item.danger ? 'text-danger' : ''} hover:bg-hover focus:bg-hover`
          }`}
        >
          <span className="flex-1">{item.label}</span>
          {item.shortcut && (
            <kbd className="text-ink-faint font-sans text-[11px]">{item.shortcut}</kbd>
          )}
        </button>
      ))}
      {locked && (
        <p className="text-ink-faint flex items-center gap-1.5 px-2.5 pt-1 pb-1.5 text-[11px]">
          <LockIcon width={12} height={12} /> Browser folder — can't be changed
        </p>
      )}
    </div>,
    document.body,
  );
}
