import { useOverlays } from '@/src/store/overlays';
import { Button, Dialog } from './Dialog';

const SHORTCUTS: Array<[string, string]> = [
  ['⌘K  or  /', 'Search bookmarks'],
  ['↑ ↓  Enter', 'Move through results and open'],
  ['⌘ Enter', 'Open in a new background tab'],
  ['⌥ Enter', 'Show the result in its folder'],
  ['[  /  ]', 'Back / forward through folders'],
  ['⌥ ↑', 'Up to the parent folder'],
  ['Mouse back / forward', 'Back / forward through folders'],
  ['⌘ \\', 'Show or hide the sidebar'],
  ['F2', 'Rename the focused item'],
  ['Delete  or  ⌘⌫', 'Delete the focused item'],
  ['⌘Z', 'Undo'],
  ['Shift F10', 'Item menu'],
  ['Esc', 'Clear search / close'],
  ['?', 'This list'],
];

/** Keyboard shortcuts sheet (press ?). */
export function ShortcutsDialog() {
  const close = () => useOverlays.getState().setShortcutsOpen(false);
  return (
    <Dialog
      title="Keyboard shortcuts"
      onClose={close}
      footer={<Button onClick={close}>Done</Button>}
    >
      <p className="text-ink-muted mb-3 text-xs">
        Arca avoids shortcuts your browser already uses (like ⌘N, ⌘T or ⌘[).
      </p>
      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-[13px]">
        {SHORTCUTS.map(([keys, action]) => (
          <div key={keys} className="contents">
            <dt>
              <kbd className="border-line bg-hover rounded-md border px-1.5 py-0.5 font-sans text-[12px] whitespace-nowrap">
                {keys}
              </kbd>
            </dt>
            <dd className="text-ink-muted">{action}</dd>
          </div>
        ))}
      </dl>
    </Dialog>
  );
}
