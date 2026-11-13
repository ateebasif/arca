import { useMemo, useState, type FormEvent } from 'react';
import { errorMessage } from '@/src/features/editing/actions';
import { normalizeInputUrl } from '@/src/features/editing/url';
import * as bm from '@/src/lib/bookmarks';
import type { BookmarkSnapshot } from '@/src/store/bookmarkStore';
import { useOverlays, type EditorState } from '@/src/store/overlays';
import { isWithin } from '@/src/store/selectors';
import { useBookmarks } from '@/src/store/useBookmarks';
import { Button, Dialog, Field, inputClass } from './Dialog';

interface FolderOption {
  id: string;
  label: string;
}

/** Every folder as an indented option, excluding `excludeId` and its subtree. */
function folderOptions(state: BookmarkSnapshot, excludeId?: string): FolderOption[] {
  const out: FolderOption[] = [];
  const visit = (id: string, depth: number) => {
    const node = state.nodes.get(id);
    if (!node?.childIds) return;
    if (excludeId && isWithin(state, id, excludeId)) return;
    out.push({ id, label: `${' '.repeat(depth)}${node.title || 'Untitled'}` });
    node.childIds.forEach((c) => visit(c, depth + 1));
  };
  state.rootIds.forEach((id) => visit(id, 0));
  return out;
}

/** Create or edit a bookmark or folder: title, URL (bookmarks) and folder. */
export function EditDialog({ editor }: { editor: EditorState }) {
  const state = useBookmarks();
  const close = useOverlays((s) => s.closeEditor);
  const existing = editor.mode === 'edit' ? state.nodes.get(editor.id) : undefined;
  const kind =
    editor.mode === 'create' ? editor.kind : existing?.childIds ? 'folder' : 'bookmark';

  const [title, setTitle] = useState(
    existing?.title ?? (editor.mode === 'create' ? (editor.title ?? '') : ''),
  );
  const [url, setUrl] = useState(
    existing?.url ?? (editor.mode === 'create' ? (editor.url ?? '') : ''),
  );
  const [parentId, setParentId] = useState(
    existing?.parentId ?? (editor.mode === 'create' ? editor.parentId : '1'),
  );
  const [urlError, setUrlError] = useState<string>();
  const [formError, setFormError] = useState<string>();
  const [saving, setSaving] = useState(false);

  const options = useMemo(
    () => folderOptions(state, kind === 'folder' ? existing?.id : undefined),
    [state, kind, existing?.id],
  );

  if (editor.mode === 'edit' && !existing) return null;
  const locked = existing?.isRoot ?? false;
  const noun = kind === 'folder' ? 'folder' : 'bookmark';

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setFormError(undefined);
    let finalUrl: string | undefined;
    if (kind === 'bookmark') {
      finalUrl = normalizeInputUrl(url) ?? undefined;
      if (!finalUrl) {
        setUrlError('Enter a valid URL, like example.com');
        return;
      }
    }
    const finalTitle = title.trim() || (kind === 'folder' ? 'New folder' : '');
    setSaving(true);
    try {
      if (!existing) {
        await bm.create({ parentId, title: finalTitle, url: finalUrl });
      } else {
        await bm.update(existing.id, { title: finalTitle, url: finalUrl });
        if (existing.parentId !== parentId) await bm.move(existing.id, { parentId });
      }
      close();
    } catch (error) {
      setFormError(errorMessage(error));
      setSaving(false);
    }
  };

  return (
    <Dialog
      title={existing ? `Edit ${noun}` : `New ${noun}`}
      onClose={close}
      footer={
        <>
          <Button onClick={close}>Cancel</Button>
          <Button
            variant="primary"
            type="submit"
            form="arca-edit-form"
            disabled={saving || locked}
          >
            {existing ? 'Save' : 'Add'}
          </Button>
        </>
      }
    >
      <form id="arca-edit-form" onSubmit={onSubmit} noValidate>
        {locked && (
          <p className="bg-hover text-ink-muted mb-3 rounded-lg px-3 py-2 text-xs">
            This is a browser folder. It can't be renamed, moved or deleted.
          </p>
        )}
        <Field label="Name">
          <input
            className={inputClass}
            value={title}
            disabled={locked}
            placeholder={kind === 'folder' ? 'New folder' : 'Page title'}
            onChange={(e) => setTitle(e.target.value)}
          />
        </Field>
        {kind === 'bookmark' && (
          <Field label="URL" error={urlError}>
            <input
              className={inputClass}
              value={url}
              inputMode="url"
              spellCheck={false}
              placeholder="https://"
              aria-invalid={urlError ? true : undefined}
              onChange={(e) => {
                setUrl(e.target.value);
                setUrlError(undefined);
              }}
            />
          </Field>
        )}
        {!locked && (
          <Field label="Folder">
            <select
              className={inputClass}
              value={parentId ?? ''}
              onChange={(e) => setParentId(e.target.value)}
            >
              {options.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.label}
                </option>
              ))}
            </select>
          </Field>
        )}
        {formError && (
          <p role="alert" className="text-danger text-xs">
            {formError}
          </p>
        )}
      </form>
    </Dialog>
  );
}
