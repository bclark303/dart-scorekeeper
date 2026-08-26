import assert from "node:assert/strict";

import {
  addLeaguePlayerToSeasonForUser,
  authenticateBoardDeviceCredential,
  BoardDeviceCredentialError,
  LeagueMatchStateError,
  createGameNightForUser,
  createLeagueForUser,
  createLeaguePlayerForUser,
  getBoardDeviceConnectionForCredential,
  listBoardDevicesForUser,
  populateGameNightBoardsForUser,
  prepareGameNightTeamsForUser,
  registerBoardDeviceForUser,
  rotateBoardDeviceKeyForUser,
  setGameNightStatusForUser,
  startBoardDeviceMatchForCredential,
  submitBoardDeviceTurnForCredential,
  undoBoardDeviceTurnForCredential,
  updateBoardDeviceForUser,
  updateGameNightAttendanceForUser,
} from "@/lib/db";
import { DEFAULT_GAME_NIGHT_SETTINGS } from "@/lib/league/gameNightContracts";
import { expectedStateForLeagueMatch } from "@/lib/league/offlineMatchReplica";

async function run() {
  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const ownerUserId = `device-owner-${suffix}`;
  const leagueId = `device-league-${suffix}`;
  const seasonId = `device-season-${suffix}`;

  await createLeagueForUser({
    id: leagueId,
    membershipId: `device-membership-${suffix}`,
    userId: ownerUserId,
    name: "Board Device Contract League",
    firstSeason: { id: seasonId, name: "Season One" },
    now: 1_910_000_000_000,
  });

  const leaguePlayerIds: string[] = [];
  for (let index = 0; index < 2; index += 1) {
    const leaguePlayerId = `device-league-player-${index}-${suffix}`;
    leaguePlayerIds.push(leaguePlayerId);
    await createLeaguePlayerForUser({
      playerId: `device-player-${index}-${suffix}`,
      leaguePlayerId,
      leagueId,
      userId: ownerUserId,
      displayName: `Device Player ${index + 1}`,
      now: 1_910_000_000_010 + index,
    });
    await addLeaguePlayerToSeasonForUser({
      rosterEntryId: `device-roster-${index}-${suffix}`,
      leagueId,
      seasonId,
      leaguePlayerId,
      userId: ownerUserId,
      now: 1_910_000_000_020 + index,
    });
  }

  const gameNightId = `device-night-${suffix}`;
  await createGameNightForUser({
    id: gameNightId,
    leagueId,
    seasonId,
    userId: ownerUserId,
    name: "Device Test Night",
    scheduledAt: 1_910_100_000_000,
    settings: {
      ...DEFAULT_GAME_NIGHT_SETTINGS,
      targetTeamCount: 2,
      minTeamPlayers: 1,
      maxTeamPlayers: 2,
      dummyPlayerMode: "none",
      boardCount: 1,
      roundCount: 1,
      legsPerMatch: 1,
      startingScore: 301,
      finishRule: "double",
    },
    now: 1_910_000_000_100,
  });

  for (let index = 0; index < leaguePlayerIds.length; index += 1) {
    await updateGameNightAttendanceForUser({
      gameNightId,
      leaguePlayerId: leaguePlayerIds[index],
      userId: ownerUserId,
      checkedIn: true,
      duesStatus: "paid",
      now: 1_910_000_000_200 + index,
    });
  }
  await prepareGameNightTeamsForUser(gameNightId, ownerUserId);
  const populated = await populateGameNightBoardsForUser(gameNightId, ownerUserId);
  assert.equal(populated.rounds?.[0].status, "draft");
  assert.ok(
    populated.rounds?.[0].pairings[0]?.matchSessionId,
    "The coordinator's draft must already have a central match session.",
  );

  const registered = await registerBoardDeviceForUser({
    id: `device-${suffix}`,
    leagueId,
    userId: ownerUserId,
    name: "Board One Tablet",
    boardNumber: 1,
    now: 1_910_000_000_300,
  });
  assert.match(registered.deviceKey, /^dsk_.+\..+$/);
  assert.equal(registered.device.status, "active");
  assert.equal(registered.device.boardNumber, 1);

  const devices = await listBoardDevicesForUser(leagueId, ownerUserId);
  assert.equal(devices.length, 1);
  assert.equal(devices[0].id, registered.device.id);
  assert.equal(
    "deviceKey" in devices[0],
    false,
    "Plaintext device keys must never appear in list results.",
  );

  const authenticated = await authenticateBoardDeviceCredential(
    registered.deviceKey,
  );
  assert.equal(authenticated.id, registered.device.id);
  assert.ok(
    authenticated.lastSeenAt,
    "Successful device authentication should update last-seen state.",
  );

  let connection = await getBoardDeviceConnectionForCredential(
    registered.deviceKey,
  );
  assert.equal(connection.assignment?.gameNightId, gameNightId);
  assert.equal(connection.assignment?.boardNumber, 1);
  assert.equal(
    connection.assignment?.matchSessionId ?? null,
    null,
    "A generated draft round must not become a playable board assignment before the Game Night starts.",
  );
  assert.equal(connection.match, null);

  await setGameNightStatusForUser(gameNightId, ownerUserId, "active");
  connection = await getBoardDeviceConnectionForCredential(registered.deviceKey);
  assert.equal(connection.assignment?.roundNumber, 1);
  assert.ok(
    connection.assignment?.matchSessionId,
    "Starting the Game Night must release the Round 1 central match to its registered board.",
  );
  assert.equal(connection.match?.status, "scheduled");
  const matchId = connection.assignment?.matchSessionId;
  assert.ok(matchId);

  let match = await startBoardDeviceMatchForCredential(
    registered.deviceKey,
    matchId,
  );
  assert.equal(match.status, "active");
  const expectedBeforeFirstTurn = expectedStateForLeagueMatch(match);

  const turnId = `device-turn-${suffix}`;
  match = await submitBoardDeviceTurnForCredential({
    deviceKey: registered.deviceKey,
    matchId,
    turnId,
    scoreEntered: 60,
    dartsThrown: 3,
    expectedState: expectedBeforeFirstTurn,
    darts: [
      {
        id: `device-dart-1-${suffix}`,
        segment: 20,
        multiplier: 1,
        score: 20,
      },
      {
        id: `device-dart-2-${suffix}`,
        segment: 20,
        multiplier: 1,
        score: 20,
      },
      {
        id: `device-dart-3-${suffix}`,
        segment: 20,
        multiplier: 1,
        score: 20,
      },
    ],
  });
  assert.equal(match.turns.length, 1);
  assert.equal(match.turns[0].scoreEntered, 60);
  assert.deepEqual(
    match.turns[0].darts.map((dart) => dart.score),
    [20, 20, 20],
  );
  assert.deepEqual(
    match.turns[0].darts.map((dart) => dart.segment),
    [20, 20, 20],
  );

  match = await submitBoardDeviceTurnForCredential({
    deviceKey: registered.deviceKey,
    matchId,
    turnId,
    scoreEntered: 60,
    dartsThrown: 3,
    expectedState: expectedBeforeFirstTurn,
    darts: [
      {
        id: `device-dart-1-${suffix}`,
        segment: 20,
        multiplier: 1,
        score: 20,
      },
      {
        id: `device-dart-2-${suffix}`,
        segment: 20,
        multiplier: 1,
        score: 20,
      },
      {
        id: `device-dart-3-${suffix}`,
        segment: 20,
        multiplier: 1,
        score: 20,
      },
    ],
  });
  assert.equal(
    match.turns.length,
    1,
    "Retrying the same device turn ID must be idempotent.",
  );

  await assert.rejects(
    () =>
      submitBoardDeviceTurnForCredential({
        deviceKey: registered.deviceKey,
        matchId,
        turnId: `device-stale-turn-${suffix}`,
        scoreEntered: 45,
        dartsThrown: 3,
        expectedState: expectedBeforeFirstTurn,
      }),
    (error: unknown) =>
      error instanceof LeagueMatchStateError &&
      /Offline sync conflict/.test(error.message),
    "A new turn carrying stale local state must stop instead of being credited to the server's new thrower.",
  );

  match = await undoBoardDeviceTurnForCredential(
    registered.deviceKey,
    matchId,
  );
  assert.equal(
    match.turns.length,
    0,
    "Device undo should void the central turn and recalculate state.",
  );
  assert.equal(match.status, "active");

  const rotated = await rotateBoardDeviceKeyForUser({
    deviceId: registered.device.id,
    userId: ownerUserId,
    now: 1_910_000_000_400,
  });
  assert.notEqual(rotated.deviceKey, registered.deviceKey);
  await assert.rejects(
    () => authenticateBoardDeviceCredential(registered.deviceKey),
    (error: unknown) => error instanceof BoardDeviceCredentialError,
    "Rotating a key must invalidate the previous credential immediately.",
  );
  connection = await getBoardDeviceConnectionForCredential(rotated.deviceKey);
  assert.equal(connection.assignment?.matchSessionId, matchId);

  await updateBoardDeviceForUser({
    deviceId: registered.device.id,
    userId: ownerUserId,
    status: "disabled",
    now: 1_910_000_000_500,
  });
  await assert.rejects(
    () => authenticateBoardDeviceCredential(rotated.deviceKey),
    (error: unknown) =>
      error instanceof BoardDeviceCredentialError && error.reason === "disabled",
    "Disabled board devices must be rejected even with the correct key.",
  );

  console.log("Board device registration and connector contract test passed.");
}

run().catch((error) => {
  console.error(
    "Board device registration and connector contract test failed.",
    error,
  );
  process.exitCode = 1;
});
