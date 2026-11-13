import { useEffect, useState } from 'react';
import { useHotkeys } from '@/src/lib/hotkeys';
import { useBookmarks } from '@/src/store/useBookmarks';
import { useUi } from '@/src/store/ui';
import { IconButton } from './IconButton';
import { SidebarIcon } from './icons';
import { Breadcrumbs } from './main/Breadcrumbs';
import { FolderView } from './main/FolderView';
import { Toolbar } from './main/Toolbar';
import { ScrollParentContext } from './main/scrollParent';
import { OverlayHost } from './overlays/OverlayHost';
import { SearchBox } from './search/SearchBox';
import { SearchResults } from './search/SearchResults';
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
  const searching = useUi((s) => s.query.trim().length > 0);
  const [scrollParent, setScrollParent] = useState<HTMLElement | null>(null);

  useHotkeys({ 'mod+\\': () => toggleSidebar() });

  // Performance mark for the e2e paint budget (PRD §10: interactive < 200 ms).
  useEffect(() => {
    if (state.ready && performance.getEntriesByName('arca:interactive').length === 0) {
      performance.mark('arca:interactive');
    }
  }, [state.ready]);

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
          <div className="flex w-[min(30rem,42%)] shrink-0 justify-center">
            <SearchBox />
          </div>
          <div className="flex flex-1 justify-end">
            <Toolbar />
          </div>
        </header>
        <section
          ref={setScrollParent}
          aria-label="Folder contents"
          className="relative min-h-0 flex-1 overflow-y-auto px-5 pt-2 pb-10"
        >
          <ScrollParentContext.Provider value={scrollParent}>
            {searching ? <SearchResults /> : <FolderView />}
          </ScrollParentContext.Provider>
        </section>
      </main>
      <OverlayHost />
    </div>
  );
}
