import { useEffect } from 'react';
import { useHotkeys } from '@/src/lib/hotkeys';
import { useBookmarks } from '@/src/store/useBookmarks';
import { useUi } from '@/src/store/ui';
import { IconButton } from './IconButton';
import { SidebarIcon } from './icons';
import { Breadcrumbs } from './main/Breadcrumbs';
import { FolderView } from './main/FolderView';
import { Toolbar } from './main/Toolbar';
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
