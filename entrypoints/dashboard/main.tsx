import '@/src/boot';
import { Dashboard } from '@/src/components/Dashboard';
import { mount } from '@/src/lib/mount';
import { hydrateSettings, useSettings } from '@/src/store/settings';
import { hydrateUi, useUi } from '@/src/store/ui';
import { getBookmarkStore } from '@/src/store/useBookmarks';

void getBookmarkStore().start();
void Promise.all([hydrateSettings(), hydrateUi()]).finally(() => {
  if (useSettings.getState().startOnHome) useUi.getState().showHome();
  mount(<Dashboard surface="dashboard" />);
});
