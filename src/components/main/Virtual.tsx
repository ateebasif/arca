import { useVirtualizer } from '@tanstack/react-virtual';
import {
  useContext,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from 'react';
import { ScrollParentContext } from './scrollParent';

/** Width of an element, kept current with ResizeObserver. */
function useWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState(0);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    setWidth(el.clientWidth);
    const observer = new ResizeObserver(([entry]) => {
      if (entry) setWidth(entry.contentRect.width);
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  return [ref, width] as const;
}

interface VirtualRowsProps<T> {
  items: readonly T[];
  /** Fixed height of one row, including the gap below it. */
  rowHeight: number;
  /** Minimum column width; 0 renders one item per row (list view). */
  minColumnWidth: number;
  gap: number;
  getKey(item: T): string;
  render(item: T): ReactNode;
  /** Index of an item to scroll into view (for "show in folder"). */
  scrollToIndex?: number;
  className?: string;
}

/**
 * Renders only the rows in (and near) the viewport. Grid rows hold as many
 * items as fit the measured width; list rows hold one.
 */
export function VirtualRows<T>({
  items,
  rowHeight,
  minColumnWidth,
  gap,
  getKey,
  render,
  scrollToIndex,
  className = '',
}: VirtualRowsProps<T>) {
  const scrollParent = useContext(ScrollParentContext);
  const [ref, width] = useWidth<HTMLDivElement>();
  const columns =
    minColumnWidth > 0
      ? Math.max(1, Math.floor((width + gap) / (minColumnWidth + gap)))
      : 1;
  const rowCount = Math.ceil(items.length / columns);

  // TanStack Virtual returns non-memoizable functions; that only matters under
  // the React Compiler, which this project doesn't use.
  // eslint-disable-next-line react-hooks/incompatible-library
  const virtualizer = useVirtualizer({
    count: rowCount,
    getScrollElement: () => scrollParent,
    estimateSize: () => rowHeight,
    overscan: 4,
    scrollMargin: ref.current?.offsetTop ?? 0,
  });

  useEffect(() => {
    if (scrollToIndex === undefined || scrollToIndex < 0) return;
    virtualizer.scrollToIndex(Math.floor(scrollToIndex / columns), { align: 'center' });
  }, [scrollToIndex, columns, virtualizer]);

  const virtualRows = virtualizer.getVirtualItems();
  const margin = virtualizer.options.scrollMargin;

  return (
    <div
      ref={ref}
      className={`relative w-full ${className}`}
      style={{ height: virtualizer.getTotalSize() }}
      data-virtualized="true"
    >
      {virtualRows.map((row) => {
        const start = row.index * columns;
        const rowItems = items.slice(start, start + columns);
        return (
          <div
            key={row.key}
            role="presentation"
            className="absolute inset-x-0 grid"
            style={{
              top: row.start - margin,
              height: rowHeight - gap,
              gap,
              gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
            }}
          >
            {rowItems.map((item, j) => (
              <div
                key={getKey(item)}
                data-tile=""
                className="@container min-w-0"
                style={{ '--i': Math.min(row.index * columns + j, 24) } as CSSProperties}
              >
                {render(item)}
              </div>
            ))}
          </div>
        );
      })}
    </div>
  );
}
