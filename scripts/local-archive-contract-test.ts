import assert from "node:assert/strict";
import "fake-indexeddb/auto";

import {
  getLocalX01MatchArchive,
  listLocalX01MatchArchives,
  listPendingLocalX01MatchArchives,
  markLocalX01MatchArchiveSynced,
  markLocalX01MatchArchiveSyncError,
  queueLocalX01MatchArchive,
  type X01MatchArchive,
} from "@/lib/persistence";

const MATCH_ID = "match-local-archive-contract";
const SIDE_ONE_ID = `${MATCH_ID}:side:side-1`;
const SIDE_TWO_ID = `${MATCH_ID}:side:side-2`;

const archive: X01MatchArchive = {
  id: MATCH_ID,
  status: "complete",
  winnerSideId: SIDE_ONE_ID,
  createdAt: 1000,
  startedAt: 1000,
  updatedAt: 2000,
  completedAt: 2000,
  settings: {
    startingScore: 301,
    finishRule: "double_out",
    bestOfLegs: 1,
    scoreEntryMode: "dart",
    rotationMode: "independent",
    dummyScore: 0,
  },
  sides: [
    {
      id: SIDE_ONE_ID,
      sideIndex: 0,
      name: "Side A",
      participants: [
        {
          id: `${MATCH_ID}:participant:a`,
          playerId: null,
          slotIndex: 0,
          displayName: "Player A",
          isDummy: false,
        },
      ],
    },
    {
      id: SIDE_TWO_ID,
      sideIndex: 1,
      name: "Side B",
      participants: [
        {
          id: `${MATCH_ID}:participant:b`,
          playerId: null,
          slotIndex: 0,
          displayName: "Player B",
          isDummy: false,
        },
      ],
    },
  ],
  legs: [
    {
      id: `${MATCH_ID}:leg:1`,
      legNumber: 1,
      startingSideId: SIDE_ONE_ID,
      winnerSideId: SIDE_ONE_ID,
      startedAt: 1000,
      completedAt: 2000,
      turns: [],
    },
  ],
};

async function run() {
  const first = await queueLocalX01MatchArchive(archive);

  assert.equal(first.id, MATCH_ID);
  assert.equal(first.syncStatus, "pending");
  assert.equal(first.archive.id, MATCH_ID);
  assert.equal((await listLocalX01MatchArchives()).length, 1);
  assert.equal((await listPendingLocalX01MatchArchives()).length, 1);

  // A repeated completion effect/reload must return the original queue record
  // rather than replacing it or creating a duplicate.
  const repeated = await queueLocalX01MatchArchive({
    ...archive,
    updatedAt: 9999,
  });

  assert.equal(repeated.queuedAt, first.queuedAt);
  assert.equal(repeated.archive.updatedAt, archive.updatedAt);
  assert.equal((await listLocalX01MatchArchives()).length, 1);

  await markLocalX01MatchArchiveSyncError(MATCH_ID, "temporary failure", 3000);

  const failed = await getLocalX01MatchArchive(MATCH_ID);
  assert.ok(failed);
  assert.equal(failed.syncStatus, "error");
  assert.equal(failed.lastSyncAttemptAt, 3000);
  assert.equal(failed.lastSyncError, "temporary failure");
  assert.equal((await listPendingLocalX01MatchArchives()).length, 1);

  // A completion-effect retry after an error must preserve that error state.
  const repeatedAfterError = await queueLocalX01MatchArchive(archive);
  assert.equal(repeatedAfterError.syncStatus, "error");
  assert.equal(repeatedAfterError.lastSyncError, "temporary failure");

  await markLocalX01MatchArchiveSynced(MATCH_ID, 4000);

  const synced = await getLocalX01MatchArchive(MATCH_ID);
  assert.ok(synced);
  assert.equal(synced.syncStatus, "synced");
  assert.equal(synced.syncedAt, 4000);
  assert.equal(synced.lastSyncAttemptAt, 4000);
  assert.equal(synced.lastSyncError, null);
  assert.equal((await listPendingLocalX01MatchArchives()).length, 0);

  // A completed-match reload after sync must not push the record back to pending.
  const repeatedAfterSync = await queueLocalX01MatchArchive(archive);
  assert.equal(repeatedAfterSync.syncStatus, "synced");
  assert.equal((await listLocalX01MatchArchives()).length, 1);

  console.log("Local IndexedDB archive contract test passed.");
}

run().catch((error) => {
  console.error("Local IndexedDB archive contract test failed.", error);
  process.exitCode = 1;
});
