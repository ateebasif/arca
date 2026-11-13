import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { compactPath } from '@/src/features/tidy/normalize';
import { openSafely } from '@/src/features/open';
import { getPreviewCache, type Preview } from '@/src/features/previews/cache';
import { useSiteAccess } from '@/src/features/previews/useSiteAccess';
import type { OpenDisposition } from '@/src/lib/tabs';
import { classifyUrl, displayHost } from '@/src/lib/url';
import { getPath } from '@/src/store/selectors';
import { getBookmarkStore } from '@/src/store/useBookmarks';
import { HOVER_DELAY_MS, LEAVE_GRACE_MS } from './timing';

interface Target {
  el: HTMLElement;
  id: string;
  url: string;
}

/** Loaded only when link previews are switched on (see PreviewController). */
export default function ActivePreviews() {
  const { granted: access } = useSiteAccess();
  const [target, setTarget] = useState<Target | null>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const showTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const hideTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const active = access === true;

  useEffect(() => {
    if (!active) return;
    let current: HTMLElement | null = null;
    const inCard = (node: EventTarget | null) =>
      node instanceof Node && !!cardRef.current?.contains(node);

    const findTarget = (node: EventTarget | null): Target | null => {
      const el =
        node instanceof Element ? node.closest<HTMLElement>('[data-bookmark-id]') : null;
      const id = el?.dataset.bookmarkId;
      if (!el || !id) return null;
      const url = getBookmarkStore().getSnapshot().nodes.get(id)?.url;
      if (!url || classifyUrl(url) !== 'web' || !/^https?:/i.test(url)) return null;
      return { el, id, url };
    };
    const hideNow = () => {
      current = null;
      clearTimeout(showTimer.current);
      clearTimeout(hideTimer.current);
      setTarget(null);
    };
    const hideSoon = () => {
      clearTimeout(hideTimer.current);
      hideTimer.current = setTimeout(hideNow, LEAVE_GRACE_MS);
    };
    const schedule = (e: Event) => {
      if (inCard(e.target)) {
        clearTimeout(hideTimer.current);
        return;
      }
      const next = findTarget(e.target);
      if (!next) return;
      clearTimeout(hideTimer.current);
      if (next.el === current) return;
      clearTimeout(showTimer.current);
      current = next.el;
      showTimer.current = setTimeout(() => setTarget(next), HOVER_DELAY_MS);
    };
    // Only leaving the previewed bookmark (or its card) closes it, after a
    // short grace period so the pointer can travel into the card.
    const leave = (e: Event) => {
      const related = (e as PointerEvent | FocusEvent).relatedTarget;
      if (inCard(e.target)) {
        if (!inCard(related) && !(related instanceof Node && current?.contains(related)))
          hideSoon();
        return;
      }
      if (!current || findTarget(e.target)?.el !== current) return;
      if (related instanceof Node && (current.contains(related) || inCard(related)))
        return;
      // A keyboard-focused bookmark keeps its preview while the mouse wanders.
      if (e.type === 'pointerout' && current.contains(document.activeElement)) return;
      clearTimeout(showTimer.current);
      hideSoon();
    };
    const onScroll = (e: Event) => !inCard(e.target) && hideNow();
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && hideNow();
    const onDown = (e: PointerEvent) => !inCard(e.target) && hideNow();

    document.addEventListener('pointerover', schedule);
    document.addEventListener('focusin', schedule);
    document.addEventListener('pointerout', leave);
    document.addEventListener('focusout', leave);
    document.addEventListener('scroll', onScroll, true);
    document.addEventListener('keydown', onKey);
    document.addEventListener('pointerdown', onDown);
    return () => {
      clearTimeout(showTimer.current);
      clearTimeout(hideTimer.current);
      document.removeEventListener('pointerover', schedule);
      document.removeEventListener('focusin', schedule);
      document.removeEventListener('pointerout', leave);
      document.removeEventListener('focusout', leave);
      document.removeEventListener('scroll', onScroll, true);
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('pointerdown', onDown);
    };
  }, [active]);

  if (!active || !target) return null;
  return (
    <PreviewCard
      key={target.url}
      ref={cardRef}
      target={target}
      onDone={() => setTarget(null)}
    />
  );
}

const CARD_WIDTH = 340;
const dateFormat = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' });

function PreviewCard({
  ref,
  target,
  onDone,
}: {
  ref: React.RefObject<HTMLDivElement | null>;
  target: Target;
  onDone(): void;
}) {
  const { el: anchor, url, id } = target;
  const [preview, setPreview] = useState<Preview | null>(null);
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
    const height = ref.current?.offsetHeight ?? 240;
    const right = a.right + 10;
    const left =
      right + CARD_WIDTH < window.innerWidth - 8 ? right : a.left - CARD_WIDTH - 10;
    setPos({
      left: Math.max(8, left),
      top: Math.max(8, Math.min(a.top, window.innerHeight - height - 8)),
    });
  }, [anchor, preview, ref]);

  const state = getBookmarkStore().getSnapshot();
  const node = state.nodes.get(id);
  const folderPath = getPath(state, node?.parentId ?? '')
    .map((n) => n.title || 'Untitled')
    .join(' / ');
  const host = displayHost(url);
  const open = (how: OpenDisposition) => {
    onDone();
    void openSafely(url, how);
  };

  return createPortal(
    <div
      ref={ref}
      role="dialog"
      aria-label={`Preview of ${preview?.status === 'ok' ? preview.title || host : host}`}
      data-testid="link-preview"
      className="animate-pop border-line bg-surface-strong fixed z-30 flex max-h-[min(560px,calc(100vh-16px))] flex-col overflow-hidden rounded-(--radius-panel) border shadow-(--shadow-pop) backdrop-blur-xl"
      style={{ width: CARD_WIDTH, left: pos?.left ?? -9999, top: pos?.top ?? -9999 }}
    >
      {!preview ? (
        <div className="flex flex-col gap-2 p-3.5" aria-label="Loading preview">
          <div className="bg-hover aspect-[1.91/1] w-full animate-pulse rounded-lg" />
          <div className="bg-hover h-3 w-3/4 animate-pulse rounded" />
          <div className="bg-hover h-3 w-1/2 animate-pulse rounded" />
        </div>
      ) : (
        <>
          <div
            className="min-h-0 flex-1 overflow-y-auto overscroll-contain"
            data-preview-scroll
          >
            {preview.status === 'ok' && preview.image && (
              <img
                src={preview.image}
                alt=""
                className="bg-hover aspect-[1.91/1] w-full object-cover"
                draggable={false}
              />
            )}
            <div className="flex flex-col gap-2 p-3.5">
              <p className="text-[13px] leading-snug font-semibold">
                {preview.status === 'ok'
                  ? preview.title || node?.title || host
                  : node?.title || host}
              </p>
              {preview.status === 'error' && (
                <p className="text-ink-muted text-xs">No preview available for {host}.</p>
              )}
              {preview.status === 'ok' && preview.description && (
                <p className="text-ink-muted text-xs leading-relaxed">
                  {preview.description}
                </p>
              )}
              {preview.status === 'ok' && preview.headings.length > 0 && (
                <ul className="border-line flex flex-col gap-1 border-l-2 pl-2.5">
                  {preview.headings.map((h) => (
                    <li key={h} className="text-ink text-xs">
                      {h}
                    </li>
                  ))}
                </ul>
              )}
              {preview.status === 'ok' && preview.excerpt && (
                <p className="text-ink-muted text-xs leading-relaxed">
                  {preview.excerpt}
                </p>
              )}
              <dl className="text-ink-faint grid grid-cols-[auto_1fr] gap-x-2 gap-y-0.5 text-[11px]">
                {preview.status === 'ok' && preview.siteName && (
                  <>
                    <dt>Site</dt>
                    <dd className="truncate">{preview.siteName}</dd>
                  </>
                )}
                {folderPath && (
                  <>
                    <dt>Folder</dt>
                    <dd className="truncate" title={folderPath}>
                      {compactPath(folderPath)}
                    </dd>
                  </>
                )}
                {node?.dateAdded ? (
                  <>
                    <dt>Added</dt>
                    <dd>{dateFormat.format(node.dateAdded)}</dd>
                  </>
                ) : null}
                <dt>Link</dt>
                <dd className="break-all select-text">{url}</dd>
              </dl>
            </div>
          </div>
          <div className="border-line flex shrink-0 gap-1 border-t p-1.5">
            {(
              [
                ['current', 'Open'],
                ['new-tab', 'New tab'],
                ['window', 'Mini window'],
              ] as const
            ).map(([how, label]) => (
              <button
                key={how}
                type="button"
                onClick={() => open(how)}
                className="text-ink-muted hover:bg-hover hover:text-ink h-8 flex-1 rounded-lg text-xs font-medium transition-colors duration-150"
              >
                {label}
              </button>
            ))}
          </div>
        </>
      )}
    </div>,
    document.body,
  );
}
