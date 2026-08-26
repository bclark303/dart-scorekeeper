import type {
  LeagueMatchMutationRequest,
  LeagueMatchScoreRequest,
  LeagueMatchSummary,
  StartLeagueMatchRequest,
} from "@/lib/league/matchContracts";
import {
  BOARD_OFFLINE_MATCH_STORE,
  openLocalPersistenceDatabase,
  requestAsPromise,
  transactionAsPromise,
} from "./localDatabase";

export type BoardQueuedStartMutation = {
  id: string;
  action: "start";
  queuedAt: number;
  request: StartLeagueMatchRequest;
};

export type BoardQueuedScoreMutation = {
  id: string;
  action: "score";
  queuedAt: number;
  request: LeagueMatchScoreRequest;
  displayName: string;
  teamName: string;
  legNumber: number;
};

export type BoardQueuedMutation =
  | BoardQueuedStartMutation
  | BoardQueuedScoreMutation;

export type BoardOfflineConflict = {
  kind: "conflict" | "credential";
  message: string;
  occurredAt: number;
};

export type BoardOfflineMatchRecord = {
  id: string;
  deviceId: string;
  matchId: string;
  checkpoint: LeagueMatchSummary;
  queue: BoardQueuedMutation[];
  updatedAt: number;
  lastSyncAttemptAt: number | null;
  syncedAt: number | null;
  lastSyncError: string | null;
  conflict: BoardOfflineConflict | null;
};

export const BOARD_OFFLINE_QUEUE_CHANGED_EVENT =
  "dart-scorekeeper-board-offline-queue-changed";

function recordId(deviceId: string, matchId: string) {
  return `${deviceId}:${matchId}`;
}

function notifyChanged() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(BOARD_OFFLINE_QUEUE_CHANGED_EVENT));
  }
}

async function readRecordById(id: string): Promise<BoardOfflineMatchRecord | null> {
  const database = await openLocalPersistenceDatabase();
  try {
    const transaction = database.transaction(BOARD_OFFLINE_MATCH_STORE, "readonly");
    const completed = transactionAsPromise(transaction);
    const request = transaction
      .objectStore(BOARD_OFFLINE_MATCH_STORE)
      .get(id) as IDBRequest<BoardOfflineMatchRecord | undefined>;
    const record = await requestAsPromise(request);
    await completed;
    return record ?? null;
  } finally {
    database.close();
  }
}

async function mutateRecord(
  deviceId: string,
  matchId: string,
  mutate: (existing: BoardOfflineMatchRecord | null) => BoardOfflineMatchRecord,
): Promise<BoardOfflineMatchRecord> {
  const database = await openLocalPersistenceDatabase();
  try {
    const transaction = database.transaction(BOARD_OFFLINE_MATCH_STORE, "readwrite");
    const store = transaction.objectStore(BOARD_OFFLINE_MATCH_STORE);
    const existing = await requestAsPromise(
      store.get(recordId(deviceId, matchId)) as IDBRequest<
        BoardOfflineMatchRecord | undefined
      >,
    );
    const updated = mutate(existing ?? null);
    store.put(updated);
    await transactionAsPromise(transaction);
    notifyChanged();
    return updated;
  } finally {
    database.close();
  }
}

export async function getBoardOfflineMatch(
  deviceId: string,
  matchId: string,
): Promise<BoardOfflineMatchRecord | null> {
  return readRecordById(recordId(deviceId, matchId));
}

export async function listBoardOfflineMatchesForDevice(
  deviceId: string,
): Promise<BoardOfflineMatchRecord[]> {
  const database = await openLocalPersistenceDatabase();
  try {
    const transaction = database.transaction(BOARD_OFFLINE_MATCH_STORE, "readonly");
    const completed = transactionAsPromise(transaction);
    const request = transaction
      .objectStore(BOARD_OFFLINE_MATCH_STORE)
      .index("deviceId")
      .getAll(deviceId) as IDBRequest<BoardOfflineMatchRecord[]>;
    const records = await requestAsPromise(request);
    await completed;
    return records.sort((left, right) => right.updatedAt - left.updatedAt);
  } finally {
    database.close();
  }
}

export async function getRecoverableBoardOfflineMatchForDevice(
  deviceId: string,
): Promise<BoardOfflineMatchRecord | null> {
  const records = await listBoardOfflineMatchesForDevice(deviceId);
  return (
    records.find(
      (record) =>
        record.queue.length > 0 ||
        record.checkpoint.status === "active" ||
        record.checkpoint.status === "scheduled",
    ) ?? null
  );
}

export async function countPendingBoardMutationsForDevice(deviceId: string) {
  const records = await listBoardOfflineMatchesForDevice(deviceId);
  return records.reduce((sum, record) => sum + record.queue.length, 0);
}

export async function saveBoardMatchCheckpoint(
  deviceId: string,
  checkpoint: LeagueMatchSummary,
  now = Date.now(),
): Promise<BoardOfflineMatchRecord> {
  return mutateRecord(deviceId, checkpoint.id, (existing) => ({
    id: recordId(deviceId, checkpoint.id),
    deviceId,
    matchId: checkpoint.id,
    checkpoint,
    queue: existing?.queue ?? [],
    updatedAt: now,
    lastSyncAttemptAt: existing?.lastSyncAttemptAt ?? null,
    syncedAt: existing?.queue.length ? existing.syncedAt : now,
    lastSyncError: existing?.queue.length ? existing.lastSyncError : null,
    conflict: existing?.queue.length ? existing.conflict : null,
  }));
}

export async function enqueueBoardMutation(input: {
  deviceId: string;
  matchId: string;
  checkpoint: LeagueMatchSummary;
  mutation: BoardQueuedMutation;
}): Promise<BoardOfflineMatchRecord> {
  return mutateRecord(input.deviceId, input.matchId, (existing) => {
    const queue = existing?.queue ?? [];
    if (queue.some((item) => item.id === input.mutation.id)) {
      return existing ?? {
        id: recordId(input.deviceId, input.matchId),
        deviceId: input.deviceId,
        matchId: input.matchId,
        checkpoint: input.checkpoint,
        queue,
        updatedAt: input.mutation.queuedAt,
        lastSyncAttemptAt: null,
        syncedAt: null,
        lastSyncError: null,
        conflict: null,
      };
    }
    return {
      id: recordId(input.deviceId, input.matchId),
      deviceId: input.deviceId,
      matchId: input.matchId,
      checkpoint: existing?.checkpoint ?? input.checkpoint,
      queue: [...queue, input.mutation],
      updatedAt: input.mutation.queuedAt,
      lastSyncAttemptAt: existing?.lastSyncAttemptAt ?? null,
      syncedAt: existing?.syncedAt ?? null,
      lastSyncError: null,
      conflict: null,
    };
  });
}

export async function acknowledgeBoardMutation(input: {
  deviceId: string;
  matchId: string;
  mutationId: string;
  checkpoint: LeagueMatchSummary;
  now?: number;
}): Promise<BoardOfflineMatchRecord> {
  const now = input.now ?? Date.now();
  return mutateRecord(input.deviceId, input.matchId, (existing) => {
    if (!existing) {
      throw new Error("Offline board match record was not found.");
    }
    const queue = existing.queue.filter((item) => item.id !== input.mutationId);
    return {
      ...existing,
      checkpoint: input.checkpoint,
      queue,
      updatedAt: now,
      lastSyncAttemptAt: now,
      syncedAt: queue.length === 0 ? now : existing.syncedAt,
      lastSyncError: null,
      conflict: null,
    };
  });
}

export async function removeLatestQueuedScore(
  deviceId: string,
  matchId: string,
  now = Date.now(),
): Promise<{ record: BoardOfflineMatchRecord; removed: BoardQueuedScoreMutation | null }> {
  let removed: BoardQueuedScoreMutation | null = null;
  const record = await mutateRecord(deviceId, matchId, (existing) => {
    if (!existing) throw new Error("Offline board match record was not found.");
    const index = [...existing.queue]
      .map((item, itemIndex) => ({ item, itemIndex }))
      .reverse()
      .find(({ item }) => item.action === "score")?.itemIndex;
    if (index === undefined) return existing;
    const item = existing.queue[index];
    if (item.action !== "score") return existing;
    removed = item;
    return {
      ...existing,
      queue: existing.queue.filter((_, itemIndex) => itemIndex !== index),
      updatedAt: now,
      lastSyncError: null,
      conflict: null,
    };
  });
  return { record, removed };
}

export async function markBoardSyncProblem(input: {
  deviceId: string;
  matchId: string;
  kind: "conflict" | "credential" | "network";
  message: string;
  now?: number;
}): Promise<BoardOfflineMatchRecord> {
  const now = input.now ?? Date.now();
  return mutateRecord(input.deviceId, input.matchId, (existing) => {
    if (!existing) throw new Error("Offline board match record was not found.");
    return {
      ...existing,
      updatedAt: now,
      lastSyncAttemptAt: now,
      lastSyncError: input.message,
      conflict:
        input.kind === "network"
          ? existing.conflict
          : { kind: input.kind, message: input.message, occurredAt: now },
    };
  });
}

export async function clearBoardSyncProblem(
  deviceId: string,
  matchId: string,
  now = Date.now(),
): Promise<BoardOfflineMatchRecord> {
  return mutateRecord(deviceId, matchId, (existing) => {
    if (!existing) throw new Error("Offline board match record was not found.");
    return {
      ...existing,
      updatedAt: now,
      lastSyncError: null,
      conflict: null,
    };
  });
}

export function queuedRequests(record: BoardOfflineMatchRecord): LeagueMatchMutationRequest[] {
  return record.queue.map((item) => item.request);
}
