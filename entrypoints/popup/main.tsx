import { Popup } from '@/src/components/Popup';
import { mount } from '@/src/lib/mount';
import { hydrateSettings } from '@/src/store/settings';
import { getBookmarkStore } from '@/src/store/useBookmarks';

void getBookmarkStore().start();
void hydrateSettings().finally(() => mount(<Popup />));
