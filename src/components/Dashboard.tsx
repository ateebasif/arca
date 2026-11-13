import { useEffect, useState } from 'react';
import { DndProvider } from '@/src/features/dnd/DndProvider';
import { undoLast } from '@/src/features/undo/undo';
import { isTyping, useHotkeys } from '@/src/lib/hotkeys';
import { useBookmarks } from '@/src/store/useBookmarks';
import { useUi } from '@/src/store/ui';
import { useOverlays } from '@/src/store/overlays';
import { IconButton } from './IconButton';
import { SidebarIcon } from './icons';
import { Breadcrumbs } from './main/Breadcrumbs';
import { NavButtons } from './main/NavButtons';
import { FolderView } from './main/FolderView';
import { AddMenu } from './main/AddMenu';
import { ScopeSwitch, Toolbar } from './main/Toolbar';
import { ScrollParentContext } from './main/scrollParent';
import { OverlayHost } from './overlays/OverlayHost';
import { PreviewController } from './preview/PreviewController';
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
  const searching = useUi((s) => s.query.trim().length > 0);
  const [scrollParent, setScrollParent] = useState<HTMLElement | null>(null);

  useHotkeys({
    'mod+\\': () => toggleSidebar(),
    '[': () => useUi.getState().goBack(),
    ']': () => useUi.getState().goForward(),
    'alt+arrowup': () => {
      const ui = useUi.getState();
      const parent = state.nodes.get(ui.currentFolderId)?.parentId;
      // Don't go above the root folders.
      if (parent && parent !== '0') ui.openFolder(parent);
    },
    '?': () => useOverlays.getState().setShortcutsOpen(true),
    // In text fields ⌘Z keeps undoing typing; elsewhere it undoes the last action.
    'mod+z': (e) => {
      if (isTyping(e.target)) return false;
      void undoLast();
      return true;
    },
  });

  // Mouse side buttons (3 = back, 4 = forward) move through folder history.
  useEffect(() => {
    const onMouseUp = (e: MouseEvent) => {
      if (e.button !== 3 && e.button !== 4) return;
      e.preventDefault();
      if (e.button === 3) useUi.getState().goBack();
      else useUi.getState().goForward();
    };
    window.addEventListener('mouseup', onMouseUp);
    return () => window.removeEventListener('mouseup', onMouseUp);
  }, []);

  // Performance mark for the e2e paint budget (PRD §10: interactive < 200 ms).
  useEffect(() => {
    if (state.ready && performance.getEntriesByName('arca:interactive').length === 0) {
      performance.mark('arca:interactive');
    }
  }, [state.ready]);

  // If the open folder disappears (deleted elsewhere), fall back to the first root.
  useEffect(() => {
    if (state.ready && !state.nodes.has(currentFolderId) && state.rootIds[0]) {
      useUi.getState().replaceFolder(state.rootIds[0]);
    }
  }, [state, currentFolderId]);

  return (
    <DndProvider>
      <div className="flex h-full" data-surface={surface}>
        {!collapsed && <Sidebar />}
        <main className="flex min-w-0 flex-1 flex-col">
          <header className="flex shrink-0 flex-col px-5">
            <div className="flex h-14 items-center gap-3">
              {collapsed && (
                <IconButton label="Show sidebar (⌘\)" onClick={toggleSidebar}>
                  <SidebarIcon />
                </IconButton>
              )}
              <NavButtons />
              <div className="min-w-0 flex-1">
                <Breadcrumbs />
              </div>
              <div className="flex w-[min(34rem,48%)] shrink-0">
                <SearchBox />
              </div>
              <AddMenu />
            </div>
            {!searching && (
              <div className="flex h-10 items-center justify-between gap-3">
                <ScopeSwitch />
                <Toolbar />
              </div>
            )}
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
        <PreviewController />
      </div>
    </DndProvider>
  );
}
