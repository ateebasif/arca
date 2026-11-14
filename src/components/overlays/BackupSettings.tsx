import { useRef, useState } from 'react';
import type { ParsedImport } from '@/src/features/importexport/import';
import { errorMessage } from '@/src/features/editing/actions';
import { getBookmarkStore, useBookmarks } from '@/src/store/useBookmarks';
import { useOverlays } from '@/src/store/overlays';
import { FolderPicker } from '../FolderPicker';
import {
  exportFileName,
  toArcaBackup,
  toNetscapeHtml,
} from '@/src/features/importexport/export';
import { getTree } from '@/src/lib/bookmarks';
import { downloadText } from '@/src/lib/download';
import { getMetaStore } from '@/src/store/useMeta';
import { Button } from './Dialog';

/** Settings → Backup: save the whole library as a file. */
export function BackupSettings() {
  const [note, setNote] = useState('');
  const save = async (kind: 'html' | 'json') => {
    const meta = getMetaStore();
    await meta.start();
    const tagsOf = (id: string) => meta.tagsOf(id);
    const tree = await getTree();
    if (kind === 'html') {
      downloadText(exportFileName('html'), toNetscapeHtml(tree, tagsOf), 'text/html');
    } else {
      downloadText(
        exportFileName('json'),
        JSON.stringify(toArcaBackup(tree, tagsOf), null, 2),
        'application/json',
      );
    }
    setNote(`Saved ${exportFileName(kind)} to your downloads.`);
  };
  return (
    <div className="border-line mt-4 border-t pt-4">
      <p className="text-[13px] font-medium">Backup</p>
      <p className="text-ink-muted mt-0.5 mb-2 text-xs leading-relaxed">
        Save all your bookmarks as a file. The HTML file can be imported by any browser
        (tags included); the JSON backup keeps Arca's tags exactly.
      </p>
      <div className="flex flex-wrap gap-2">
        <Button onClick={() => void save('html')}>Export bookmarks (HTML)</Button>
        <Button onClick={() => void save('json')}>Export backup with tags (JSON)</Button>
      </div>
      {note && (
        <p role="status" className="text-ink-muted mt-2 text-xs">
          {note}
        </p>
      )}
      <ImportSection />
    </div>
  );
}

/**
 * Import a browser's bookmarks file (HTML) or an Arca backup (JSON) into a
 * new folder: preview first, duplicates skipped by default, one undo.
 */
function ImportSection() {
  const state = useBookmarks();
  const input = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<{
    name: string;
    parsed: ParsedImport;
    dups: number;
  }>();
  const [parent, setParent] = useState('2');
  const [skipDups, setSkipDups] = useState(true);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const existingUrls = () =>
    [...state.nodes.values()].flatMap((n) => (n.url ? [n.url] : []));

  const choose = async (f: File | undefined) => {
    setError('');
    setMessage('');
    setFile(undefined);
    if (!f) return;
    const mod = await import('@/src/features/importexport/import');
    if (f.size > mod.MAX_FILE_BYTES) {
      setError('That file is over 20 MB, too big for a bookmarks export.');
      return;
    }
    try {
      const parsed = mod.parseImportFile(f.name, await f.text());
      if (parsed.links === 0 && parsed.folders === 0) {
        setError('No bookmarks found in that file.');
        return;
      }
      setFile({
        name: f.name,
        parsed,
        dups: mod.countDuplicates(parsed, existingUrls()),
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  const run = async () => {
    if (!file) return;
    const mod = await import('@/src/features/importexport/import');
    setProgress({ done: 0, total: file.parsed.links + file.parsed.folders });
    try {
      const result = await getBookmarkStore().bulk(() =>
        mod.importInto(parent, file.parsed, {
          skipDuplicates: skipDups,
          existingUrls: existingUrls(),
          onProgress: (done, total) => setProgress({ done, total }),
        }),
      );
      setMessage(
        `Imported ${result.links.toLocaleString()} bookmarks` +
          (result.skipped
            ? ` (${result.skipped.toLocaleString()} duplicates skipped)`
            : '') +
          '. Undo is in the toast or ⌘Z.',
      );
      useOverlays.getState().toast(`Imported ${result.links.toLocaleString()} bookmarks`);
      setFile(undefined);
      if (input.current) input.current.value = '';
    } catch (e) {
      setError(`Import stopped: ${errorMessage(e)}. Undo removes what was added.`);
    } finally {
      setProgress(null);
    }
  };

  const p = file?.parsed;
  return (
    <div className="mt-4">
      <p className="text-[13px] font-medium">Import</p>
      <p className="text-ink-muted mt-0.5 mb-2 text-xs leading-relaxed">
        Bring in bookmarks exported from any browser (HTML) or an Arca backup (JSON). They
        go into a new folder, so nothing you have is changed.
      </p>
      <input
        ref={input}
        type="file"
        accept=".html,.htm,.json,text/html,application/json"
        aria-label="Choose a bookmarks file"
        onChange={(e) => void choose(e.target.files?.[0])}
        className="text-ink-muted file:border-line file:bg-surface file:text-ink hover:file:bg-hover text-xs file:mr-3 file:h-8 file:rounded-lg file:border file:px-3 file:text-xs"
      />
      {p && file && !progress && (
        <div
          className="border-line bg-surface mt-3 flex flex-col gap-2 rounded-xl border p-3 text-xs"
          data-import-preview
        >
          <p>
            <strong>{file.name}</strong>: {p.links.toLocaleString()} links in{' '}
            {p.folders.toLocaleString()} folders
            {file.dups > 0 && `, ${file.dups.toLocaleString()} you already have`}.
          </p>
          {(p.blocked > 0 || p.truncated > 0) && (
            <p className="text-ink-faint">
              {p.blocked > 0 &&
                `${p.blocked} link${p.blocked === 1 ? '' : 's'} that could run code (javascript:, data:) or had no valid address will be left out. `}
              {p.truncated > 0 && `Only the first 25,000 items are imported.`}
            </p>
          )}
          {file.dups > 0 && (
            <label className="text-ink-muted flex items-center gap-2">
              <input
                type="checkbox"
                className="accent-accent"
                checked={skipDups}
                onChange={(e) => setSkipDups(e.target.checked)}
              />
              Skip the {file.dups.toLocaleString()} duplicates
            </label>
          )}
          <div className="flex items-center gap-2">
            <FolderPicker
              label="Import into"
              value={parent}
              onChange={setParent}
              className="flex-1"
            />
            <Button variant="primary" onClick={() => void run()}>
              Import
            </Button>
          </div>
        </div>
      )}
      {progress && (
        <p role="status" className="text-ink-muted mt-2 text-xs tabular-nums">
          Importing… {progress.done.toLocaleString()}/{progress.total.toLocaleString()}
        </p>
      )}
      {message && (
        <p role="status" className="text-ink-muted mt-2 text-xs">
          {message}
        </p>
      )}
      {error && <p className="text-danger mt-2 text-xs">{error}</p>}
    </div>
  );
}
