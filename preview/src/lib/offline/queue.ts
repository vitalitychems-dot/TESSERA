/** Offline request queue + API cache. Store names: apiCache, offlineQueue only. */
export type Queued = { key: string; method: string; url: string; body?: string };
export interface Store {
  all(): Promise<Queued[]>;
  put(q: Queued): Promise<void>;
  remove(key: string): Promise<void>;
}
export const STORE_NAMES = ["apiCache", "offlineQueue"] as const;

export function memoryStore(): Store {
  const m = new Map<string, Queued>();
  return {
    async all() { return [...m.values()]; },
    async put(q) { m.set(q.key, q); },
    async remove(k) { m.delete(k); },
  };
}

export async function enqueue(store: Store, q: Queued) {
  await store.put(q); // same key overwrites: no duplicates
}

export async function replay(store: Store, send: (q: Queued) => Promise<boolean>) {
  let sent = 0;
  for (const q of await store.all()) {
    if (await send(q)) { await store.remove(q.key); sent++; }
  }
  return { sent, left: (await store.all()).length };
}

export function indexedDbStore(dbName = "TesseraOffline"): Store {
  const open = () => new Promise<IDBDatabase>((res, rej) => {
    const r = indexedDB.open(dbName, 1);
    r.onupgradeneeded = () => { for (const s of STORE_NAMES) if (!r.result.objectStoreNames.contains(s)) r.result.createObjectStore(s, { keyPath: s === "apiCache" ? "url" : "key" }); };
    r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error);
  });
  const tx = async <T>(mode: IDBTransactionMode, f: (s: IDBObjectStore) => IDBRequest<T>) => {
    const db = await open();
    return new Promise<T>((res, rej) => { const q = f(db.transaction("offlineQueue", mode).objectStore("offlineQueue")); q.onsuccess = () => res(q.result); q.onerror = () => rej(q.error); });
  };
  return {
    all: () => tx("readonly", (s) => s.getAll() as IDBRequest<Queued[]>),
    put: async (q) => { await tx("readwrite", (s) => s.put(q)); },
    remove: async (k) => { await tx("readwrite", (s) => s.delete(k)); },
  };
}
