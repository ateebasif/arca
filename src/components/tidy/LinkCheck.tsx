import { useState } from 'react';
import { updateUrls } from '@/src/features/deadlinks/apply';
import { useSiteAccess } from '@/src/features/previews/useSiteAccess';
import { requestSiteAccess } from '@/src/lib/permissions';
import { displayHost } from '@/src/lib/url';
import type { BNode } from '@/src/store/bookmarkStore';
import { useLinkCheck } from '@/src/store/linkCheck';
import { Favicon } from '../main/Favicon';
import { Button } from '../overlays/Dialog';

const when = new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'short' });

/**
 * Clean out → broken links. Opt-in: checking needs permission to contact the
 * sites (the same one link previews use). Broken links show up as a group in
 * Clean out; moved ones can be pointed at their new address here.
 */
export function LinkCheck({
  links,
}: {
  links: Array<{ id: string; url: string; node: BNode }>;
}) {
  const { granted, refresh } = useSiteAccess();
  const { results, progress, error, start, cancel } = useLinkCheck();
  const [asked, setAsked] = useState(false);
  const [busy, setBusy] = useState(false);

  const checked = links.filter((l) => results.has(l.id));
  const count = (status: string) =>
    checked.filter((l) => results.get(l.id)?.status === status).length;
  // Already updated ones drop out (the bookmark now points at the new address).
  const moved = checked.filter((l) => {
    const r = results.get(l.id);
    return r?.status === 'moved' && r.finalUrl && r.finalUrl !== l.url;
  });
  const latest = Math.max(0, ...checked.map((l) => results.get(l.id)?.checkedAt ?? 0));
  const items = links.map(({ id, url }) => ({ id, url }));

  const run = async (fresh: boolean) => {
    if (!granted) {
      setAsked(true);
      // Must be in the click handler: the browser shows its permission prompt.
      const ok = await requestSiteAccess().catch(() => false);
      await refresh();
      if (!ok) return;
    }
    void start(items, fresh);
  };

  return (
    <div className="border-line bg-surface flex flex-col gap-2 rounded-xl border p-3 text-xs">
      {progress ? (
        <div className="flex items-center gap-3">
          <div className="bg-hover h-1.5 flex-1 overflow-hidden rounded-full">
            <div
              className="bg-accent-strong h-full transition-[width] duration-200"
              style={{
                width: `${Math.round((progress.done / Math.max(1, progress.total)) * 100)}%`,
              }}
            />
          </div>
          <span className="text-ink-muted tabular-nums">
            Checking links {progress.done.toLocaleString()}/
            {progress.total.toLocaleString()}
          </span>
          <Button onClick={cancel}>Stop</Button>
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-ink-muted min-w-48 flex-1">
            {checked.length ? (
              <>
                Checked {checked.length.toLocaleString()} links
                {latest ? ` (${when.format(latest)})` : ''}:{' '}
                <strong className="text-ink">{count('broken')} broken</strong>,{' '}
                {count('moved')} moved, {count('unknown')} couldn't be confirmed.
              </>
            ) : (
              <>
                Find links that no longer work. Arca asks each site for the page's status
                (no cookies, nothing downloaded).
                {!granted &&
                  ' This needs permission to contact the sites, the same one link previews use.'}
              </>
            )}
          </span>
          <Button onClick={() => void run(checked.length > 0)}>
            {checked.length
              ? 'Check again'
              : `Check ${links.length.toLocaleString()} links`}
          </Button>
        </div>
      )}
      {asked && granted === false && (
        <p className="text-ink-faint">
          Permission wasn't granted, so nothing was checked.
        </p>
      )}
      {error && <p className="text-danger">{error}</p>}

      {moved.length > 0 && !progress && (
        <details className="border-line mt-1 border-t pt-2">
          <summary className="text-ink cursor-pointer font-medium">
            {moved.length} moved {moved.length === 1 ? 'link' : 'links'}: update to the
            new address
          </summary>
          <ul className="mt-2 flex flex-col gap-1">
            {moved.slice(0, 50).map(({ id, url, node }) => {
              const to = results.get(id)?.finalUrl ?? url;
              return (
                <li key={id} className="flex items-center gap-2" data-moved-link>
                  <Favicon url={url} title={node.title} size={16} />
                  <span className="min-w-0 flex-1 truncate">
                    {node.title || displayHost(url)}{' '}
                    <span className="text-ink-faint">
                      {displayHost(url)} → {to.replace(/^https?:\/\//, '').slice(0, 60)}
                    </span>
                  </span>
                  <Button
                    disabled={busy}
                    onClick={() => void updateUrls([{ id, url: to }])}
                  >
                    Update
                  </Button>
                </li>
              );
            })}
          </ul>
          <div className="mt-2 flex justify-end">
            <Button
              variant="primary"
              disabled={busy}
              onClick={() => {
                setBusy(true);
                void updateUrls(
                  moved.map(({ id, url }) => ({
                    id,
                    url: results.get(id)?.finalUrl ?? url,
                  })),
                ).finally(() => setBusy(false));
              }}
            >
              Update all {moved.length}
            </Button>
          </div>
        </details>
      )}
    </div>
  );
}
