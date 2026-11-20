import { openSafely } from '@/src/features/open';
import { SUPPORT_LINKS } from '@/src/features/support/links';
import { Button } from './Dialog';

/** Settings → Support Arca: optional tip links (opened in a new tab). */
export function SupportSettings() {
  return (
    <section aria-label="Support Arca" className="border-line mt-4 border-t pt-4">
      <p className="text-[13px] font-medium">Support Arca</p>
      <p className="text-ink-muted mt-0.5 mb-2 text-xs leading-relaxed">
        Arca is free, private and open source. If it's useful to you, you can buy me a
        coffee or become a supporter on Patreon. Thank you!
      </p>
      <div className="flex flex-wrap gap-2">
        <Button onClick={() => void openSafely(SUPPORT_LINKS.coffee, 'new-tab')}>
          ☕ Buy me a coffee
        </Button>
        <Button onClick={() => void openSafely(SUPPORT_LINKS.patreon, 'new-tab')}>
          Become a supporter
        </Button>
      </div>
    </section>
  );
}
