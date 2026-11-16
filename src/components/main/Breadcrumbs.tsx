import { getPath } from '@/src/store/selectors';
import { useBookmarks } from '@/src/store/useBookmarks';
import { useUi } from '@/src/store/ui';
import { useFolderDrop } from '@/src/features/dnd/hooks';
import { ChevronRight } from '../icons';
import { useOverlays } from '@/src/store/overlays';
import { InlineRename } from '../overlays/InlineRename';

/** Path to the open folder. Every crumb but the last opens that folder. */
export function Breadcrumbs() {
  const state = useBookmarks();
  const currentFolderId = useUi((s) => s.currentFolderId);
  const openFolder = useUi((s) => s.openFolder);
  const full = getPath(state, currentFolderId);
  // Long paths collapse to: first › … › parent › current.
  const hidden = full.length > 4 ? full.slice(1, -2) : [];
  const path = hidden.length ? [full[0] ?? null, null, ...full.slice(-2)] : full;

  return (
    <nav aria-label="Breadcrumb" className="min-w-0 overflow-hidden">
      <ol className="flex min-w-0 items-center gap-0.5 text-[15px]">
        {path.map((node, i) => {
          const last = i === path.length - 1;
          if (!node) {
            const deepest = hidden.at(-1);
            if (!deepest) return null;
            return (
              <li key="ellipsis" className="flex shrink-0 items-center gap-0.5">
                <ChevronRight width={12} height={12} className="text-ink-faint" />
                <button
                  type="button"
                  title={hidden.map((n) => n.title).join(' / ')}
                  aria-label={`Open ${deepest.title || 'folder'}`}
                  onClick={() => openFolder(deepest.id)}
                  className="text-ink-muted hover:bg-hover hover:text-ink rounded-md px-1.5 py-0.5"
                >
                  …
                </button>
              </li>
            );
          }
          return (
            <li
              key={node.id}
              className={`flex items-center gap-0.5 ${last ? 'min-w-0' : 'min-w-0 shrink'}`}
            >
              {i > 0 && (
                <ChevronRight width={12} height={12} className="text-ink-faint" />
              )}
              {last ? (
                <CurrentCrumb id={node.id} title={node.title} locked={node.isRoot} />
              ) : (
                <Crumb
                  id={node.id}
                  title={node.title || 'Untitled'}
                  onOpen={openFolder}
                />
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

/** A breadcrumb that opens its folder and accepts drops. */
function Crumb({
  id,
  title,
  onOpen,
}: {
  id: string;
  title: string;
  onOpen(id: string): void;
}) {
  const drop = useFolderDrop(id, 'crumb');
  return (
    <button
      ref={drop.setDropRef}
      type="button"
      data-drop-folder={id}
      onClick={() => onOpen(id)}
      className={`text-ink-muted hover:bg-hover hover:text-ink max-w-40 truncate rounded-md px-1.5 py-0.5 ${
        drop.isOver
          ? drop.blocked
            ? 'ring-danger ring-2'
            : 'ring-accent bg-accent-soft ring-2'
          : ''
      }`}
    >
      {title}
    </button>
  );
}

/**
 * The open folder's name. Click it to rename (like most file apps); browser
 * folders (Bookmarks bar, Other bookmarks) can't be renamed, so they're plain.
 */
function CurrentCrumb({
  id,
  title,
  locked,
}: {
  id: string;
  title: string;
  locked: boolean;
}) {
  const renaming = useOverlays((s) => s.renamingId === id && s.renameIn === 'crumb');
  if (renaming) {
    return (
      <h1 className="min-w-0 flex-1 px-0.5">
        <InlineRename id={id} initial={title} className="h-8 text-[15px] font-semibold" />
      </h1>
    );
  }
  if (locked) {
    return (
      <h1 aria-current="page" className="truncate px-1.5 font-semibold">
        {title || 'Untitled'}
      </h1>
    );
  }
  return (
    <h1 className="min-w-0 font-semibold">
      <button
        type="button"
        aria-current="page"
        title="Click to rename"
        aria-label={`Rename ${title || 'Untitled'}`}
        onClick={() => useOverlays.getState().startRename(id, 'crumb')}
        className="hover:bg-hover block max-w-full cursor-text truncate rounded-md px-1.5 py-0.5 text-left"
      >
        {title || 'Untitled'}
      </button>
    </h1>
  );
}
