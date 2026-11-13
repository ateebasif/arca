import { useEffect, useMemo, useState } from 'react';
import { defaultDisposition, openSafely } from '@/src/features/open';
import { openExtensionPage } from '@/src/lib/tabs';
import { getTopSites, type TopSite } from '@/src/lib/topSites';
import { classifyUrl, displayHost } from '@/src/lib/url';
import { getChildren, getPath, recentlyAdded } from '@/src/store/selectors';
import { useBookmarks } from '@/src/store/useBookmarks';
import { FolderIcon, GridIcon, SparkleIcon } from './icons';
import { Favicon } from './main/Favicon';

const closePopup = () => window.close();
const open = async (url: string) => {
  if (await openSafely(url, defaultDisposition())) closePopup();
};

/** Popup sections shown while nothing is typed. */
export function PopupHome() {
  const state = useBookmarks();
  const recent = useMemo(() => recentlyAdded(state, 5), [state]);
  const folders = useMemo(() => {
    const bar = state.rootIds[0];
    return bar
      ? getChildren(state, bar)
          .filter((n) => n.childIds)
          .slice(0, 8)
      : [];
  }, [state]);
  const [sites, setSites] = useState<TopSite[]>([]);
  useEffect(() => {
    void getTopSites(8)
      .then((list) => setSites(list.filter((s) => classifyUrl(s.url) === 'web')))
      .catch(() => setSites([]));
  }, []);

  return (
    <div className="flex flex-col gap-3">
      {sites.length > 0 && (
        <Section title="Most visited">
          <ul className="grid grid-cols-8 gap-1">
            {sites.map((site) => (
              <li key={site.url}>
                <button
                  type="button"
                  title={`${site.title}\n${site.url}`}
                  aria-label={site.title || displayHost(site.url)}
                  onClick={() => void open(site.url)}
                  className="hover:bg-hover grid h-10 w-full place-items-center rounded-lg transition-colors duration-150"
                >
                  <Favicon url={site.url} title={site.title} size={20} />
                </button>
              </li>
            ))}
          </ul>
        </Section>
      )}
      {recent.length > 0 && (
        <Section title="Recently added">
          <ul className="flex flex-col">
            {recent.map((b) => (
              <li key={b.id}>
                <button
                  type="button"
                  onClick={() => void open(b.url ?? '')}
                  className="hover:bg-hover flex h-9 w-full items-center gap-2.5 rounded-lg px-2 text-left transition-colors duration-150"
                >
                  <Favicon url={b.url ?? ''} title={b.title} size={16} />
                  <span className="min-w-0 flex-1 truncate text-[13px]">
                    {b.title || displayHost(b.url ?? '')}
                  </span>
                  <span className="text-ink-faint max-w-28 shrink-0 truncate text-[11px]">
                    {getPath(state, b.parentId ?? '').at(-1)?.title}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </Section>
      )}
      {folders.length > 0 && (
        <Section title="Folders">
          <ul className="flex flex-wrap gap-1.5">
            {folders.map((f) => (
              <li key={f.id}>
                <button
                  type="button"
                  onClick={() =>
                    void openExtensionPage(
                      `dashboard.html#folder=${encodeURIComponent(f.id)}`,
                    ).then(closePopup)
                  }
                  className="border-line hover:bg-hover flex h-7 max-w-40 items-center gap-1.5 rounded-full border px-2.5 text-xs transition-colors duration-150"
                >
                  <FolderIcon width={12} height={12} className="text-accent shrink-0" />
                  <span className="truncate">{f.title || 'Untitled'}</span>
                </button>
              </li>
            ))}
          </ul>
        </Section>
      )}
      <div className="border-line flex gap-1 border-t pt-2">
        <FooterButton
          onClick={() => void openExtensionPage('dashboard.html').then(closePopup)}
        >
          <GridIcon /> Open dashboard
        </FooterButton>
        <FooterButton
          onClick={() => void openExtensionPage('dashboard.html#tidy').then(closePopup)}
        >
          <SparkleIcon className="text-accent" /> Tidy up
        </FooterButton>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section aria-label={title}>
      <h2 className="text-ink-faint mb-1 px-1 text-[11px] font-semibold tracking-wide uppercase">
        {title}
      </h2>
      {children}
    </section>
  );
}

function FooterButton({
  onClick,
  children,
}: {
  onClick(): void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="text-ink-muted hover:bg-hover hover:text-ink flex h-9 flex-1 items-center justify-center gap-2 rounded-lg text-[13px] transition-colors duration-150"
    >
      {children}
    </button>
  );
}
