import { useState } from 'react';
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
    </div>
  );
}
