/**
 * Stockage du téléphone pour l'appli terrain (IndexedDB, sans dépendance) :
 * - « outbox » : saisies faites sans réseau (photos, pointages, dépenses), envoyées dès que possible ;
 * - « cache » : dernières données lues (chantiers, tâcherons…) pour travailler hors ligne.
 */
const DB_NAME = "borom-terrain";
const VERSION = 1;

let opening: Promise<IDBDatabase> | null = null;

function open(): Promise<IDBDatabase> {
  opening ??= new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains("outbox")) db.createObjectStore("outbox", { keyPath: "id" });
      if (!db.objectStoreNames.contains("cache")) db.createObjectStore("cache", { keyPath: "key" });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => { opening = null; reject(request.error); };
  });
  return opening;
}

function run<T>(store: string, mode: IDBTransactionMode, action: (s: IDBObjectStore) => IDBRequest): Promise<T> {
  return open().then((db) => new Promise<T>((resolve, reject) => {
    const tx = db.transaction(store, mode);
    const request = action(tx.objectStore(store));
    tx.oncomplete = () => resolve(request.result as T);
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  }));
}

export const idb = {
  all: <T>(store: string) => run<T[]>(store, "readonly", (s) => s.getAll()),
  get: <T>(store: string, key: string) => run<T | undefined>(store, "readonly", (s) => s.get(key)),
  put: <T>(store: string, value: T) => run<IDBValidKey>(store, "readwrite", (s) => s.put(value)),
  delete: (store: string, key: string) => run<undefined>(store, "readwrite", (s) => s.delete(key)),
  clear: (store: string) => run<undefined>(store, "readwrite", (s) => s.clear()),
};

/** Dernière valeur lue pour une clé, avec sa date. */
export async function cacheGet<T>(key: string): Promise<{ value: T; savedAt: number } | null> {
  try {
    const row = await idb.get<{ key: string; value: T; savedAt: number }>("cache", key);
    return row ? { value: row.value, savedAt: row.savedAt } : null;
  } catch {
    return null;
  }
}

export async function cacheSet<T>(key: string, value: T): Promise<void> {
  try {
    await idb.put("cache", { key, value, savedAt: Date.now() });
  } catch {
    // Stockage indisponible (navigation privée) : on travaille sans cache.
  }
}
