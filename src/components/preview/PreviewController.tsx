import { lazy, Suspense } from 'react';
import { useSettings } from '@/src/store/settings';

export { HOVER_DELAY_MS, LEAVE_GRACE_MS } from './timing';

// Fetching, parsing and the card UI load only once previews are switched on.
const ActivePreviews = lazy(() => import('./ActivePreviews'));

/**
 * Shows a preview card when a bookmark is hovered or focused for a moment.
 * Doesn't touch the permissions API or load any preview code unless link
 * previews are switched on in Settings.
 */
export function PreviewController() {
  const enabled = useSettings((s) => s.linkPreviews);
  if (!enabled) return null;
  return (
    <Suspense fallback={null}>
      <ActivePreviews />
    </Suspense>
  );
}
