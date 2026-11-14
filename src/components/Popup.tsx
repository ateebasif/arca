import {
  clearPendingSave,
  readPendingSave,
  type PendingSave,
} from '@/src/lib/pendingSave';
import { setTags } from '@/src/features/tags/actions';
import { getMetaStore, useMeta } from '@/src/store/useMeta';
import { TagInput } from './tags/TagInput';
import { inputClass } from './overlays/Dialog';
import { Toaster } from './overlays/OverlayHost';
import { useEffect, useMemo, useState } from 'react';
import { errorMessage } from '@/src/features/editing/actions';
import * as bm from '@/src/lib/bookmarks';
import { getActiveTab, type Tab } from '@/src/lib/tabs';
import { displayHost } from '@/src/lib/url';
import { useSettings } from '@/src/store/settings';
import { getPath } from '@/src/store/selectors';
import { useBookmarks } from '@/src/store/useBookmarks';
import { Favicon } from './main/Favicon';
import { FolderPicker } from './FolderPicker';
import { rememberFolder } from '@/src/features/editing/recentFolders';
import { PopupHome } from './PopupHome';
import { QuickSearch } from './quick/QuickSearch';

const closePopup = () => window.close();

/** Toolbar popup: quick search, bookmark the current tab, open the dashboard. */
export function Popup() {
  const [searching, setSearching] = useState(false);
  // Something right-clicked with "Add to Arca…" waiting to be saved?
  // (The normal popup shows right away; the save box replaces it if needed.)
  const [pending, setPending] = useState<PendingSave | null>(null);
  useEffect(() => {
    void readPendingSave().then(setPending);
  }, []);
  if (pending) {
    return (
      <main className="flex w-[380px] flex-col gap-3 p-3">
        <SaveBox item={pending} />
        <Toaster />
      </main>
    );
  }
  return (
    <main className="flex w-[380px] flex-col gap-3 p-3">
      <QuickSearch
        limit={500}
        scroll
        onOpened={closePopup}
        onSearchingChange={setSearching}
      />
      {!searching && (
        <>
          <CurrentTab />
          <PopupHome />
        </>
      )}
      <Toaster />
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
          <FolderPicker
            label="Save to folder"
            value={chosenFolder}
            onChange={setFolderId}
            className="flex-1"
          />
          <button
            type="button"
            onClick={async () => {
              try {
                await bm.create({ parentId: chosenFolder, title, url });
                await updateSettings({ saveFolderId: chosenFolder });
                await rememberFolder(chosenFolder);
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

/** Save box for a page or link sent here with "Add to Arca…" (right-click). */
function SaveBox({ item }: { item: PendingSave }) {
  const state = useBookmarks();
  const saveFolderId = useSettings((s) => s.saveFolderId);
  const updateSettings = useSettings((s) => s.update);
  const meta = useMeta();
  const [title, setTitle] = useState(item.title || displayHost(item.url));
  const [folderId, setFolderId] = useState<string | null>(null);
  const [tags, setTagList] = useState<string[]>([]);
  const [error, setError] = useState<string>();
  const [saved, setSaved] = useState(false);
  const known = useMemo(
    () =>
      getMetaStore()
        .allTags()
        .map((t) => t.tag),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [meta.version],
  );
  const existing = useMemo(
    () => [...state.nodes.values()].find((n) => n.url === item.url),
    [state, item.url],
  );
  if (!state.ready) return <div className="h-[220px]" />;
  const chosen =
    folderId ?? (state.nodes.get(saveFolderId)?.childIds ? saveFolderId : '1');

  const done = async () => {
    await clearPendingSave();
    closePopup();
  };
  const save = async () => {
    try {
      const node = await bm.create({
        parentId: chosen,
        title: title.trim() || item.url,
        url: item.url,
      });
      await setTags(node.id, item.url, tags);
      await updateSettings({ saveFolderId: chosen });
      await rememberFolder(chosen);
      setSaved(true);
      await clearPendingSave();
      setTimeout(closePopup, 700);
    } catch (e) {
      setError(errorMessage(e));
    }
  };

  return (
    <section
      aria-label="Add to Arca"
      className="border-line bg-surface flex flex-col gap-2.5 rounded-xl border p-3"
    >
      <p className="text-[13px] font-semibold">Add to Arca</p>
      <div className="flex items-center gap-2.5">
        <Favicon url={item.url} title={title} size={20} />
        <input
          aria-label="Title"
          autoFocus
          className={`${inputClass} h-8 flex-1`}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && void save()}
        />
      </div>
      <p className="text-ink-faint -mt-1 truncate pl-8 text-[11px]">{item.url}</p>
      {existing && (
        <p className="text-ink-muted text-xs" role="status">
          ★ Already saved in{' '}
          {getPath(state, existing.parentId ?? '1')
            .map((n) => n.title)
            .join(' / ')}
        </p>
      )}
      <FolderPicker label="Save to folder" value={chosen} onChange={setFolderId} />
      <TagInput value={tags} onChange={setTagList} suggestions={known} />
      {error && (
        <p role="alert" className="text-danger text-xs">
          {error}
        </p>
      )}
      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={() => void done()}
          className="text-ink-muted hover:bg-hover h-8 rounded-lg px-3 text-[13px]"
        >
          Cancel
        </button>
        <button
          type="button"
          disabled={saved}
          onClick={() => void save()}
          className="bg-accent-strong h-8 rounded-lg px-3 text-[13px] font-medium text-white hover:opacity-90 disabled:opacity-70"
        >
          {saved ? 'Saved ✓' : 'Save'}
        </button>
      </div>
    </section>
  );
}
