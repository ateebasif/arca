import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { getPreviewCache, type Preview } from '@/src/features/previews/cache';
import { useSiteAccess } from '@/src/features/previews/useSiteAccess';
import { classifyUrl, displayHost } from '@/src/lib/url';
import { useSettings } from '@/src/store/settings';
import { getBookmarkStore } from '@/src/store/useBookmarks';

export const HOVER_DELAY_MS = 450;

interface Target {
  el: HTMLElement;
  url: string;
}

/**
 * Shows a preview card when a bookmark is hovered or focused for a moment.
 * Only active when link previews are on AND site access is granted. Uses event
 * delegation on [data-bookmark-id], so tiles and rows need no changes.
 */
export function PreviewController() {
  const enabled = useSettings((s) => s.linkPreviews);
  // Don't touch the permissions API at all unless previews are switched on.
  return enabled ? <ActivePreviews /> : null;
}

function ActivePreviews() {
  const { granted: access } = useSiteAccess();
  const [target, setTarget] = useState<Target | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const active = access === true;

  useEffect(() => {
    if (!active) return;
    const findTarget = (node: EventTarget | null): Target | null => {
      const el =
        node instanceof Element ? node.closest<HTMLElement>('[data-bookmark-id]') : null;
      if (!el?.dataset.bookmarkId) return null;
      const url = getBookmarkStore().getSnapshot().nodes.get(el.dataset.bookmarkId)?.url;
      if (!url || classifyUrl(url) !== 'web' || !/^https?:/i.test(url)) return null;
      return { el, url };
    };
    // The bookmark element currently previewed or about to be.
    let current: HTMLElement | null = null;
    const schedule = (e: Event) => {
      const next = findTarget(e.target);
      if (!next || next.el === current) return;
      clearTimeout(timer.current);
      current = next.el;
      timer.current = setTimeout(() => setTarget(next), HOVER_DELAY_MS);
    };
    // Only leaving the previewed bookmark itself hides the card; unrelated
    // focus or pointer changes elsewhere on the page are ignored.
    const leave = (e: Event) => {
      if (!current || findTarget(e.target)?.el !== current) return;
      const related = (e as PointerEvent | FocusEvent).relatedTarget;
      if (related instanceof Node && current.contains(related)) return;
      // A keyboard-focused bookmark keeps its preview while the mouse wanders.
      if (e.type === 'pointerout' && current.contains(document.activeElement)) return;
      current = null;
      clearTimeout(timer.current);
      setTarget(null);
    };
    const hide = () => {
      current = null;
      clearTimeout(timer.current);
      setTarget(null);
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && hide();
    document.addEventListener('pointerover', schedule);
    document.addEventListener('focusin', schedule);
    document.addEventListener('pointerout', leave);
    document.addEventListener('focusout', leave);
    document.addEventListener('scroll', hide, true);
    document.addEventListener('keydown', onKey);
    document.addEventListener('pointerdown', hide);
    return () => {
      clearTimeout(timer.current);
      document.removeEventListener('pointerover', schedule);
      document.removeEventListener('focusin', schedule);
      document.removeEventListener('pointerout', leave);
      document.removeEventListener('focusout', leave);
      document.removeEventListener('scroll', hide, true);
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('pointerdown', hide);
    };
  }, [active]);

  if (!active || !target) return null;
  return <PreviewCard key={target.url} anchor={target.el} url={target.url} />;
}

const CARD_WIDTH = 320;

function PreviewCard({ anchor, url }: { anchor: HTMLElement; url: string }) {
  const [preview, setPreview] = useState<Preview | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null);

  useEffect(() => {
    let alive = true;
    void getPreviewCache()
      .get(url)
      .then((p) => alive && setPreview(p));
    return () => {
      alive = false;
    };
  }, [url]);

  useLayoutEffect(() => {
    const a = anchor.getBoundingClientRect();
    const height = ref.current?.offsetHeight ?? 200;
    const right = a.right + 10;
    const left =
      right + CARD_WIDTH < window.innerWidth - 8 ? right : a.left - CARD_WIDTH - 10;
    setPos({
      left: Math.max(8, left),
      top: Math.max(8, Math.min(a.top, window.innerHeight - height - 8)),
    });
  }, [anchor, preview]);

  const host = displayHost(url);
  return createPortal(
    <div
      ref={ref}
      role="tooltip"
      data-testid="link-preview"
      className="animate-pop border-line bg-surface-strong pointer-events-none fixed z-30 overflow-hidden rounded-(--radius-panel) border shadow-(--shadow-pop) backdrop-blur-xl"
      style={{ width: CARD_WIDTH, left: pos?.left ?? -9999, top: pos?.top ?? -9999 }}
    >
      {!preview ? (
        <div className="flex flex-col gap-2 p-3.5" aria-label="Loading preview">
          <div className="bg-hover aspect-[1.91/1] w-full animate-pulse rounded-lg" />
          <div className="bg-hover h-3 w-3/4 animate-pulse rounded" />
          <div className="bg-hover h-3 w-1/2 animate-pulse rounded" />
        </div>
      ) : preview.status === 'error' ? (
        <p className="text-ink-muted p-3.5 text-xs">No preview available for {host}.</p>
      ) : (
        <>
          {preview.image && (
            <img
              src={preview.image}
              alt=""
              className="bg-hover aspect-[1.91/1] w-full object-cover"
              draggable={false}
            />
          )}
          <div className="p-3.5">
            <p className="line-clamp-2 text-[13px] leading-snug font-semibold">
              {preview.title || host}
            </p>
            {preview.description && (
              <p className="text-ink-muted mt-1 line-clamp-3 text-xs leading-relaxed">
                {preview.description}
              </p>
            )}
            <p className="text-ink-faint mt-2 truncate text-[11px]">
              {preview.siteName ? `${preview.siteName} · ${host}` : host}
            </p>
          </div>
        </>
      )}
    </div>,
    document.body,
  );
}
