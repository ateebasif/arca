import { useRef, type KeyboardEvent, type PointerEvent } from 'react';
import { SIDEBAR_MAX, SIDEBAR_MIN, useUi } from '@/src/store/ui';
import { useAiRun } from '@/src/store/aiRun';
import { useAskChat } from '@/src/store/askChat';
import { useOverlays } from '@/src/store/overlays';
import { GearIcon, KeyboardIcon, SearchIcon, SidebarIcon, SparkleIcon } from '../icons';
import { ThemeSwitch } from '../ThemeSwitch';
import { FolderTree } from './FolderTree';
import { TagList } from './TagList';

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
        <TagList />
      </nav>
      <div className="px-2 pb-1.5">
        <button
          type="button"
          onClick={() => useOverlays.getState().openAsk()}
          className="border-line text-ink-muted hover:bg-hover hover:text-ink flex h-9 w-full items-center gap-2 rounded-lg border px-2.5 text-[13px] transition-colors duration-150"
        >
          <SearchIcon className="text-accent" /> Ask Arca
          <AskStatus />
        </button>
      </div>
      <div className="px-2 pb-2">
        <button
          type="button"
          onClick={() => useOverlays.getState().setTidyOpen(true)}
          className="border-line text-ink-muted hover:bg-hover hover:text-ink flex h-9 w-full items-center gap-2 rounded-lg border px-2.5 text-[13px] transition-colors duration-150"
        >
          <SparkleIcon className="text-accent" /> Tidy up
          <TidyStatus />
        </button>
      </div>
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

/** "duplicates · sort", or the AI organize run's progress while it works. */
function TidyStatus() {
  const phase = useAiRun((s) => s.phase);
  const text =
    phase.kind === 'running'
      ? `AI ${Math.round((phase.done / Math.max(1, phase.total)) * 100)}%`
      : phase.kind === 'review'
        ? 'AI ready to review'
        : phase.kind === 'applying'
          ? 'AI moving links'
          : null;
  if (!text)
    return <span className="text-ink-faint ml-auto text-[11px]">duplicates · sort</span>;
  return (
    <span className="text-accent ml-auto flex items-center gap-1.5 text-[11px] tabular-nums">
      {phase.kind !== 'review' && (
        <span className="bg-accent size-1.5 animate-pulse rounded-full" aria-hidden />
      )}
      {text}
    </span>
  );
}

/** "find by description", or a pulse while Ask Arca is working. */
function AskStatus() {
  const working = useAskChat((s) => s.status.kind === 'working');
  // Background read of all bookmarks (first time, or after switching models).
  const reading = useAskChat((s) =>
    s.index ? Math.floor((s.index.done / Math.max(1, s.index.total)) * 100) : null,
  );
  return reading !== null || working ? (
    <span className="text-accent ml-auto flex items-center gap-1.5 text-[11px] tabular-nums">
      <span className="bg-accent size-1.5 animate-pulse rounded-full" aria-hidden />
      {reading !== null ? `reading ${reading}%` : 'working'}
    </span>
  ) : (
    <span className="text-ink-faint ml-auto text-[11px]">find by description</span>
  );
}
