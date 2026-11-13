import { Dashboard } from '@/src/components/Dashboard';
import { mount } from '@/src/lib/mount';
import { hydrateSettings } from '@/src/store/settings';
import { hydrateUi } from '@/src/store/ui';
import { getBookmarkStore } from '@/src/store/useBookmarks';

void getBookmarkStore().start();
void Promise.all([hydrateSettings(), hydrateUi()]).finally(() =>
  mount(<Dashboard surface="dashboard" />),
);
