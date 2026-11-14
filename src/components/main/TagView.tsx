import { useTagColors } from '@/src/store/useMeta';
import { useViewIds } from '@/src/store/selection';
import { useDescriptionsOn } from '@/src/features/ai/useDescription';
import { useMemo } from 'react';
import { tagStyle } from '@/src/features/tags/style';
import { folderCounts, folderPreview, getPath } from '@/src/store/selectors';
import { getMetaStore, useMeta } from '@/src/store/useMeta';
import { useBookmarks } from '@/src/store/useBookmarks';
import { useUi } from '@/src/store/ui';
import { CloseIcon } from '../icons';
import { BookmarkRow, FolderRow, ListHeader } from './BookmarkList';
import { BookmarkTile } from './BookmarkTile';
import { FolderCard } from './FolderCard';
import { VIRTUALIZE_OVER } from './scrollParent';
import { VirtualRows } from './Virtual';

/** Breadcrumb stand-in while a tag is shown: "#tag" with a way out. */
export function TagCrumb({ tag }: { tag: string }) {
  const colors = useTagColors();
  const clear = () => useUi.getState().setTagFilter(null);
  return (
    <div className="flex min-w-0 items-center gap-2 overflow-hidden text-[15px]">
      <span className="text-ink-muted shrink-0 max-lg:hidden">Tagged</span>
      <span
        style={tagStyle(tag, colors)}
        className="max-w-[16rem] min-w-16 truncate rounded-full px-2.5 py-0.5 font-medium"
      >
        #{tag}
      </span>
      <button
        type="button"
        aria-label="Clear tag filter"
        title="Clear tag filter"
        onClick={clear}
        className="text-ink-faint hover:text-ink hover:bg-hover shrink-0 rounded-md p-1"
      >
        <CloseIcon />
      </button>
    </div>
  );
}

/** Every folder and link with a tag, from anywhere in the library. */
export function TagView({ tag }: { tag: string }) {
  // Rows grow to fit a description line when those are on.
  const rowHeight = useDescriptionsOn() ? 53 : 41;
  const state = useBookmarks();
  const meta = useMeta();
  const view = useUi((s) => s.view);
  const density = useUi((s) => s.density);
  const openFolder = useUi((s) => s.openFolder);

  const { folders, links, paths } = useMemo(() => {
    const ids = getMetaStore().idsWithTag(tag);
    const nodes = ids.flatMap((id) => {
      const n = state.nodes.get(id);
      return n ? [n] : [];
    });
    const pathOf = new Map(
      nodes.map((n) => [
        n.id,
        n.parentId
          ? getPath(state, n.parentId)
              .map((p) => p.title)
              .join(' / ')
          : '',
      ]),
    );
    const byTitle = (a: { title: string }, b: { title: string }) =>
      a.title.localeCompare(b.title);
    return {
      folders: nodes.filter((n) => n.childIds !== null).sort(byTitle),
      links: nodes.filter((n) => n.childIds === null).sort(byTitle),
      paths: pathOf,
    };
    // Recompute when tags change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state, tag, meta.version]);
  const counts = folderCounts(state);
  useViewIds([...folders, ...links].map((n) => n.id));
  if (!state.ready) return null;

  const total = folders.length + links.length;
  if (total === 0) {
    return (
      <div className="text-ink-muted flex flex-col items-center gap-1 py-24 text-center">
        <p className="text-ink text-[15px] font-medium">
          Nothing is tagged #{tag} any more
        </p>
        <p className="text-sm">Add tags from a bookmark's Edit dialog.</p>
      </div>
    );
  }
  const summary = (
    <p className="text-ink-muted mb-3 text-xs" aria-live="polite">
      {[
        folders.length &&
          `${folders.length} ${folders.length === 1 ? 'folder' : 'folders'}`,
        links.length && `${links.length} ${links.length === 1 ? 'link' : 'links'}`,
      ]
        .filter(Boolean)
        .join(' · ')}
    </p>
  );
  const label = (id: string) => paths.get(id) ?? '';

  if (view === 'list') {
    const rows = [...folders, ...links];
    const render = (n: (typeof rows)[number]) =>
      n.childIds ? (
        <FolderRow folder={n} count={counts.get(n.id) ?? 0} onOpen={openFolder} />
      ) : (
        <BookmarkRow bookmark={n} folderPath={label(n.id)} />
      );
    return (
      <div data-tag-view={tag}>
        {summary}
        <div role="table" aria-label={`Tagged ${tag}`} className="flex flex-col">
          <ListHeader />
          <div role="rowgroup" className="flex flex-col gap-px">
            {rows.length > VIRTUALIZE_OVER ? (
              <VirtualRows
                items={rows}
                rowHeight={rowHeight}
                minColumnWidth={0}
                gap={1}
                getKey={(n) => n.id}
                render={render}
              />
            ) : (
              rows.map((n) => <div key={n.id}>{render(n)}</div>)
            )}
          </div>
        </div>
      </div>
    );
  }

  const grid =
    density === 'compact'
      ? 'grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-1'
      : 'grid grid-cols-[repeat(auto-fill,minmax(176px,1fr))] gap-3';
  return (
    <div data-tag-view={tag} className="flex flex-col gap-6">
      {summary}
      {folders.length > 0 && (
        <section aria-label="Folders">
          <div className={grid}>
            {folders.map((f) => (
              <FolderCard
                key={f.id}
                folder={f}
                count={counts.get(f.id) ?? 0}
                subfolders={
                  (f.childIds ?? []).filter((c) => state.nodes.get(c)?.childIds).length
                }
                preview={folderPreview(state, f)}
                onOpen={openFolder}
                density={density}
              />
            ))}
          </div>
        </section>
      )}
      {links.length > 0 && (
        <section aria-label="Links">
          <div className={grid}>
            {links.map((b) => (
              <BookmarkTile
                key={b.id}
                bookmark={b}
                density={density}
                folderLabel={label(b.id)}
              />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
