import { useEffect, useState } from 'react';
import {
  closeMiniWindow,
  currentWindowId,
  listMiniWindows,
  onMiniWindowsChange,
  promoteMiniWindow,
  type MiniWindow,
} from '@/src/lib/miniWindows';
import { displayHost } from '@/src/lib/url';
import { CloseIcon } from '../icons';
import { Favicon } from '../main/Favicon';

/**
 * While a link is open in a mini window, a small bar here offers to open it in
 * this window ("Open here") or close it. Shows nothing otherwise.
 */
export function MiniWindowBar() {
  const [minis, setMinis] = useState<MiniWindow[]>([]);

  useEffect(() => {
    let live = true;
    const load = () => void listMiniWindows().then((m) => live && setMinis(m));
    load();
    const off = onMiniWindowsChange(load);
    // Titles fill in once the page loads; refresh when coming back to this tab.
    window.addEventListener('focus', load);
    return () => {
      live = false;
      off();
      window.removeEventListener('focus', load);
    };
  }, []);

  if (minis.length === 0) return null;
  return (
    <div
      role="region"
      aria-label="Mini windows"
      className="animate-pop fixed right-4 bottom-4 z-30 flex w-80 flex-col gap-1.5"
    >
      {minis.map((m) => {
        const title = m.title || displayHost(m.url) || 'Mini window';
        return (
          <div
            key={m.windowId}
            className="border-line bg-surface-strong flex items-center gap-2.5 rounded-xl border p-2 pl-3 shadow-(--shadow-pop) backdrop-blur-xl"
          >
            <Favicon url={m.url} title={title} size={16} />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[13px]">{title}</span>
              <span className="text-ink-faint block text-[11px]">
                Open in a mini window
              </span>
            </span>
            <button
              type="button"
              className="bg-accent-strong shrink-0 rounded-lg px-2.5 py-1 text-xs text-white hover:opacity-90"
              onClick={() =>
                void currentWindowId().then((here) => promoteMiniWindow(m.windowId, here))
              }
            >
              Open here
            </button>
            <button
              type="button"
              aria-label={`Close mini window “${title}”`}
              className="text-ink-faint hover:text-ink hover:bg-hover shrink-0 rounded-md p-1"
              onClick={() => void closeMiniWindow(m.windowId)}
            >
              <CloseIcon />
            </button>
          </div>
        );
      })}
    </div>
  );
}
