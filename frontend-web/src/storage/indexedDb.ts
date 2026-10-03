const DB_NAME = "field-shift-db";
const DB_VERSION = 1;
const STORE_NAME = "cache";

interface CacheRecord {
  key: string;
  value: unknown;
  updatedAt: number;
}

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;

      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, {
          keyPath: "key",
        });
      }
    };

    request.onsuccess = () => resolve(request.result);

    request.onerror = () => {
      reject(request.error);
    };
  });
}

export async function setCachedData(
  key: string,
  value: unknown,
): Promise<void> {
  const db = await openDatabase();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(
      STORE_NAME,
      "readwrite",
    );

    const store = transaction.objectStore(STORE_NAME);

    const record: CacheRecord = {
      key,
      value,
      updatedAt: Date.now(),
    };

    store.put(record);

    transaction.oncomplete = () => {
      db.close();
      resolve();
    };

    transaction.onerror = () => {
      db.close();
      reject(transaction.error);
    };
  });
}

export async function getCachedData<T>(
  key: string,
): Promise<T | null> {
  const db = await openDatabase();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(
      STORE_NAME,
      "readonly",
    );

    const store = transaction.objectStore(STORE_NAME);
    const request = store.get(key);

    request.onsuccess = () => {
      db.close();

      const record = request.result as
        | CacheRecord
        | undefined;

      resolve(record ? (record.value as T) : null);
    };

    request.onerror = () => {
      db.close();
      reject(request.error);
    };
  });
}

export async function clearCachedData(): Promise<void> {
  const db = await openDatabase();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(
      STORE_NAME,
      "readwrite",
    );

    transaction.objectStore(STORE_NAME).clear();

    transaction.oncomplete = () => {
      db.close();
      resolve();
    };

    transaction.onerror = () => {
      db.close();
      reject(transaction.error);
    };
  });
}