import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { bookmarkLinkProps } from '@/src/features/open';
import { getTopSites, type TopSite } from '@/src/lib/topSites';
import { classifyUrl, displayHost } from '@/src/lib/url';
import { getPath, recentlyAdded } from '@/src/store/selectors';
import { useSettings } from '@/src/store/settings';
import { openSafely } from '@/src/features/open';
import { SUPPORT_LINKS } from '@/src/features/support/links';
import { useBookmarks } from '@/src/store/useBookmarks';
import { Favicon } from './Favicon';

const RECENT_COUNT = 12;
const when = new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'short' });

/**
 * Home: your 12 most recently added bookmarks and the browser's most visited
 * sites. Either section can be hidden (and shown again here or in Settings).
 */
export function HomeView() {
  const state = useBookmarks();
  const showRecent = useSettings((s) => s.homeRecent);
  const showVisited = useSettings((s) => s.homeMostVisited);
  const update = useSettings((s) => s.update);
  const recent = useMemo(() => recentlyAdded(state, RECENT_COUNT), [state]);
  const [sites, setSites] = useState<TopSite[] | null>(null);

  useEffect(() => {
    if (!showVisited) return;
    let alive = true;
    void getTopSites(12)
      .then((list) => alive && setSites(list.filter((s) => classifyUrl(s.url) === 'web')))
      .catch(() => alive && setSites([]));
    return () => {
      alive = false;
    };
  }, [showVisited]);

  if (!showRecent && !showVisited) {
    return (
      <div className="text-ink-muted py-16 text-center text-[13px]" data-home>
        <p>Both Home sections are hidden.</p>
        <button
          type="button"
          className="text-accent mt-2 hover:underline"
          onClick={() => void update({ homeRecent: true, homeMostVisited: true })}
        >
          Show them again
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-8 pt-2" data-home>
      <SupportCard />
      {showVisited && (
        <Section
          title="Most visited"
          onHide={() => void update({ homeMostVisited: false })}
        >
          {sites === null ? null : sites.length === 0 ? (
            <p className="text-ink-faint text-xs">Sites you visit often show up here.</p>
          ) : (
            <ul className="grid grid-cols-[repeat(auto-fill,minmax(7.5rem,1fr))] gap-2">
              {sites.map((site) => (
                <li key={site.url}>
                  <SiteTile url={site.url} title={site.title} />
                </li>
              ))}
            </ul>
          )}
        </Section>
      )}
      {showRecent && (
        <Section title="Recently added" onHide={() => void update({ homeRecent: false })}>
          {recent.length === 0 ? (
            <p className="text-ink-faint text-xs">Nothing bookmarked yet.</p>
          ) : (
            <ul className="grid grid-cols-[repeat(auto-fill,minmax(16rem,1fr))] gap-2">
              {recent.map((b) => {
                const folder = getPath(state, b.parentId ?? '').at(-1);
                const link = bookmarkLinkProps(b.url);
                return (
                  <li key={b.id} data-home-recent={b.id}>
                    <a
                      href={link.href}
                      onClick={link.onActivate}
                      title={b.url}
                      className="border-line bg-surface hover:border-accent/35 flex h-14 items-center gap-3 rounded-xl border px-3 shadow-(--shadow-tile) transition-colors duration-150"
                    >
                      <Favicon url={b.url ?? ''} title={b.title} size={20} />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[13px] font-medium">
                          {b.title || displayHost(b.url ?? '')}
                        </span>
                        <span className="text-ink-faint block truncate text-[11px]">
                          {when.format(b.dateAdded)}
                          {folder && ` · ${folder.title || 'Untitled'}`}
                        </span>
                      </span>
                    </a>
                  </li>
                );
              })}
            </ul>
          )}
        </Section>
      )}
    </div>
  );
}

function SiteTile({ url, title }: { url: string; title: string }) {
  const link = bookmarkLinkProps(url);
  return (
    <a
      href={link.href}
      onClick={link.onActivate}
      title={`${title}\n${url}`}
      className="border-line bg-surface hover:border-accent/35 flex h-24 flex-col items-center justify-center gap-2 rounded-xl border px-2 shadow-(--shadow-tile) transition-colors duration-150"
    >
      <span className="grid size-10 place-items-center rounded-[10px] bg-white/95 shadow-sm">
        <Favicon url={url} title={title} size={24} />
      </span>
      <span className="w-full truncate text-center text-xs">
        {title || displayHost(url)}
      </span>
    </a>
  );
}

function Section({
  title,
  onHide,
  children,
}: {
  title: string;
  onHide(): void;
  children: ReactNode;
}) {
  return (
    <section aria-label={title} className="flex flex-col gap-2.5">
      <div className="flex items-center justify-between">
        <h2 className="text-ink-muted text-[11px] font-medium tracking-wide uppercase">
          {title}
        </h2>
        <button
          type="button"
          onClick={onHide}
          aria-label={`Hide ${title}`}
          className="text-ink-faint hover:text-ink text-xs"
        >
          Hide
        </button>
      </div>
      {children}
    </section>
  );
}

/** Show the "Enjoying Arca?" card once Arca has been in use this long. */
export const SUPPORT_CARD_AFTER_MS = 14 * 24 * 60 * 60 * 1000;

/**
 * A one-time, dismissible "Enjoying Arca?" card on Home, two weeks after
 * Arca was first used. Either button hides it for good.
 */
function SupportCard() {
  const firstUsedAt = useSettings((s) => s.firstUsedAt);
  const done = useSettings((s) => s.supportCardDone);
  const update = useSettings((s) => s.update);
  const [now] = useState(() => Date.now());
  if (done || !firstUsedAt || now - firstUsedAt < SUPPORT_CARD_AFTER_MS) return null;
  const finish = () => void update({ supportCardDone: true });
  return (
    <section
      aria-label="Enjoying Arca?"
      className="border-line bg-surface flex flex-wrap items-center gap-3 rounded-xl border px-4 py-3"
    >
      <span className="text-xl" aria-hidden="true">
        ☕
      </span>
      <p className="text-ink-muted min-w-56 flex-1 text-[13px] leading-relaxed">
        <span className="text-ink font-medium">Enjoying Arca?</span> It's free, private
        and made by one person. If it has saved you time, you can buy me a coffee.
      </p>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => {
            void openSafely(SUPPORT_LINKS.coffee, 'new-tab');
            finish();
          }}
          className="bg-accent-strong hover:bg-accent h-8 rounded-lg px-3 text-xs font-medium text-white"
        >
          Buy me a coffee
        </button>
        <button
          type="button"
          onClick={finish}
          className="text-ink-muted hover:text-ink hover:bg-hover h-8 rounded-lg px-3 text-xs"
        >
          No thanks
        </button>
      </div>
    </section>
  );
}
