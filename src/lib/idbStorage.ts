const DB_NAME = 'callanalyzer-eth-db';
const DB_VERSION = 1;
const STORE_NAME = 'scoped_data';
const UID_INDEX = 'by_uid';

type ScopedIdbRecord = {
  id: string;
  uid: string;
  key: string;
  value: unknown;
  updatedAt: number;
};

let dbPromise: Promise<IDBDatabase | null> | null = null;
const memoryFallback = new Map<string, ScopedIdbRecord>();

function makeRecordId(uid: string, key: string): string {
  return `${uid}::${key}`;
}

export function isIndexedDbSupported(): boolean {
  try {
    return typeof indexedDB !== 'undefined' && indexedDB !== null;
  } catch {
    return false;
  }
}

function openDatabase(): Promise<IDBDatabase | null> {
  if (!isIndexedDbSupported()) {
    return Promise.resolve(null);
  }
  if (dbPromise) {
    return dbPromise;
  }

  dbPromise = new Promise<IDBDatabase | null>((resolve) => {
    try {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = () => {
        const db = request.result;
        const store = db.objectStoreNames.contains(STORE_NAME)
          ? request.transaction?.objectStore(STORE_NAME)
          : db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        if (store && !store.indexNames.contains(UID_INDEX)) {
          store.createIndex(UID_INDEX, 'uid', { unique: false });
        }
      };

      request.onsuccess = () => {
        const db = request.result;
        db.onversionchange = () => {
          db.close();
          dbPromise = null;
        };
        db.onclose = () => {
          dbPromise = null;
        };
        resolve(db);
      };

      request.onerror = () => {
        dbPromise = null;
        resolve(null);
      };

      request.onblocked = () => {
        dbPromise = null;
        resolve(null);
      };
    } catch {
      dbPromise = null;
      resolve(null);
    }
  });

  return dbPromise;
}

function readLegacyLocalJson<T>(fullKey: string): { found: boolean; value?: T } {
  try {
    if (typeof localStorage === 'undefined') return { found: false };
    const raw = localStorage.getItem(fullKey);
    if (raw === null) return { found: false };
    return { found: true, value: JSON.parse(raw) as T };
  } catch {
    return { found: false };
  }
}

function removeLegacyLocalKey(fullKey: string): void {
  try {
    if (typeof localStorage === 'undefined') return;
    localStorage.removeItem(fullKey);
  } catch {
    // ignore storage errors
  }
}

export async function idbGetScoped<T>(uid: string, key: string): Promise<T | undefined> {
  const id = makeRecordId(uid, key);
  const db = await openDatabase();
  if (!db) {
    return memoryFallback.get(id)?.value as T | undefined;
  }

  return new Promise<T | undefined>((resolve) => {
    try {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.get(id);
      req.onsuccess = () => {
        const rec = req.result as ScopedIdbRecord | undefined;
        if (rec) {
          resolve(rec.value as T);
        } else {
          resolve(memoryFallback.get(id)?.value as T | undefined);
        }
      };
      req.onerror = () => {
        resolve(memoryFallback.get(id)?.value as T | undefined);
      };
    } catch {
      dbPromise = null;
      resolve(memoryFallback.get(id)?.value as T | undefined);
    }
  });
}

export async function idbSetScoped<T>(uid: string, key: string, value: T): Promise<boolean> {
  const id = makeRecordId(uid, key);
  const record: ScopedIdbRecord = {
    id,
    uid,
    key,
    value,
    updatedAt: Date.now(),
  };
  memoryFallback.set(id, record);

  const db = await openDatabase();
  if (!db) {
    return false;
  }

  return new Promise<boolean>((resolve) => {
    try {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      store.put(record);
      tx.oncomplete = () => resolve(true);
      tx.onerror = () => resolve(false);
      tx.onabort = () => resolve(false);
    } catch {
      dbPromise = null;
      resolve(false);
    }
  });
}

export async function idbSetScopedBatch(
  uid: string,
  entries: Array<{ key: string; value: unknown }>,
): Promise<boolean> {
  if (entries.length === 0) return true;
  const now = Date.now();
  const records: ScopedIdbRecord[] = entries.map((entry) => {
    const rec: ScopedIdbRecord = {
      id: makeRecordId(uid, entry.key),
      uid,
      key: entry.key,
      value: entry.value,
      updatedAt: now,
    };
    memoryFallback.set(rec.id, rec);
    return rec;
  });

  const db = await openDatabase();
  if (!db) {
    return false;
  }

  return new Promise<boolean>((resolve) => {
    try {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      records.forEach((rec) => store.put(rec));
      tx.oncomplete = () => resolve(true);
      tx.onerror = () => resolve(false);
      tx.onabort = () => resolve(false);
    } catch {
      dbPromise = null;
      resolve(false);
    }
  });
}

export async function idbDeleteScoped(uid: string, key: string): Promise<void> {
  const id = makeRecordId(uid, key);
  memoryFallback.delete(id);

  const db = await openDatabase();
  if (!db) return;

  return new Promise<void>((resolve) => {
    try {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      store.delete(id);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
      tx.onabort = () => resolve();
    } catch {
      dbPromise = null;
      resolve();
    }
  });
}

export async function idbGetAllScopedForUser(uid: string): Promise<Record<string, unknown>> {
  const result: Record<string, unknown> = {};
  memoryFallback.forEach((rec) => {
    if (rec.uid === uid) {
      result[rec.key] = rec.value;
    }
  });

  const db = await openDatabase();
  if (!db) {
    return result;
  }

  return new Promise<Record<string, unknown>>((resolve) => {
    try {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const index = store.index(UID_INDEX);
      const req = index.getAll(IDBKeyRange.only(uid));
      req.onsuccess = () => {
        const rows = Array.isArray(req.result) ? (req.result as ScopedIdbRecord[]) : [];
        rows.forEach((row) => {
          if (row && typeof row.key === 'string') {
            result[row.key] = row.value;
          }
        });
        resolve(result);
      };
      req.onerror = () => resolve(result);
    } catch {
      dbPromise = null;
      resolve(result);
    }
  });
}

export async function idbClearUser(uid: string): Promise<void> {
  Array.from(memoryFallback.entries()).forEach(([id, rec]) => {
    if (rec.uid === uid) {
      memoryFallback.delete(id);
    }
  });

  const db = await openDatabase();
  if (!db) return;

  return new Promise<void>((resolve) => {
    try {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const index = store.index(UID_INDEX);
      const cursorReq = index.openKeyCursor(IDBKeyRange.only(uid));

      cursorReq.onsuccess = () => {
        const cursor = cursorReq.result;
        if (cursor) {
          store.delete(cursor.primaryKey);
          cursor.continue();
        }
      };

      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
      tx.onabort = () => resolve();
    } catch {
      dbPromise = null;
      resolve();
    }
  });
}

export async function getScopedWithLegacyMigration<T>(
  uid: string,
  key: string,
  fallback: T,
): Promise<T> {
  const existing = await idbGetScoped<T>(uid, key);
  const legacyFullKey = `callanalyzer.u.${uid}.${key}`;
  if (existing !== undefined) {
    const db = await openDatabase();
    if (db) {
      removeLegacyLocalKey(legacyFullKey);
    }
    return existing;
  }

  const legacy = readLegacyLocalJson<T>(legacyFullKey);
  if (legacy.found && legacy.value !== undefined) {
    const persisted = await idbSetScoped(uid, key, legacy.value);
    if (persisted) {
      removeLegacyLocalKey(legacyFullKey);
    }
    return legacy.value;
  }

  return fallback;
}

export async function migrateUserLocalStorageToIdb(
  uid: string,
  keepLocalKeys: ReadonlySet<string> = new Set(['pinLockout', 'welcomeDismissed']),
): Promise<Record<string, unknown>> {
  const existing = await idbGetAllScopedForUser(uid);
  const prefix = `callanalyzer.u.${uid}.`;
  const matchingKeys: Array<{ fullKey: string; suffix: string }> = [];

  try {
    if (typeof localStorage !== 'undefined') {
      for (let i = 0; i < localStorage.length; i += 1) {
        const fullKey = localStorage.key(i);
        if (!fullKey || !fullKey.startsWith(prefix)) continue;
        const suffix = fullKey.slice(prefix.length);
        if (!suffix || keepLocalKeys.has(suffix)) continue;
        matchingKeys.push({ fullKey, suffix });
      }
    }
  } catch {
    return existing;
  }

  if (matchingKeys.length === 0) {
    return existing;
  }

  const toWrite: Array<{ key: string; value: unknown }> = [];
  const keysToRemove: string[] = [];

  matchingKeys.forEach(({ fullKey, suffix }) => {
    keysToRemove.push(fullKey);
    if (Object.prototype.hasOwnProperty.call(existing, suffix)) {
      return;
    }
    const parsed = readLegacyLocalJson<unknown>(fullKey);
    if (parsed.found) {
      existing[suffix] = parsed.value;
      toWrite.push({ key: suffix, value: parsed.value });
    }
  });

  if (toWrite.length > 0) {
    const persisted = await idbSetScopedBatch(uid, toWrite);
    if (persisted) {
      keysToRemove.forEach(removeLegacyLocalKey);
    }
  } else if (keysToRemove.length > 0) {
    const db = await openDatabase();
    if (db) {
      keysToRemove.forEach(removeLegacyLocalKey);
    }
  }

  return existing;
}

export function clearLegacyUserLocalStorage(uid: string): void {
  const prefix = `callanalyzer.u.${uid}.`;
  try {
    if (typeof localStorage === 'undefined') return;
    const keys: string[] = [];
    for (let i = 0; i < localStorage.length; i += 1) {
      const k = localStorage.key(i);
      if (k && k.startsWith(prefix)) {
        keys.push(k);
      }
    }
    keys.forEach((k) => {
      try {
        localStorage.removeItem(k);
      } catch {
        // ignore
      }
    });
  } catch {
    // ignore
  }
}
