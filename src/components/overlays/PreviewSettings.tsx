import { useState } from 'react';
import { getPreviewCache } from '@/src/features/previews/cache';
import { useSiteAccess } from '@/src/features/previews/useSiteAccess';
import { removeSiteAccess, requestSiteAccess } from '@/src/lib/permissions';
import { useSettings } from '@/src/store/settings';
import { Button } from './Dialog';

/** Opt-in switch for link previews, with the permission prompt and cache reset. */
export function PreviewSettings() {
  const enabled = useSettings((s) => s.linkPreviews);
  const update = useSettings((s) => s.update);
  const { granted: access, refresh } = useSiteAccess();
  const [note, setNote] = useState<string>();
  const on = enabled && access === true;

  const toggle = async () => {
    setNote(undefined);
    if (on) {
      await update({ linkPreviews: false });
      await removeSiteAccess().catch(() => false);
      await refresh();
      return;
    }
    // Must run inside the click so the browser shows its permission prompt.
    const granted = await requestSiteAccess().catch(() => false);
    if (!granted) {
      setNote('Previews need permission to read sites. Nothing was changed.');
      return;
    }
    await refresh();
    await update({ linkPreviews: true });
  };

  return (
    <div className="mt-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p id="previews-label" className="text-[13px] font-medium">
            Link previews
          </p>
          <p className="text-ink-muted mt-0.5 text-xs leading-relaxed">
            Hover a bookmark to see its title, description and image. Each page is fetched
            once without cookies, then cached on this device for a week.
          </p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={on}
          aria-labelledby="previews-label"
          onClick={() => void toggle()}
          className={`relative mt-0.5 h-5 w-9 shrink-0 rounded-full transition-colors duration-150 ${
            on ? 'bg-accent-strong' : 'bg-line'
          }`}
        >
          <span
            className={`absolute top-0.5 left-0.5 size-4 rounded-full bg-white shadow transition-transform duration-150 ${
              on ? 'translate-x-4' : ''
            }`}
          />
        </button>
      </div>
      {note && (
        <p role="status" className="text-ink-muted mt-2 text-xs">
          {note}
        </p>
      )}
      {on && (
        <Button
          onClick={() =>
            void getPreviewCache()
              .clear()
              .then(() => setNote('Cached previews cleared.'))
          }
        >
          Clear cached previews
        </Button>
      )}
    </div>
  );
}
