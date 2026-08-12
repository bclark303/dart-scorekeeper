import assert from "node:assert/strict";

import {
  addLeaguePlayerToSeasonForUser,
  createGameNightForUser,
  createLeagueForUser,
  createLeaguePlayerForUser,
  getBoardDeviceConnectionForCredential,
  getGameNightForUser,
  populateGameNightBoardsForUser,
  prepareGameNightTeamsForUser,
  registerBoardDeviceForUser,
  setGameNightStatusForUser,
  startBoardDeviceMatchForCredential,
  submitBoardDeviceTurnForCredential,
  updateGameNightAttendanceForUser,
} from "@/lib/db";
import { DEFAULT_GAME_NIGHT_SETTINGS } from "@/lib/league/gameNightContracts";

async function finishStraightOutMatch(
  deviceKey: string,
  matchId: string,
  suffix: string,
) {
  await submitBoardDeviceTurnForCredential({
    deviceKey,
    matchId,
    turnId: `${suffix}-a-180`,
    scoreEntered: 180,
    dartsThrown: 3,
  });
  await submitBoardDeviceTurnForCredential({
    deviceKey,
    matchId,
    turnId: `${suffix}-b-zero`,
    scoreEntered: 0,
    dartsThrown: 3,
  });
  return submitBoardDeviceTurnForCredential({
    deviceKey,
    matchId,
    turnId: `${suffix}-a-121`,
    scoreEntered: 121,
    dartsThrown: 3,
  });
}

async function run() {
  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const ownerUserId = `multi-owner-${suffix}`;
  const leagueId = `multi-league-${suffix}`;
  const seasonId = `multi-season-${suffix}`;
  const gameNightId = `multi-night-${suffix}`;

  await createLeagueForUser({
    id: leagueId,
    membershipId: `multi-membership-${suffix}`,
    userId: ownerUserId,
    name: "Multi Board Contract League",
    firstSeason: { id: seasonId, name: "Season One" },
  });

  const leaguePlayerIds: string[] = [];
  for (let index = 0; index < 4; index += 1) {
    const leaguePlayerId = `multi-league-player-${index}-${suffix}`;
    leaguePlayerIds.push(leaguePlayerId);
    await createLeaguePlayerForUser({
      playerId: `multi-player-${index}-${suffix}`,
      leaguePlayerId,
      leagueId,
      userId: ownerUserId,
      displayName: `Multi Player ${index + 1}`,
    });
    await addLeaguePlayerToSeasonForUser({
      rosterEntryId: `multi-roster-${index}-${suffix}`,
      leagueId,
      seasonId,
      leaguePlayerId,
      userId: ownerUserId,
    });
  }

  await createGameNightForUser({
    id: gameNightId,
    leagueId,
    seasonId,
    userId: ownerUserId,
    name: "Two Board Night",
    scheduledAt: Date.now() + 60_000,
    settings: {
      ...DEFAULT_GAME_NIGHT_SETTINGS,
      teamCreationMode: "automatic",
      targetTeamCount: 4,
      minTeamPlayers: 1,
      maxTeamPlayers: 1,
      dummyPlayerMode: "none",
      boardCount: 2,
      legsPerMatch: 1,
      startingScore: 301,
      finishRule: "straight",
    },
  });

  for (let index = 0; index < leaguePlayerIds.length; index += 1) {
    await updateGameNightAttendanceForUser({
      attendanceId: `multi-attendance-${index}-${suffix}`,
      gameNightId,
      leaguePlayerId: leaguePlayerIds[index],
      userId: ownerUserId,
      checkedIn: true,
      duesStatus: "paid",
    });
  }

  await prepareGameNightTeamsForUser(gameNightId, ownerUserId);
  const populated = await populateGameNightBoardsForUser(gameNightId, ownerUserId);
  assert.equal(populated.pairings.length, 2, "Two boards must create two central matches.");

  const boardOne = await registerBoardDeviceForUser({
    id: `multi-device-1-${suffix}`,
    leagueId,
    userId: ownerUserId,
    name: "Board One",
    boardNumber: 1,
  });
  const boardTwo = await registerBoardDeviceForUser({
    id: `multi-device-2-${suffix}`,
    leagueId,
    userId: ownerUserId,
    name: "Board Two",
    boardNumber: 2,
  });

  await setGameNightStatusForUser(gameNightId, ownerUserId, "active");

  const connectionOne = await getBoardDeviceConnectionForCredential(boardOne.deviceKey);
  const connectionTwo = await getBoardDeviceConnectionForCredential(boardTwo.deviceKey);
  const matchOneId = connectionOne.assignment?.matchSessionId;
  const matchTwoId = connectionTwo.assignment?.matchSessionId;
  assert.ok(matchOneId, "Board 1 must have a match assignment.");
  assert.ok(matchTwoId, "Board 2 must have a match assignment.");
  assert.notEqual(matchOneId, matchTwoId, "Each board must have its own match session.");

  await startBoardDeviceMatchForCredential(boardOne.deviceKey, matchOneId);
  await startBoardDeviceMatchForCredential(boardTwo.deviceKey, matchTwoId);

  const boardOneFinished = await finishStraightOutMatch(
    boardOne.deviceKey,
    matchOneId,
    `multi-board-1-${suffix}`,
  );
  assert.equal(boardOneFinished.status, "completed");

  const nightAfterBoardOne = await getGameNightForUser(gameNightId, ownerUserId);
  assert.equal(
    nightAfterBoardOne.status,
    "active",
    "Finishing one board must not complete the overall Game Night while another board is still active.",
  );
  assert.equal(
    nightAfterBoardOne.pairings.filter((pairing) => pairing.matchStatus === "completed").length,
    1,
    "Exactly one pairing should be completed after Board 1 finishes.",
  );

  const boardTwoStillConnected = await getBoardDeviceConnectionForCredential(boardTwo.deviceKey);
  assert.equal(
    boardTwoStillConnected.assignment?.gameNightStatus,
    "active",
    "Board 2 must still see the Game Night as active after Board 1 finishes.",
  );
  assert.equal(
    boardTwoStillConnected.assignment?.matchSessionId,
    matchTwoId,
    "Board 2 must retain its own assignment after Board 1 finishes.",
  );
  assert.equal(
    boardTwoStillConnected.match?.status,
    "active",
    "Board 2's match must remain active and scoreable.",
  );

  const boardTwoFinished = await finishStraightOutMatch(
    boardTwo.deviceKey,
    matchTwoId,
    `multi-board-2-${suffix}`,
  );
  assert.equal(boardTwoFinished.status, "completed");

  console.log("Multi-board Game Night completion contract test passed.");
}

run().catch((error) => {
  console.error("Multi-board Game Night completion contract test failed.", error);
  process.exitCode = 1;
});
