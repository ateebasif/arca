import { useState } from 'react';
import { isEmoji, useFolderIcons } from '@/src/store/folderIcons';
import { useOverlays } from '@/src/store/overlays';
import { useBookmarks } from '@/src/store/useBookmarks';
import { Button, Dialog, inputClass } from './Dialog';

const CHOICES = [
  '📁',
  '⭐',
  '❤️',
  '🔥',
  '💼',
  '🏠',
  '📚',
  '📰',
  '🎓',
  '💡',
  '🛠️',
  '💻',
  '🎨',
  '🎵',
  '🎬',
  '🎮',
  '📷',
  '✈️',
  '🍳',
  '🛒',
  '💰',
  '📈',
  '🏋️',
  '⚽',
  '🌱',
  '🐾',
  '🧪',
  '🔒',
  '📌',
  '🗂️',
];

/** Pick an emoji for a folder (shown in the sidebar and on its card). */
export default function FolderIconPicker({ id }: { id: string }) {
  const state = useBookmarks();
  const close = () => useOverlays.getState().setIconFor(null);
  const current = useFolderIcons((s) => s.icons.get(id));
  const [custom, setCustom] = useState('');
  const folder = state.nodes.get(id);
  if (!folder?.childIds) return null;
  const choose = (emoji: string | null) => {
    void useFolderIcons.getState().setIcon(id, emoji);
    close();
  };
  const customOk = isEmoji(custom.trim());
  return (
    <Dialog
      title={`Icon for “${folder.title || 'Untitled'}”`}
      onClose={close}
      footer={
        <>
          {current && <Button onClick={() => choose(null)}>Remove icon</Button>}
          <Button onClick={close}>Cancel</Button>
        </>
      }
    >
      <div role="group" aria-label="Icons" className="grid grid-cols-10 gap-1">
        {CHOICES.map((emoji) => (
          <button
            key={emoji}
            type="button"
            aria-label={`Use ${emoji}`}
            aria-pressed={current === emoji}
            onClick={() => choose(emoji)}
            className={`hover:bg-hover grid aspect-square place-items-center rounded-lg text-xl ${
              current === emoji ? 'bg-accent-soft ring-accent ring-1' : ''
            }`}
          >
            {emoji}
          </button>
        ))}
      </div>
      <form
        className="mt-3 flex items-center gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (customOk) choose(custom.trim());
        }}
      >
        <input
          aria-label="Any emoji"
          className={`${inputClass} h-9 w-24 text-center text-lg`}
          placeholder="🙂"
          value={custom}
          maxLength={16}
          onChange={(e) => setCustom(e.target.value)}
        />
        <Button type="submit" disabled={!customOk}>
          Use this emoji
        </Button>
        <span className="text-ink-faint text-xs">Or paste any emoji (⌃⌘Space).</span>
      </form>
    </Dialog>
  );
}
