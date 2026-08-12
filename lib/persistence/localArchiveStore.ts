import type { X01MatchArchive } from "./contracts";
import {
  MATCH_ARCHIVE_STORE,
  openLocalPersistenceDatabase,
  requestAsPromise,
  transactionAsPromise,
} from "./localDatabase";

export const LOCAL_ARCHIVE_CHANGED_EVENT =
  "dart-scorekeeper-local-archive-changed";

export type LocalArchiveSyncStatus = "pending" | "synced" | "error";

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

function notifyArchiveChanged() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(LOCAL_ARCHIVE_CHANGED_EVENT));
  }
}

async function readArchiveRecord(
  matchId: string,
): Promise<LocalX01MatchArchiveRecord | null> {
  const database = await openLocalPersistenceDatabase();

  try {
    const transaction = database.transaction(MATCH_ARCHIVE_STORE, "readonly");
    const transactionCompleted = transactionAsPromise(transaction);
    const request = transaction
      .objectStore(MATCH_ARCHIVE_STORE)
      .get(matchId) as IDBRequest<LocalX01MatchArchiveRecord | undefined>;

    const record = await requestAsPromise(request);
    await transactionCompleted;

    return record ?? null;
  } finally {
    database.close();
  }
}

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
    const transactionCompleted = transactionAsPromise(transaction);
    transaction.objectStore(MATCH_ARCHIVE_STORE).put(record);
    await transactionCompleted;
  } finally {
    database.close();
  }

  notifyArchiveChanged();
  return record;
}

/**
 * Merge a server-owned completed archive into this browser as already synced.
 * Existing local metadata is retained where useful, while the server snapshot
 * becomes the local immutable archive for that durable match ID.
 */
export async function storeSyncedLocalX01MatchArchive(
  archive: X01MatchArchive,
  syncedAt = Date.now(),
): Promise<void> {
  const existing = await readArchiveRecord(archive.id);
  const record: LocalX01MatchArchiveRecord = {
    id: archive.id,
    gameType: "x01",
    archive,
    syncStatus: "synced",
    queuedAt: existing?.queuedAt ?? archive.completedAt ?? syncedAt,
    updatedAt: syncedAt,
    lastSyncAttemptAt: syncedAt,
    syncedAt,
    lastSyncError: null,
  };

  const database = await openLocalPersistenceDatabase();

  try {
    const transaction = database.transaction(MATCH_ARCHIVE_STORE, "readwrite");
    const transactionCompleted = transactionAsPromise(transaction);
    transaction.objectStore(MATCH_ARCHIVE_STORE).put(record);
    await transactionCompleted;
  } finally {
    database.close();
  }

  notifyArchiveChanged();
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
    const transactionCompleted = transactionAsPromise(transaction);
    const request = transaction
      .objectStore(MATCH_ARCHIVE_STORE)
      .getAll() as IDBRequest<LocalX01MatchArchiveRecord[]>;

    const records = await requestAsPromise(request);
    await transactionCompleted;

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
    const transactionCompleted = transactionAsPromise(transaction);
    transaction.objectStore(MATCH_ARCHIVE_STORE).put({
      ...existing,
      syncStatus: "synced",
      updatedAt: syncedAt,
      lastSyncAttemptAt: syncedAt,
      syncedAt,
      lastSyncError: null,
    } satisfies LocalX01MatchArchiveRecord);
    await transactionCompleted;
  } finally {
    database.close();
  }

  notifyArchiveChanged();
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
    const transactionCompleted = transactionAsPromise(transaction);
    transaction.objectStore(MATCH_ARCHIVE_STORE).put({
      ...existing,
      syncStatus: "error",
      updatedAt: attemptedAt,
      lastSyncAttemptAt: attemptedAt,
      lastSyncError: message,
    } satisfies LocalX01MatchArchiveRecord);
    await transactionCompleted;
  } finally {
    database.close();
  }

  notifyArchiveChanged();
}
