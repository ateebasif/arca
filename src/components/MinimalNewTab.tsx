import { Toaster } from './overlays/OverlayHost';
import { QuickSearch } from './quick/QuickSearch';

/** "Minimal search page" New Tab mode: just a bookmark search box. */
export function MinimalNewTab() {
  return (
    <main className="flex h-full flex-col items-center px-4 pt-[22vh]">
      <h1 className="text-ink-faint mb-6 text-sm font-semibold tracking-[0.2em] uppercase">
        Arca
      </h1>
      <QuickSearch limit={8} className="w-full max-w-xl" />
      <a
        href="dashboard.html"
        className="text-ink-faint hover:text-ink mt-auto mb-6 text-xs transition-colors duration-150"
      >
        Open dashboard
      </a>
      <Toaster />
    </main>
  );
}
