/**
 * Enough of IndexedDB for the offline queue: open, one store, getAll, put, delete.
 * Events fire on a microtask so callers can assign handlers after open().
 */

function later(fn) {
  queueMicrotask(fn);
}

function request() {
  return { result: undefined, error: null, onsuccess: null, onerror: null, onupgradeneeded: null };
}

export function installFakeIndexedDb() {
  const databases = new Map();

  function createDatabase() {
    const stores = new Map();
    const db = {
      objectStoreNames: {
        contains(name) {
          return stores.has(name);
        },
      },
      createObjectStore(name, { keyPath }) {
        const rows = new Map();
        stores.set(name, { keyPath, rows });
        return objectStore(name);
      },
      transaction(name) {
        return { objectStore: () => objectStore(name) };
      },
    };
    function objectStore(name) {
      const store = stores.get(name);
      return {
        getAll() {
          const req = request();
          later(() => {
            req.result = [...store.rows.values()];
            req.onsuccess?.();
          });
          return req;
        },
        put(value) {
          const req = request();
          later(() => {
            store.rows.set(value[store.keyPath], value);
            req.result = value[store.keyPath];
            req.onsuccess?.();
          });
          return req;
        },
        delete(key) {
          const req = request();
          later(() => {
            store.rows.delete(key);
            req.result = undefined;
            req.onsuccess?.();
          });
          return req;
        },
      };
    }
    return db;
  }

  globalThis.indexedDB = {
    open(name) {
      const req = request();
      later(() => {
        let db = databases.get(name);
        const fresh = !db;
        if (!db) {
          db = createDatabase();
          databases.set(name, db);
        }
        req.result = db;
        if (fresh) req.onupgradeneeded?.();
        req.onsuccess?.();
      });
      return req;
    },
  };
  return globalThis.indexedDB;
}
