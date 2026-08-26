import assert from "node:assert/strict";

import { IDBKeyRange, indexedDB } from "fake-indexeddb";

import type { LeagueMatchSummary } from "@/lib/league/matchContracts";
import {
  applyOfflineLeagueMatchMutation,
  expectedStateForLeagueMatch,
  rebuildOfflineLeagueMatch,
} from "@/lib/league/offlineMatchReplica";
import {
  acknowledgeBoardMutation,
  countPendingBoardMutationsForDevice,
  enqueueBoardMutation,
  getBoardOfflineMatch,
  getRecoverableBoardOfflineMatchForDevice,
  queuedRequests,
  removeLatestQueuedScore,
  saveBoardMatchCheckpoint,
} from "@/lib/persistence/boardMatchQueueStore";

Object.assign(globalThis, { indexedDB, IDBKeyRange });

function scheduledMatch(): LeagueMatchSummary {
  return {
    id: "offline-match",
    pairingId: "pairing-1",
    gameNightId: "night-1",
    gameNightName: "Offline Test Night",
    gameNightStatus: "active",
    seasonName: "Season One",
    scheduledAt: 1_920_000_000_000,
    boardId: "board-1",
    boardNumber: 1,
    boardName: "Board 1",
    status: "scheduled",
    startingScore: 101,
    finishRule: "straight",
    legsPerMatch: 3,
    dummyScore: 0,
    currentLegNumber: 1,
    currentTeamId: "team-a",
    currentMemberId: "a1",
    currentMemberName: "A One",
    winnerTeamId: null,
    teamA: {
      id: "team-a",
      name: "Team A",
      legsWon: 0,
      score: 101,
      members: [
        { id: "a1", leaguePlayerId: "pa1", displayName: "A One", isDummy: false, slotIndex: 0 },
        { id: "a2", leaguePlayerId: "pa2", displayName: "A Two", isDummy: false, slotIndex: 1 },
      ],
    },
    teamB: {
      id: "team-b",
      name: "Team B",
      legsWon: 0,
      score: 101,
      members: [
        { id: "b1", leaguePlayerId: "pb1", displayName: "B One", isDummy: false, slotIndex: 0 },
        { id: "b2", leaguePlayerId: "pb2", displayName: "B Two", isDummy: false, slotIndex: 1 },
      ],
    },
    turns: [],
    canUndo: false,
    startedAt: null,
    completedAt: null,
    updatedAt: 1_920_000_000_000,
  };
}

async function run() {
  const checkpoint = scheduledMatch();
  const started = applyOfflineLeagueMatchMutation(
    checkpoint,
    { action: "start", matchId: checkpoint.id },
    1_920_000_000_010,
  );
  assert.equal(started.status, "active");
  assert.equal(started.currentMemberName, "A One");

  const firstExpected = expectedStateForLeagueMatch(started);
  const firstRequest = {
    action: "score" as const,
    matchId: checkpoint.id,
    turnId: "offline-turn-1",
    scoreEntered: 60,
    dartsThrown: 3 as const,
    expectedState: firstExpected,
  };
  const afterFirst = applyOfflineLeagueMatchMutation(
    started,
    firstRequest,
    1_920_000_000_020,
  );
  assert.equal(afterFirst.teamA.score, 41);
  assert.equal(afterFirst.currentTeamId, "team-b");
  assert.equal(afterFirst.currentMemberName, "B One");

  const secondRequest = {
    action: "score" as const,
    matchId: checkpoint.id,
    turnId: "offline-turn-2",
    scoreEntered: 40,
    dartsThrown: 3 as const,
    expectedState: expectedStateForLeagueMatch(afterFirst),
  };
  const afterSecond = applyOfflineLeagueMatchMutation(
    afterFirst,
    secondRequest,
    1_920_000_000_030,
  );
  assert.equal(afterSecond.teamB.score, 61);
  assert.equal(afterSecond.currentMemberName, "A Two");

  const checkoutRequest = {
    action: "score" as const,
    matchId: checkpoint.id,
    turnId: "offline-turn-3",
    scoreEntered: 41,
    dartsThrown: 2 as const,
    expectedState: expectedStateForLeagueMatch(afterSecond),
  };
  const afterCheckout = applyOfflineLeagueMatchMutation(
    afterSecond,
    checkoutRequest,
    1_920_000_000_040,
  );
  assert.equal(afterCheckout.teamA.legsWon, 1);
  assert.equal(afterCheckout.currentLegNumber, 2);
  assert.equal(afterCheckout.currentTeamId, "team-b", "Leg 2 starter should rotate to Team B.");
  assert.equal(afterCheckout.currentMemberName, "B Two", "Member starter should rotate with the leg number.");
  assert.equal(afterCheckout.teamA.score, 101);
  assert.equal(afterCheckout.teamB.score, 101);

  const deviceId = "offline-device";
  await saveBoardMatchCheckpoint(deviceId, checkpoint, 1_920_000_000_100);
  let record = await enqueueBoardMutation({
    deviceId,
    matchId: checkpoint.id,
    checkpoint,
    mutation: {
      id: "start-queue",
      action: "start",
      queuedAt: 1_920_000_000_110,
      request: { action: "start", matchId: checkpoint.id },
    },
  });
  record = await enqueueBoardMutation({
    deviceId,
    matchId: checkpoint.id,
    checkpoint,
    mutation: {
      id: firstRequest.turnId,
      action: "score",
      queuedAt: 1_920_000_000_120,
      request: firstRequest,
      displayName: "A One",
      teamName: "Team A",
      legNumber: 1,
    },
  });
  record = await enqueueBoardMutation({
    deviceId,
    matchId: checkpoint.id,
    checkpoint,
    mutation: {
      id: secondRequest.turnId,
      action: "score",
      queuedAt: 1_920_000_000_130,
      request: secondRequest,
      displayName: "B One",
      teamName: "Team B",
      legNumber: 1,
    },
  });

  assert.equal(record.queue.length, 3);
  assert.equal(await countPendingBoardMutationsForDevice(deviceId), 3);
  const recovered = await getRecoverableBoardOfflineMatchForDevice(deviceId);
  assert.equal(recovered?.matchId, checkpoint.id, "A refresh should recover the queued match.");
  const projection = rebuildOfflineLeagueMatch(record.checkpoint, queuedRequests(record));
  assert.equal(projection.teamA.score, 41);
  assert.equal(projection.teamB.score, 61);

  const undo = await removeLatestQueuedScore(deviceId, checkpoint.id, 1_920_000_000_140);
  assert.equal(undo.removed?.id, secondRequest.turnId);
  const afterLocalUndo = rebuildOfflineLeagueMatch(
    undo.record.checkpoint,
    queuedRequests(undo.record),
  );
  assert.equal(afterLocalUndo.teamA.score, 41);
  assert.equal(afterLocalUndo.teamB.score, 101);
  assert.equal(afterLocalUndo.currentMemberName, "B One");

  const acknowledged = await acknowledgeBoardMutation({
    deviceId,
    matchId: checkpoint.id,
    mutationId: "start-queue",
    checkpoint: started,
    now: 1_920_000_000_150,
  });
  assert.equal(acknowledged.queue.length, 1);
  assert.equal(acknowledged.queue[0].id, firstRequest.turnId);
  const finalRecord = await getBoardOfflineMatch(deviceId, checkpoint.id);
  assert.equal(finalRecord?.checkpoint.status, "active");

  console.log("Board offline queue contract passed.");
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
