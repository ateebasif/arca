import { getPath } from '@/src/store/selectors';
import { useBookmarks } from '@/src/store/useBookmarks';
import { useUi } from '@/src/store/ui';
import { ChevronRight } from '../icons';

/** Path to the open folder. Every crumb but the last opens that folder. */
export function Breadcrumbs() {
  const state = useBookmarks();
  const currentFolderId = useUi((s) => s.currentFolderId);
  const openFolder = useUi((s) => s.openFolder);
  const path = getPath(state, currentFolderId);

  return (
    <nav aria-label="Breadcrumb" className="min-w-0">
      <ol className="flex min-w-0 items-center gap-0.5 text-[15px]">
        {path.map((node, i) => {
          const last = i === path.length - 1;
          return (
            <li
              key={node.id}
              className={`flex items-center gap-0.5 ${last ? 'min-w-0' : 'shrink-0'}`}
            >
              {i > 0 && (
                <ChevronRight width={12} height={12} className="text-ink-faint" />
              )}
              {last ? (
                <h1 aria-current="page" className="truncate px-1.5 font-semibold">
                  {node.title || 'Untitled'}
                </h1>
              ) : (
                <button
                  type="button"
                  onClick={() => openFolder(node.id)}
                  className="text-ink-muted hover:bg-hover hover:text-ink max-w-48 truncate rounded-md px-1.5 py-0.5"
                >
                  {node.title || 'Untitled'}
                </button>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
