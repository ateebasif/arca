import { defaultDisposition, openSafely } from '../open';
import { useUi } from '@/src/store/ui';
import type { SearchResult } from './search';

export type OpenMode = 'open' | 'new-tab' | 'reveal';

/** Enter = open, mod+Enter = new background tab, alt+Enter = reveal in folder. */
export function openResult(result: SearchResult, mode: OpenMode): void {
  const { node, kind } = result.entry;
  const ui = useUi.getState();
  if (mode === 'reveal' || (kind === 'folder' && mode === 'open')) {
    if (kind === 'folder' && mode === 'open') {
      ui.setQuery('');
      ui.openFolder(node.id);
    } else if (node.parentId) {
      ui.reveal(node.id, node.parentId);
    }
    return;
  }
  if (!node.url) return;
  void openSafely(node.url, mode === 'new-tab' ? 'background' : defaultDisposition());
}
