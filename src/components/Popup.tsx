import { useEffect, useMemo, useState } from 'react';
import { errorMessage } from '@/src/features/editing/actions';
import * as bm from '@/src/lib/bookmarks';
import { getActiveTab, openExtensionPage, type Tab } from '@/src/lib/tabs';
import { displayHost } from '@/src/lib/url';
import { useSettings } from '@/src/store/settings';
import { folderOptions, getPath } from '@/src/store/selectors';
import { useBookmarks } from '@/src/store/useBookmarks';
import { GridIcon } from './icons';
import { Favicon } from './main/Favicon';
import { inputClass } from './overlays/Dialog';
import { QuickSearch } from './quick/QuickSearch';

const closePopup = () => window.close();

/** Toolbar popup: quick search, bookmark the current tab, open the dashboard. */
export function Popup() {
  return (
    <main className="flex w-[380px] flex-col gap-3 p-3">
      <QuickSearch limit={8} onOpened={closePopup} />
      <CurrentTab />
      <button
        type="button"
        onClick={() => void openExtensionPage('dashboard.html').then(closePopup)}
        className="text-ink-muted hover:bg-hover hover:text-ink flex h-9 items-center justify-center gap-2 rounded-lg text-[13px]"
      >
        <GridIcon /> Open dashboard
      </button>
    </main>
  );
}

function CurrentTab() {
  const state = useBookmarks();
  const saveFolderId = useSettings((s) => s.saveFolderId);
  const updateSettings = useSettings((s) => s.update);
  const [tab, setTab] = useState<Tab | null | undefined>(undefined);
  const [folderId, setFolderId] = useState<string | null>(null);
  const [error, setError] = useState<string>();

  useEffect(() => {
    void getActiveTab().then((t) => setTab(t ?? null));
  }, []);

  const options = useMemo(() => folderOptions(state), [state]);
  const url = tab?.url ?? '';
  const existing = useMemo(
    () => [...state.nodes.values()].find((n) => n.url !== undefined && n.url === url),
    [state, url],
  );

  if (tab === undefined || !state.ready) return <div className="h-[92px]" />;
  if (!/^https?:/.test(url)) {
    return (
      <p className="border-line text-ink-muted rounded-xl border px-3 py-3 text-[13px]">
        This page can't be bookmarked from Arca.
      </p>
    );
  }

  const title = tab?.title || displayHost(url);
  const chosenFolder =
    folderId ?? (state.nodes.get(saveFolderId)?.childIds ? saveFolderId : '1');

  return (
    <section
      aria-label="Current tab"
      className="border-line bg-surface flex flex-col gap-2.5 rounded-xl border p-3"
    >
      <div className="flex items-center gap-2.5">
        <Favicon url={url} title={title} size={20} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-[13px] font-medium">{title}</p>
          <p className="text-ink-faint truncate text-[11px]">{displayHost(url)}</p>
        </div>
      </div>
      {existing ? (
        <div className="flex items-center gap-2">
          <p className="text-ink-muted min-w-0 flex-1 truncate text-xs" role="status">
            ★ Saved in{' '}
            <span className="text-ink">
              {getPath(state, existing.parentId ?? '1')
                .map((n) => n.title)
                .join(' / ')}
            </span>
          </p>
          <button
            type="button"
            onClick={() =>
              void bm.remove(existing.id).catch((e: unknown) => setError(errorMessage(e)))
            }
            className="text-danger hover:bg-hover h-7 rounded-md px-2 text-xs"
          >
            Remove
          </button>
        </div>
      ) : (
        <div className="flex items-center gap-2">
          <select
            aria-label="Save to folder"
            className={`${inputClass} h-8 min-w-0 flex-1`}
            value={chosenFolder}
            onChange={(e) => setFolderId(e.target.value)}
          >
            {options.map((o) => (
              <option key={o.id} value={o.id}>
                {o.label}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={async () => {
              try {
                await bm.create({ parentId: chosenFolder, title, url });
                await updateSettings({ saveFolderId: chosenFolder });
              } catch (e) {
                setError(errorMessage(e));
              }
            }}
            className="bg-accent-strong h-8 shrink-0 rounded-lg px-3 text-[13px] font-medium text-white hover:opacity-90"
          >
            Bookmark this tab
          </button>
        </div>
      )}
      {error && (
        <p role="alert" className="text-danger text-xs">
          {error}
        </p>
      )}
    </section>
  );
}
