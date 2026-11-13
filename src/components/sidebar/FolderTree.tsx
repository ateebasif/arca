import { memo, useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import type { BNode, BookmarkSnapshot } from '@/src/store/bookmarkStore';
import { folderCounts, getPath } from '@/src/store/selectors';
import { useBookmarks } from '@/src/store/useBookmarks';
import { useUi } from '@/src/store/ui';
import { BarIcon, ChevronRight, FolderIcon } from '../icons';

interface Row {
  node: BNode;
  depth: number;
  hasChildFolders: boolean;
  expanded: boolean;
}

function visibleRows(state: BookmarkSnapshot, expanded: ReadonlySet<string>): Row[] {
  const rows: Row[] = [];
  const visit = (id: string, depth: number) => {
    const node = state.nodes.get(id);
    if (!node?.childIds) return;
    const childFolders = node.childIds.filter((c) => state.nodes.get(c)?.childIds);
    const isExpanded = expanded.has(id);
    rows.push({
      node,
      depth,
      hasChildFolders: childFolders.length > 0,
      expanded: isExpanded,
    });
    if (isExpanded) childFolders.forEach((c) => visit(c, depth + 1));
  };
  state.rootIds.forEach((id) => visit(id, 0));
  return rows;
}

/** Sidebar folder tree (WAI-ARIA tree pattern with roving focus). */
export function FolderTree() {
  const state = useBookmarks();
  const currentFolderId = useUi((s) => s.currentFolderId);
  const expandedList = useUi((s) => s.expanded);
  const openFolder = useUi((s) => s.openFolder);
  const setExpanded = useUi((s) => s.setExpanded);
  const expandAll = useUi((s) => s.expandAll);

  const expanded = useMemo(() => new Set(expandedList), [expandedList]);
  const rows = useMemo(() => visibleRows(state, expanded), [state, expanded]);
  const counts = folderCounts(state);
  const [focusedId, setFocusedId] = useState<string | null>(null);
  const treeRef = useRef<HTMLUListElement>(null);

  // Reveal the current folder when it changes from elsewhere (grid,
  // breadcrumbs). Only on change, so the user can still collapse its parents.
  const revealedFor = useRef<string | null>(null);
  useEffect(() => {
    if (!state.ready || revealedFor.current === currentFolderId) return;
    revealedFor.current = currentFolderId;
    const ancestors = getPath(state, currentFolderId)
      .slice(0, -1)
      .map((n) => n.id);
    expandAll(ancestors);
  }, [currentFolderId, state, expandAll]);

  const tabStopId =
    rows.find((r) => r.node.id === focusedId)?.node.id ??
    rows.find((r) => r.node.id === currentFolderId)?.node.id ??
    rows[0]?.node.id;

  const focusRow = (id: string | undefined) => {
    if (!id) return;
    setFocusedId(id);
    treeRef.current
      ?.querySelector<HTMLElement>(`[data-folder-id="${CSS.escape(id)}"]`)
      ?.focus();
  };

  const onKeyDown = (event: KeyboardEvent<HTMLUListElement>) => {
    const index = rows.findIndex((r) => r.node.id === (focusedId ?? tabStopId));
    const row = rows[index];
    if (!row) return;
    const handled = () => {
      event.preventDefault();
      event.stopPropagation();
    };
    switch (event.key) {
      case 'ArrowDown':
        handled();
        focusRow(rows[index + 1]?.node.id);
        break;
      case 'ArrowUp':
        handled();
        focusRow(rows[index - 1]?.node.id);
        break;
      case 'Home':
        handled();
        focusRow(rows[0]?.node.id);
        break;
      case 'End':
        handled();
        focusRow(rows.at(-1)?.node.id);
        break;
      case 'ArrowRight':
        handled();
        if (row.hasChildFolders && !row.expanded) setExpanded(row.node.id, true);
        else if (row.expanded) focusRow(rows[index + 1]?.node.id);
        break;
      case 'ArrowLeft':
        handled();
        if (row.expanded) setExpanded(row.node.id, false);
        else if (row.depth > 0) focusRow(row.node.parentId ?? undefined);
        break;
      case 'Enter':
      case ' ':
        handled();
        openFolder(row.node.id);
        break;
    }
  };

  return (
    <ul
      ref={treeRef}
      role="tree"
      aria-label="Folders"
      className="flex flex-col gap-px px-2 pb-4"
      onKeyDown={onKeyDown}
    >
      {rows.map((row) => (
        <TreeRow
          key={row.node.id}
          row={row}
          count={counts.get(row.node.id) ?? 0}
          selected={row.node.id === currentFolderId}
          tabbable={row.node.id === tabStopId}
          onOpen={openFolder}
          onToggle={setExpanded}
          onFocus={setFocusedId}
        />
      ))}
    </ul>
  );
}

interface TreeRowProps {
  row: Row;
  count: number;
  selected: boolean;
  tabbable: boolean;
  onOpen(id: string): void;
  onToggle(id: string, expanded: boolean): void;
  onFocus(id: string): void;
}

const TreeRow = memo(function TreeRow({
  row,
  count,
  selected,
  tabbable,
  onOpen,
  onToggle,
  onFocus,
}: TreeRowProps) {
  const { node, depth, hasChildFolders, expanded } = row;
  const Icon = node.isRoot && depth === 0 && node.id === '1' ? BarIcon : FolderIcon;
  return (
    <li
      role="treeitem"
      aria-level={depth + 1}
      aria-selected={selected}
      aria-expanded={hasChildFolders ? expanded : undefined}
      data-folder-id={node.id}
      tabIndex={tabbable ? 0 : -1}
      onFocus={(e) => e.target === e.currentTarget && onFocus(node.id)}
      onClick={() => onOpen(node.id)}
      className={`group flex h-8 items-center gap-1.5 rounded-lg pr-2 text-[13px] outline-offset-[-2px] transition-colors duration-150 select-none ${
        selected
          ? 'bg-accent-soft text-ink font-medium'
          : 'text-ink-muted hover:bg-hover hover:text-ink'
      }`}
      style={{ paddingLeft: 6 + depth * 14 }}
    >
      <span
        aria-hidden="true"
        onClick={(e) => {
          if (!hasChildFolders) return;
          e.stopPropagation();
          onToggle(node.id, !expanded);
        }}
        className={`grid size-4 shrink-0 place-items-center rounded transition-transform duration-150 ${
          hasChildFolders ? 'hover:bg-hover' : 'invisible'
        } ${expanded ? 'rotate-90' : ''}`}
      >
        <ChevronRight width={12} height={12} />
      </span>
      <Icon className={`shrink-0 ${selected ? 'text-accent' : ''}`} />
      <span className="min-w-0 flex-1 truncate">{node.title || 'Untitled'}</span>
      <span className="text-ink-faint text-[11px] tabular-nums">{count || ''}</span>
    </li>
  );
});
