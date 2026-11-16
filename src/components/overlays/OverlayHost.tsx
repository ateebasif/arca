import { Suspense } from 'react';
import {
  AskPanel,
  TagManager,
  FolderIconPicker,
  EditDialog,
  SettingsDialog,
  ShortcutsDialog,
  TidyPanel,
} from './lazyOverlays';
import { deleteNode } from '@/src/features/editing/actions';
import { useOverlays } from '@/src/store/overlays';
import { folderCounts } from '@/src/store/selectors';
import { useBookmarks } from '@/src/store/useBookmarks';
import { Button, Dialog } from './Dialog';
import { ItemMenu } from './ItemMenu';

/** Renders whichever dialog, menu and toasts are open. Mount once per page. */
export function OverlayHost() {
  const editor = useOverlays((s) => s.editor);
  const menu = useOverlays((s) => s.menu);
  const confirmDeleteId = useOverlays((s) => s.confirmDeleteId);
  const settingsOpen = useOverlays((s) => s.settingsOpen);
  const shortcutsOpen = useOverlays((s) => s.shortcutsOpen);
  const tidyOpen = useOverlays((s) => s.tidyOpen);
  const ask = useOverlays((s) => s.ask);
  const tagManagerOpen = useOverlays((s) => s.tagManagerOpen);
  const iconFor = useOverlays((s) => s.iconFor);
  return (
    <>
      <Suspense fallback={null}>
        {editor && <EditDialog key={JSON.stringify(editor)} editor={editor} />}
        {settingsOpen && <SettingsDialog />}
        {shortcutsOpen && <ShortcutsDialog />}
      </Suspense>
      {menu && <ItemMenu key={menu.id} menu={menu} />}
      {confirmDeleteId && <ConfirmDelete id={confirmDeleteId} />}
      {tidyOpen && (
        <Suspense fallback={null}>
          <TidyPanel />
        </Suspense>
      )}
      {tagManagerOpen && (
        <Suspense fallback={null}>
          <TagManager />
        </Suspense>
      )}
      {iconFor && (
        <Suspense fallback={null}>
          <FolderIconPicker id={iconFor} />
        </Suspense>
      )}
      {ask && (
        <Suspense fallback={null}>
          {/* Keyed so "Ask Arca about …" from search refills an open panel. */}
          <AskPanel key={ask.draft} />
        </Suspense>
      )}
      <Toaster />
    </>
  );
}

function ConfirmDelete({ id }: { id: string }) {
  const state = useBookmarks();
  const close = useOverlays((s) => s.closeDelete);
  const node = state.nodes.get(id);
  if (!node) return null;
  const count = folderCounts(state).get(id) ?? 0;
  const subfolders = (node.childIds ?? []).filter(
    (c) => state.nodes.get(c)?.childIds,
  ).length;
  const parts = [
    count > 0 && `${count} ${count === 1 ? 'bookmark' : 'bookmarks'}`,
    subfolders > 0 && `${subfolders} ${subfolders === 1 ? 'folder' : 'folders'}`,
  ].filter(Boolean);

  return (
    <Dialog
      role="alertdialog"
      title={`Delete “${node.title || 'Untitled'}”?`}
      onClose={close}
      footer={
        <>
          <Button onClick={close} autoFocus>
            Cancel
          </Button>
          <Button
            variant="danger"
            onClick={() => {
              close();
              void deleteNode(id);
            }}
          >
            Delete folder
          </Button>
        </>
      }
    >
      <p className="text-ink-muted text-[13px]">
        This also deletes everything inside it
        {parts.length ? ` (${parts.join(' and ')})` : ''}, from the browser too.
      </p>
    </Dialog>
  );
}

export function Toaster() {
  const toasts = useOverlays((s) => s.toasts);
  const dismiss = useOverlays((s) => s.dismissToast);
  return (
    <div
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 bottom-5 z-50 flex flex-col items-center gap-2"
    >
      {toasts.map((t) => (
        <div
          key={t.id}
          role={t.tone === 'error' ? 'alert' : 'status'}
          className={`animate-rise border-line bg-surface-strong pointer-events-auto flex items-center gap-3 rounded-xl border px-4 py-2.5 text-[13px] shadow-(--shadow-pop) backdrop-blur-xl ${
            t.tone === 'error' ? 'text-danger' : ''
          }`}
        >
          {t.message}
          {t.action && (
            <button
              type="button"
              onClick={() => {
                t.action?.run();
                dismiss(t.id);
              }}
              className="text-accent hover:bg-accent-soft rounded-md px-2 py-0.5 text-[13px] font-semibold"
            >
              {t.action.label}
            </button>
          )}
          <button
            type="button"
            onClick={() => dismiss(t.id)}
            className="text-ink-faint hover:text-ink text-xs"
            aria-label="Dismiss"
          >
            ✕
          </button>
        </div>
      ))}
    </div>
  );
}
