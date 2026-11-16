import { useEffect, useMemo, useState } from 'react';
import { useTabDrag } from '@/src/features/dnd/hooks';
import { bookmarkTab } from '@/src/features/editing/actions';
import { buildIndex } from '@/src/features/search/search';
import { normalizeUrl } from '@/src/features/tidy/normalize';
import { getCurrentWindowTabs, onTabsChange, type Tab } from '@/src/lib/tabs';
import { classifyUrl, displayHost } from '@/src/lib/url';
import { useBookmarks } from '@/src/store/useBookmarks';
import { useUi } from '@/src/store/ui';
import { CloseIcon } from '../icons';
import { Favicon } from '../main/Favicon';

/**
 * Open tabs (PRD §8.6): this window's web pages. Drag one onto a folder to
 * bookmark it there, or click Bookmark to save it in the open folder. Tabs
 * you've already bookmarked are marked, with a link to where they are.
 */
export function TabsPanel() {
  const state = useBookmarks();
  const folderId = useUi((s) => s.currentFolderId);
  const [tabs, setTabs] = useState<Tab[]>([]);

  useEffect(() => {
    let alive = true;
    const load = () =>
      void getCurrentWindowTabs()
        .then((list) => alive && setTabs(list))
        .catch(() => alive && setTabs([]));
    load();
    const off = onTabsChange(load);
    return () => {
      alive = false;
      off();
    };
  }, []);

  // Where each page is already bookmarked (normalized address → bookmark).
  const saved = useMemo(() => {
    const map = new Map<string, { id: string; folderId: string }>();
    for (const e of buildIndex(state)) {
      if (e.key && !map.has(e.key))
        map.set(e.key, { id: e.node.id, folderId: e.node.parentId ?? '1' });
    }
    return map;
  }, [state]);

  const web = tabs.filter(
    (t) => t.url && t.id !== undefined && classifyUrl(t.url) === 'web',
  );
  const target = state.nodes.get(folderId);
  // Root container ("0") can't hold bookmarks; fall back to the Bookmarks bar.
  const saveTo = target && target.id !== '0' ? target : state.nodes.get('1');

  return (
    <aside
      aria-label="Open tabs"
      className="border-line bg-surface max-lg:bg-surface-strong flex w-72 shrink-0 flex-col border-l backdrop-blur-xl max-lg:fixed max-lg:inset-y-0 max-lg:right-0 max-lg:z-40 max-lg:shadow-(--shadow-pop)"
    >
      <div className="flex h-14 shrink-0 items-center justify-between px-4">
        <span className="text-[13px] font-semibold">
          Open tabs <span className="text-ink-faint font-normal">{web.length}</span>
        </span>
        <button
          type="button"
          aria-label="Close open tabs"
          onClick={() => useUi.getState().toggleTabsPanel()}
          className="text-ink-muted hover:bg-hover hover:text-ink grid size-7 place-items-center rounded-lg"
        >
          <CloseIcon />
        </button>
      </div>
      <p className="text-ink-faint px-4 pb-2 text-[11px] leading-relaxed">
        Drag a tab onto a folder, or Bookmark to save it in “
        {saveTo?.title || 'this folder'}”.
      </p>
      <ul className="min-h-0 flex-1 overflow-y-auto px-2 pb-3">
        {web.length === 0 && (
          <li className="text-ink-muted px-2 py-6 text-center text-xs">
            No web pages open in this window.
          </li>
        )}
        {web.map((tab) => {
          const url = tab.url ?? '';
          const where = saved.get(normalizeUrl(url));
          return (
            <TabRow
              key={tab.id}
              tab={tab}
              saved={where}
              onBookmark={() =>
                saveTo && void bookmarkTab({ url, title: tab.title ?? '' }, saveTo.id)
              }
            />
          );
        })}
      </ul>
    </aside>
  );
}

function TabRow({
  tab,
  saved,
  onBookmark,
}: {
  tab: Tab;
  saved?: { id: string; folderId: string };
  onBookmark(): void;
}) {
  const url = tab.url ?? '';
  const title = tab.title || displayHost(url);
  const { setNodeRef, handle, isDragging } = useTabDrag(tab.id ?? -1, { url, title });
  return (
    <li
      ref={setNodeRef}
      data-open-tab={tab.id}
      className={`group hover:bg-hover flex h-11 items-center gap-2.5 rounded-lg px-2 ${
        isDragging ? 'opacity-40' : ''
      }`}
    >
      <span
        {...handle}
        title={`${title}\n${url}\nDrag onto a folder to bookmark it`}
        className="flex min-w-0 flex-1 cursor-grab items-center gap-2.5"
      >
        <Favicon url={url} title={title} size={16} />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[13px]">{title}</span>
          <span className="text-ink-faint block truncate text-[11px]">
            {displayHost(url)}
          </span>
        </span>
      </span>
      {saved ? (
        <button
          type="button"
          title="Already bookmarked: show it"
          onClick={() => useUi.getState().reveal(saved.id, saved.folderId)}
          className="text-accent shrink-0 rounded-md px-1.5 py-0.5 text-[11px] hover:underline"
        >
          Saved
        </button>
      ) : (
        <button
          type="button"
          aria-label={`Bookmark ${title}`}
          onClick={onBookmark}
          className="text-ink-muted hover:text-ink hover:bg-surface-strong shrink-0 rounded-md px-1.5 py-0.5 text-[11px] opacity-0 group-hover:opacity-100 focus-visible:opacity-100"
        >
          Bookmark
        </button>
      )}
    </li>
  );
}
