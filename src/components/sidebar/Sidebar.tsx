import { useRef, type KeyboardEvent, type PointerEvent } from 'react';
import { SIDEBAR_MAX, SIDEBAR_MIN, useUi } from '@/src/store/ui';
import { useOverlays } from '@/src/store/overlays';
import { GearIcon, KeyboardIcon, SidebarIcon } from '../icons';
import { ThemeSwitch } from '../ThemeSwitch';
import { FolderTree } from './FolderTree';

export function Sidebar() {
  const width = useUi((s) => s.sidebarWidth);
  const toggleSidebar = useUi((s) => s.toggleSidebar);

  return (
    <aside
      aria-label="Sidebar"
      className="border-line bg-surface relative flex shrink-0 flex-col border-r backdrop-blur-xl"
      style={{ width }}
    >
      <div className="flex h-14 shrink-0 items-center justify-between px-4">
        <span className="flex items-center gap-2 text-[15px] font-semibold tracking-tight">
          <img src="/icon/32.png" alt="" width={20} height={20} draggable={false} />
          Arca
        </span>
        <button
          type="button"
          onClick={toggleSidebar}
          aria-label="Hide sidebar (⌘\)"
          title="Hide sidebar (⌘\)"
          className="text-ink-muted hover:bg-hover hover:text-ink grid size-7 place-items-center rounded-lg"
        >
          <SidebarIcon />
        </button>
      </div>
      <nav className="min-h-0 flex-1 overflow-y-auto">
        <FolderTree />
      </nav>
      <div className="border-line flex shrink-0 items-center justify-between gap-2 border-t px-2 py-2">
        <button
          type="button"
          onClick={() => useOverlays.getState().openSettings()}
          className="text-ink-muted hover:bg-hover hover:text-ink flex h-8 items-center gap-2 rounded-lg px-2 text-[13px]"
        >
          <GearIcon /> Settings
        </button>
        <button
          type="button"
          aria-label="Keyboard shortcuts (?)"
          title="Keyboard shortcuts (?)"
          onClick={() => useOverlays.getState().setShortcutsOpen(true)}
          className="text-ink-muted hover:bg-hover hover:text-ink mr-auto grid size-8 place-items-center rounded-lg"
        >
          <KeyboardIcon />
        </button>
        <ThemeSwitch />
      </div>
      <Resizer />
    </aside>
  );
}

function Resizer() {
  const width = useUi((s) => s.sidebarWidth);
  const setWidth = useUi((s) => s.setSidebarWidth);
  const start = useRef<{ x: number; width: number } | null>(null);

  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    start.current = { x: e.clientX, width };
  };
  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    if (!start.current) return;
    setWidth(start.current.width + e.clientX - start.current.x);
  };
  const onPointerUp = () => {
    start.current = null;
  };
  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'ArrowLeft') setWidth(width - 16);
    else if (e.key === 'ArrowRight') setWidth(width + 16);
    else return;
    e.preventDefault();
  };

  return (
    <div
      role="separator"
      aria-orientation="vertical"
      aria-label="Resize sidebar"
      aria-valuemin={SIDEBAR_MIN}
      aria-valuemax={SIDEBAR_MAX}
      aria-valuenow={width}
      tabIndex={0}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onKeyDown={onKeyDown}
      className="hover:bg-accent/40 focus-visible:bg-accent/40 absolute inset-y-0 -right-1 w-2 cursor-col-resize transition-colors duration-150"
    />
  );
}
