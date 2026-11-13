/**
 * Minimal promise wrapper over one IndexedDB object store, keyed by `key`.
 * IndexedDB is per-extension, so only Arca's own pages can read it.
 */

export interface KeyValueStore<T> {
  get(key: string): Promise<T | undefined>;
  put(key: string, value: T): Promise<void>;
  delete(key: string): Promise<void>;
  clear(): Promise<void>;
  /** All keys with the value's `fetchedAt`, for pruning. */
  entries(): Promise<Array<[string, T]>>;
}

const request = <R>(req: IDBRequest<R>) =>
  new Promise<R>((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });

export function idbStore<T>(dbName: string, storeName: string): KeyValueStore<T> {
  let dbPromise: Promise<IDBDatabase> | null = null;
  const db = () => {
    dbPromise ??= new Promise((resolve, reject) => {
      const open = indexedDB.open(dbName, 1);
      open.onupgradeneeded = () => open.result.createObjectStore(storeName);
      open.onsuccess = () => resolve(open.result);
      open.onerror = () => reject(open.error);
    });
    return dbPromise;
  };
  const tx = async (mode: IDBTransactionMode) =>
    (await db()).transaction(storeName, mode).objectStore(storeName);

  return {
    async get(key) {
      return (await request((await tx('readonly')).get(key))) as T | undefined;
    },
    async put(key, value) {
      await request((await tx('readwrite')).put(value, key));
    },
    async delete(key) {
      await request((await tx('readwrite')).delete(key));
    },
    async clear() {
      await request((await tx('readwrite')).clear());
    },
    async entries() {
      const store = await tx('readonly');
      const [keys, values] = await Promise.all([
        request(store.getAllKeys()),
        request(store.getAll()),
      ]);
      return keys.map((k, i) => [String(k), values[i] as T]);
    },
  };
}

/** In-memory store with the same interface (tests, or when IndexedDB fails). */
export function memoryStore<T>(): KeyValueStore<T> {
  const map = new Map<string, T>();
  return {
    get: async (k) => map.get(k),
    put: async (k, v) => void map.set(k, v),
    delete: async (k) => void map.delete(k),
    clear: async () => map.clear(),
    entries: async () => [...map.entries()],
  };
}
