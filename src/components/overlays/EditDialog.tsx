import { useMemo, useState, type FormEvent } from 'react';
import { errorMessage } from '@/src/features/editing/actions';
import { normalizeInputUrl } from '@/src/features/editing/url';
import * as undo from '@/src/features/undo/undo';
import * as bm from '@/src/lib/bookmarks';
import { setTags } from '@/src/features/tags/actions';
import { useOverlays, type EditorState } from '@/src/store/overlays';
import { getMetaStore, useMeta } from '@/src/store/useMeta';
import { TagInput } from '../tags/TagInput';
import { folderOptions } from '@/src/store/selectors';
import { useBookmarks } from '@/src/store/useBookmarks';
import { Button, Dialog, Field, inputClass } from './Dialog';

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
  const meta = useMeta();
  const [tags, setTagList] = useState<string[]>(() =>
    existing ? (meta.byId.get(existing.id)?.tags ?? []) : [],
  );
  const knownTags = useMemo(
    () =>
      getMetaStore()
        .allTags()
        .map((t) => t.tag),
    // Recompute when tags change anywhere.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [meta.version],
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
        const node = await bm.create({ parentId, title: finalTitle, url: finalUrl });
        await setTags(node.id, finalUrl ?? '', tags);
        undo.record(undo.created(node));
      } else {
        const steps: undo.UndoAction[] = [];
        const before = { title: existing.title, url: existing.url };
        if (
          before.title !== finalTitle ||
          (finalUrl !== undefined && before.url !== finalUrl)
        ) {
          await bm.update(existing.id, { title: finalTitle, url: finalUrl });
          steps.push(undo.changed(existing.id, before, ''));
        }
        if (existing.parentId !== parentId && existing.parentId) {
          const from = await bm.getNode(existing.id);
          await bm.move(existing.id, { parentId });
          steps.push(
            undo.moved(
              existing.id,
              { parentId: existing.parentId, index: from.index ?? 0 },
              '',
            ),
          );
        }
        const tagStep = await setTags(existing.id, finalUrl ?? existing.url ?? '', tags);
        if (tagStep) steps.push(tagStep);
        if (steps.length) undo.record(undo.combine(`Edited “${finalTitle}”`, steps));
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
      <form
        id="arca-edit-form"
        onSubmit={onSubmit}
        noValidate
        onKeyDown={(e) => {
          // Enter in any field saves (the tag field keeps Enter while typing a tag).
          if (
            e.key === 'Enter' &&
            !e.defaultPrevented &&
            e.target instanceof HTMLInputElement
          ) {
            e.preventDefault();
            e.currentTarget.requestSubmit();
          }
        }}
      >
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
        {!locked && (
          <Field label="Tags">
            <TagInput value={tags} onChange={setTagList} suggestions={knownTags} />
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
