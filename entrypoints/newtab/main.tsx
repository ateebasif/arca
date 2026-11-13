import { Dashboard } from '@/src/components/Dashboard';
import { mount } from '@/src/lib/mount';
import { hydrateUi } from '@/src/store/ui';
import { getBookmarkStore } from '@/src/store/useBookmarks';

// Start loading bookmarks and saved UI prefs in parallel; render once prefs are in
// so the first paint uses the remembered view.
void getBookmarkStore().start();
void hydrateUi().finally(() => mount(<Dashboard surface="newtab" />));
