import { useEffect } from 'react';
import { pageOrder, useSelection } from '@/src/store/selection';
import { useOverlays } from '@/src/store/overlays';
import { useUi } from '@/src/store/ui';
import { useBookmarks } from '@/src/store/useBookmarks';

const isTyping = (t: EventTarget | null) =>
  t instanceof HTMLElement &&
  (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName));

/**
 * While anything is selected, clicking an item toggles it instead of opening
 * it (⇧-click selects a range). Esc clears, ⌘A selects everything shown.
 * The selection resets when you open another folder, tag or search.
 */
export function SelectionController() {
  const state = useBookmarks();
  const folder = useUi((s) => s.currentFolderId);
  const tag = useUi((s) => s.tagFilter);
  const query = useUi((s) => s.query);
  const scope = useUi((s) => s.scope);

  useEffect(() => useSelection.getState().clear(), [folder, tag, query, scope]);

  // Forget items that were deleted or moved elsewhere.
  useEffect(() => {
    const s = useSelection.getState();
    const gone = [...s.ids].filter((id) => !state.nodes.has(id));
    if (gone.length) s.remove(gone);
  }, [state]);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      const s = useSelection.getState();
      if (s.ids.size === 0 || e.button !== 0) return;
      const target = e.target as Element | null;
      if (!target || target.closest('[data-select-box], [role=menu], [role=dialog]'))
        return;
      // The ⋯ button keeps opening its menu.
      if (target.closest('[data-more-button]')) return;
      const item = target.closest<HTMLElement>('[data-select-id]');
      const id = item?.dataset.selectId;
      if (!id) return;
      e.preventDefault();
      e.stopPropagation();
      if (e.shiftKey) s.extendTo(id, pageOrder());
      else s.toggle(id);
    };
    const onKey = (e: KeyboardEvent) => {
      const s = useSelection.getState();
      const overlays = useOverlays.getState();
      if (
        overlays.ask ||
        overlays.tidyOpen ||
        overlays.tagManagerOpen ||
        overlays.settingsOpen ||
        overlays.editor
      )
        return;
      if (e.key === 'Escape' && s.ids.size) {
        e.preventDefault();
        s.clear();
      } else if (e.key === 'a' && (e.metaKey || e.ctrlKey) && !isTyping(e.target)) {
        const order = pageOrder();
        if (!order.length) return;
        e.preventDefault();
        s.selectAll(order);
      }
    };
    document.addEventListener('click', onClick, true);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('click', onClick, true);
      document.removeEventListener('keydown', onKey);
    };
  }, []);

  return null;
}
