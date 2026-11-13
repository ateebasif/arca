import { useEffect } from 'react';
import { useHotkeys } from '@/src/lib/hotkeys';
import { useBookmarks } from '@/src/store/useBookmarks';
import { useUi } from '@/src/store/ui';
import { DensityIcon, SidebarIcon } from './icons';
import { Breadcrumbs } from './main/Breadcrumbs';
import { FolderView } from './main/FolderView';
import { Sidebar } from './sidebar/Sidebar';

interface DashboardProps {
  /** Where the dashboard is rendered; New Tab and the dashboard tab share this UI. */
  surface: 'newtab' | 'dashboard';
}

export function Dashboard({ surface }: DashboardProps) {
  const state = useBookmarks();
  const collapsed = useUi((s) => s.sidebarCollapsed);
  const toggleSidebar = useUi((s) => s.toggleSidebar);
  const currentFolderId = useUi((s) => s.currentFolderId);
  const openFolder = useUi((s) => s.openFolder);

  useHotkeys({ 'mod+\\': () => toggleSidebar() });

  // If the open folder disappears (deleted elsewhere), fall back to the first root.
  useEffect(() => {
    if (state.ready && !state.nodes.has(currentFolderId) && state.rootIds[0]) {
      openFolder(state.rootIds[0]);
    }
  }, [state, currentFolderId, openFolder]);

  return (
    <div className="flex h-full" data-surface={surface}>
      {!collapsed && <Sidebar />}
      <main className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 shrink-0 items-center gap-2 px-5">
          {collapsed && (
            <IconButton label="Show sidebar (⌘\)" onClick={toggleSidebar}>
              <SidebarIcon />
            </IconButton>
          )}
          <div className="min-w-0 flex-1">
            <Breadcrumbs />
          </div>
          <Toolbar />
        </header>
        <section
          aria-label="Folder contents"
          className="min-h-0 flex-1 overflow-y-auto px-5 pt-2 pb-10"
        >
          <FolderView />
        </section>
      </main>
    </div>
  );
}

function Toolbar() {
  const density = useUi((s) => s.density);
  const setDensity = useUi((s) => s.setDensity);
  return (
    <div className="flex shrink-0 items-center gap-1">
      <IconButton
        label={density === 'compact' ? 'Comfortable density' : 'Compact density'}
        pressed={density === 'compact'}
        onClick={() => setDensity(density === 'compact' ? 'comfortable' : 'compact')}
      >
        <DensityIcon />
      </IconButton>
    </div>
  );
}

interface IconButtonProps {
  label: string;
  onClick(): void;
  pressed?: boolean;
  children: React.ReactNode;
}

export function IconButton({ label, onClick, pressed, children }: IconButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      aria-pressed={pressed}
      title={label}
      className={`grid size-8 place-items-center rounded-lg transition-colors duration-150 ${
        pressed
          ? 'bg-accent-soft text-accent'
          : 'text-ink-muted hover:bg-hover hover:text-ink'
      }`}
    >
      {children}
    </button>
  );
}
