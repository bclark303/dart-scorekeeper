const LOCAL_PERSISTENCE_DATABASE = "dart-scorekeeper-local";
const LOCAL_PERSISTENCE_VERSION = 2;

export const MATCH_ARCHIVE_STORE = "matchArchives";
export const BOARD_OFFLINE_MATCH_STORE = "boardOfflineMatches";

function assertIndexedDbAvailable() {
  if (typeof indexedDB === "undefined") {
    throw new Error("IndexedDB is not available in this environment.");
  }
}

export function openLocalPersistenceDatabase(): Promise<IDBDatabase> {
  assertIndexedDbAvailable();

  return new Promise((resolve, reject) => {
    const request = indexedDB.open(
      LOCAL_PERSISTENCE_DATABASE,
      LOCAL_PERSISTENCE_VERSION,
    );

    request.onupgradeneeded = () => {
      const database = request.result;

      if (!database.objectStoreNames.contains(MATCH_ARCHIVE_STORE)) {
        const store = database.createObjectStore(MATCH_ARCHIVE_STORE, {
          keyPath: "id",
        });
        store.createIndex("syncStatus", "syncStatus", { unique: false });
        store.createIndex("queuedAt", "queuedAt", { unique: false });
      }

      if (!database.objectStoreNames.contains(BOARD_OFFLINE_MATCH_STORE)) {
        const store = database.createObjectStore(BOARD_OFFLINE_MATCH_STORE, {
          keyPath: "id",
        });
        store.createIndex("deviceId", "deviceId", { unique: false });
        store.createIndex("updatedAt", "updatedAt", { unique: false });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () =>
      reject(request.error ?? new Error("Could not open local persistence DB."));
    request.onblocked = () =>
      reject(new Error("Local persistence DB upgrade was blocked."));
  });
}

export function requestAsPromise<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () =>
      reject(request.error ?? new Error("IndexedDB request failed."));
  });
}

export function transactionAsPromise(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () =>
      reject(transaction.error ?? new Error("IndexedDB transaction failed."));
    transaction.onabort = () =>
      reject(transaction.error ?? new Error("IndexedDB transaction aborted."));
  });
}
