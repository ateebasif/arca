import { pruneStaleReadings, docText } from '@/src/features/ai/ask';
import {
  cacheKey,
  setEmbeddingStoreForTests,
  writeCached,
} from '@/src/features/ai/embedCache';
import { embeddingText, taskPrefix } from '@/src/features/ai/organize';
import { memoryStore } from '@/src/lib/idb';

const MODEL = 'nomic-embed-text:latest';
const item = (title: string) => ({
  id: title,
  title,
  url: `https://${title}.dev/`,
  folder: '',
});

describe('pruning stale AI readings', () => {
  it('drops readings no bookmark produces, keeps current ones and other models', async () => {
    const store = memoryStore<unknown>();
    setEmbeddingStoreForTests(store);
    const kept = item('kept');
    const gone = item('gone');
    await writeCached(MODEL, docText(MODEL, kept), [1, 0]);
    await writeCached(MODEL, taskPrefix(MODEL) + embeddingText(kept), [1, 0]);
    await writeCached(MODEL, docText(MODEL, gone), [0, 1]);
    await writeCached('other-model', docText('other-model', gone), [0, 1]);

    expect(await pruneStaleReadings([kept], MODEL)).toBe(1);
    const keys = await store.keys();
    expect(keys).toContain(cacheKey(MODEL, docText(MODEL, kept)));
    expect(keys).toContain(cacheKey(MODEL, taskPrefix(MODEL) + embeddingText(kept)));
    expect(keys).not.toContain(cacheKey(MODEL, docText(MODEL, gone)));
    expect(keys).toContain(cacheKey('other-model', docText('other-model', gone)));
    setEmbeddingStoreForTests(null);
  });
});
