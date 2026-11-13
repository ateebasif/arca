import '@/src/boot';
import { Dashboard } from '@/src/components/Dashboard';
import { MinimalNewTab } from '@/src/components/MinimalNewTab';
import { mount } from '@/src/lib/mount';
import { hydrateSettings, redirectTarget } from '@/src/store/settings';
import { hydrateUi } from '@/src/store/ui';
import { getBookmarkStore } from '@/src/store/useBookmarks';

// Settings decide what this tab is, so read them first (a few ms). Bookmarks
// and UI prefs load in parallel.
void getBookmarkStore().start();
void Promise.all([hydrateSettings(), hydrateUi()]).then(([settings]) => {
  const target = redirectTarget(settings);
  if (target) {
    location.replace(target);
    return;
  }
  mount(
    settings.newTabMode === 'minimal' ? (
      <MinimalNewTab />
    ) : (
      <Dashboard surface="newtab" />
    ),
  );
});
