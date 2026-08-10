import type { X01MatchArchive } from "./contracts";

const LOCAL_PERSISTENCE_DATABASE = "dart-scorekeeper-local";
const LOCAL_PERSISTENCE_VERSION = 1;
const MATCH_ARCHIVE_STORE = "matchArchives";

export type LocalArchiveSyncStatus = "pending" | "synced" | "error";

/**
 * Browser-local durable record for a completed match.
 *
 * The archive itself is provider-neutral. Sync metadata belongs only to the
 * local queue so a future server/Turso/D1 implementation can change without
 * changing the stored match contract.
 */
export type LocalX01MatchArchiveRecord = {
  id: string;
  gameType: "x01";
  archive: X01MatchArchive;
  syncStatus: LocalArchiveSyncStatus;
  queuedAt: number;
  updatedAt: number;
  lastSyncAttemptAt: number | null;
  syncedAt: number | null;
  lastSyncError: string | null;
};

function assertIndexedDbAvailable() {
  if (typeof indexedDB === "undefined") {
    throw new Error("IndexedDB is not available in this environment.");
  }
}

function openLocalPersistenceDatabase(): Promise<IDBDatabase> {
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
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () =>
      reject(request.error ?? new Error("Could not open local persistence DB."));
    request.onblocked = () =>
      reject(new Error("Local persistence DB upgrade was blocked."));
  });
}

function requestAsPromise<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () =>
      reject(request.error ?? new Error("IndexedDB request failed."));
  });
}

function transactionAsPromise(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () =>
      reject(transaction.error ?? new Error("IndexedDB transaction failed."));
    transaction.onabort = () =>
      reject(transaction.error ?? new Error("IndexedDB transaction aborted."));
  });
}

async function readArchiveRecord(
  matchId: string,
): Promise<LocalX01MatchArchiveRecord | null> {
  const database = await openLocalPersistenceDatabase();

  try {
    const transaction = database.transaction(MATCH_ARCHIVE_STORE, "readonly");
    const request = transaction
      .objectStore(MATCH_ARCHIVE_STORE)
      .get(matchId) as IDBRequest<LocalX01MatchArchiveRecord | undefined>;

    const record = await requestAsPromise(request);
    await transactionAsPromise(transaction);

    return record ?? null;
  } finally {
    database.close();
  }
}

/**
 * Queue a completed archive exactly once.
 *
 * Completed matches are immutable snapshots. If the same durable match ID is
 * seen again after a refresh/effect retry, the existing record wins instead
 * of resetting sync state or creating a duplicate.
 */
export async function queueLocalX01MatchArchive(
  archive: X01MatchArchive,
): Promise<LocalX01MatchArchiveRecord> {
  const existing = await readArchiveRecord(archive.id);

  if (existing) {
    return existing;
  }

  const queuedAt = Date.now();
  const record: LocalX01MatchArchiveRecord = {
    id: archive.id,
    gameType: "x01",
    archive,
    syncStatus: "pending",
    queuedAt,
    updatedAt: queuedAt,
    lastSyncAttemptAt: null,
    syncedAt: null,
    lastSyncError: null,
  };

  const database = await openLocalPersistenceDatabase();

  try {
    const transaction = database.transaction(MATCH_ARCHIVE_STORE, "readwrite");
    transaction.objectStore(MATCH_ARCHIVE_STORE).put(record);
    await transactionAsPromise(transaction);
  } finally {
    database.close();
  }

  return record;
}

export async function getLocalX01MatchArchive(
  matchId: string,
): Promise<LocalX01MatchArchiveRecord | null> {
  return readArchiveRecord(matchId);
}

export async function listLocalX01MatchArchives(): Promise<
  LocalX01MatchArchiveRecord[]
> {
  const database = await openLocalPersistenceDatabase();

  try {
    const transaction = database.transaction(MATCH_ARCHIVE_STORE, "readonly");
    const request = transaction
      .objectStore(MATCH_ARCHIVE_STORE)
      .getAll() as IDBRequest<LocalX01MatchArchiveRecord[]>;

    const records = await requestAsPromise(request);
    await transactionAsPromise(transaction);

    return records.sort((left, right) => right.queuedAt - left.queuedAt);
  } finally {
    database.close();
  }
}

export async function listPendingLocalX01MatchArchives(): Promise<
  LocalX01MatchArchiveRecord[]
> {
  const records = await listLocalX01MatchArchives();
  return records.filter((record) => record.syncStatus !== "synced");
}

export async function markLocalX01MatchArchiveSynced(
  matchId: string,
  syncedAt = Date.now(),
): Promise<void> {
  const existing = await readArchiveRecord(matchId);

  if (!existing) {
    throw new Error(`Local archive ${matchId} does not exist.`);
  }

  const database = await openLocalPersistenceDatabase();

  try {
    const transaction = database.transaction(MATCH_ARCHIVE_STORE, "readwrite");
    transaction.objectStore(MATCH_ARCHIVE_STORE).put({
      ...existing,
      syncStatus: "synced",
      updatedAt: syncedAt,
      lastSyncAttemptAt: syncedAt,
      syncedAt,
      lastSyncError: null,
    } satisfies LocalX01MatchArchiveRecord);
    await transactionAsPromise(transaction);
  } finally {
    database.close();
  }
}

export async function markLocalX01MatchArchiveSyncError(
  matchId: string,
  message: string,
  attemptedAt = Date.now(),
): Promise<void> {
  const existing = await readArchiveRecord(matchId);

  if (!existing) {
    throw new Error(`Local archive ${matchId} does not exist.`);
  }

  const database = await openLocalPersistenceDatabase();

  try {
    const transaction = database.transaction(MATCH_ARCHIVE_STORE, "readwrite");
    transaction.objectStore(MATCH_ARCHIVE_STORE).put({
      ...existing,
      syncStatus: "error",
      updatedAt: attemptedAt,
      lastSyncAttemptAt: attemptedAt,
      lastSyncError: message,
    } satisfies LocalX01MatchArchiveRecord);
    await transactionAsPromise(transaction);
  } finally {
    database.close();
  }
}
