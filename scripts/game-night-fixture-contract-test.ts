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
  replaceGameNightRoundFixturesForUser,
  setGameNightStatusForUser,
  startBoardDeviceMatchForCredential,
  startNextGameNightRoundForUser,
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

function opponentKey(a: string, b: string) {
  return [a, b].sort().join(":");
}

async function finishCurrentRound(
  deviceKeys: string[],
  roundNumber: number,
  suffix: string,
) {
  const matchIds: string[] = [];
  for (let index = 0; index < deviceKeys.length; index += 1) {
    const connection = await getBoardDeviceConnectionForCredential(deviceKeys[index]);
    if (!connection.assignment?.matchSessionId) continue;
    assert.equal(connection.assignment.roundNumber, roundNumber);
    const matchId = connection.assignment.matchSessionId;
    matchIds.push(matchId);
    if (connection.match?.status === "scheduled") {
      await startBoardDeviceMatchForCredential(deviceKeys[index], matchId);
    }
  }

  assert.ok(matchIds.length > 0, `Round ${roundNumber} must have at least one playable board match.`);
  for (let index = 0; index < matchIds.length; index += 1) {
    const connection = await getBoardDeviceConnectionForCredential(deviceKeys[index]);
    assert.equal(connection.assignment?.matchSessionId, matchIds[index]);
    const completed = await finishStraightOutMatch(
      deviceKeys[index],
      matchIds[index],
      `${suffix}-r${roundNumber}-b${index + 1}`,
    );
    assert.equal(completed.status, "completed");
  }
}

async function run() {
  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const ownerUserId = `fixture-owner-${suffix}`;
  const leagueId = `fixture-league-${suffix}`;
  const seasonId = `fixture-season-${suffix}`;
  const gameNightId = `fixture-night-${suffix}`;

  await createLeagueForUser({
    id: leagueId,
    membershipId: `fixture-membership-${suffix}`,
    userId: ownerUserId,
    name: "Fixture Contract League",
    firstSeason: { id: seasonId, name: "Season One" },
  });

  const leaguePlayerIds: string[] = [];
  for (let index = 0; index < 4; index += 1) {
    const leaguePlayerId = `fixture-league-player-${index}-${suffix}`;
    leaguePlayerIds.push(leaguePlayerId);
    await createLeaguePlayerForUser({
      playerId: `fixture-player-${index}-${suffix}`,
      leaguePlayerId,
      leagueId,
      userId: ownerUserId,
      displayName: `Fixture Player ${index + 1}`,
    });
    await addLeaguePlayerToSeasonForUser({
      rosterEntryId: `fixture-roster-${index}-${suffix}`,
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
    name: "Three Round Fixture Night",
    scheduledAt: Date.now() + 60_000,
    settings: {
      ...DEFAULT_GAME_NIGHT_SETTINGS,
      teamCreationMode: "automatic",
      targetTeamCount: 4,
      minTeamPlayers: 1,
      maxTeamPlayers: 1,
      dummyPlayerMode: "none",
      boardCount: 2,
      boardRotationType: "rotate",
      roundCount: 3,
      pairingStrategy: "random",
      roundAdvanceMode: "manual",
      roundAdvanceDelaySeconds: 0,
      intermissionAfterRounds: [],
      legsPerMatch: 1,
      startingScore: 301,
      finishRule: "straight",
    },
  });

  for (let index = 0; index < leaguePlayerIds.length; index += 1) {
    await updateGameNightAttendanceForUser({
      attendanceId: `fixture-attendance-${index}-${suffix}`,
      gameNightId,
      leaguePlayerId: leaguePlayerIds[index],
      userId: ownerUserId,
      checkedIn: true,
      duesStatus: "paid",
    });
  }

  await prepareGameNightTeamsForUser(gameNightId, ownerUserId);
  let night = await populateGameNightBoardsForUser(gameNightId, ownerUserId);
  assert.equal(night.settings.roundCount, 3, "Round count must persist on the Game Night.");
  assert.equal(night.rounds?.length, 1, "Board population should generate only the first round initially.");
  assert.equal(night.rounds?.[0].status, "draft", "Round 1 must be an editable draft before the Game Night starts.");
  assert.equal(night.rounds?.[0].pairings.length, 2);

  const devices = [] as Array<{ deviceKey: string }>;
  for (let boardNumber = 1; boardNumber <= 2; boardNumber += 1) {
    devices.push(
      await registerBoardDeviceForUser({
        id: `fixture-device-${boardNumber}-${suffix}`,
        leagueId,
        userId: ownerUserId,
        name: `Fixture Board ${boardNumber}`,
        boardNumber,
      }),
    );
  }
  const deviceKeys = devices.map((device) => device.deviceKey);

  for (const deviceKey of deviceKeys) {
    const beforeStart = await getBoardDeviceConnectionForCredential(deviceKey);
    assert.equal(
      beforeStart.assignment?.matchSessionId ?? null,
      null,
      "Draft Round 1 must not be playable on registered boards.",
    );
  }

  night = await setGameNightStatusForUser(gameNightId, ownerUserId, "active");
  assert.equal(night.rounds?.[0].status, "ready");
  await finishCurrentRound(deviceKeys, 1, suffix);

  night = await getGameNightForUser(gameNightId, ownerUserId);
  assert.equal(night.status, "active");
  assert.equal(night.completedRoundCount, 1);
  assert.equal(night.rounds?.length, 2, "Finishing the last board in Round 1 must prepare Round 2 immediately.");
  assert.equal(night.rounds?.[1].status, "draft", "Prepared Round 2 must remain non-playable until round advance.");

  for (const deviceKey of deviceKeys) {
    const waiting = await getBoardDeviceConnectionForCredential(deviceKey);
    assert.equal(
      waiting.assignment?.matchSessionId ?? null,
      null,
      "Synchronous boards must wait while the next round remains a draft.",
    );
  }

  await assert.rejects(
    () => setGameNightStatusForUser(gameNightId, ownerUserId, "completed"),
    /before all 3 configured rounds/,
    "The night cannot finish just because all currently played matches are complete.",
  );

  const round1Pairs = new Set(
    night.rounds![0].pairings.map((pairing) => opponentKey(pairing.teamAId, pairing.teamBId)),
  );
  for (const pairing of night.rounds![1].pairings) {
    assert.equal(
      round1Pairs.has(opponentKey(pairing.teamAId, pairing.teamBId)),
      false,
      "Round 2 should avoid Round 1 opponents when four teams make that possible.",
    );
  }

  // Coordinator edits remain legal while the next round is a draft. Swap the
  // two board assignments while preserving the generated opponent pairings.
  const round2 = night.rounds![1];
  const editedRound2 = round2.pairings.map((pairing, index, all) => ({
    boardId: all[all.length - 1 - index].boardId,
    teamAId: pairing.teamAId,
    teamBId: pairing.teamBId,
  }));
  night = await replaceGameNightRoundFixturesForUser({
    gameNightId,
    roundNumber: 2,
    userId: ownerUserId,
    pairings: editedRound2,
  });
  assert.equal(night.rounds?.[1].status, "draft");
  assert.deepEqual(
    night.rounds?.[1].pairings.map((pairing) => pairing.boardId).sort(),
    editedRound2.map((pairing) => pairing.boardId).sort(),
  );

  night = await startNextGameNightRoundForUser(gameNightId, ownerUserId);
  assert.equal(night.activeRoundNumber, 2);
  assert.equal(night.rounds?.[1].status, "ready");
  await finishCurrentRound(deviceKeys, 2, suffix);

  night = await getGameNightForUser(gameNightId, ownerUserId);
  assert.equal(night.completedRoundCount, 2);
  assert.equal(night.rounds?.[2].status, "draft", "Round 3 must be visible before it is released.");

  const priorPairs = new Set(
    night.rounds!
      .slice(0, 2)
      .flatMap((round) => round.pairings)
      .map((pairing) => opponentKey(pairing.teamAId, pairing.teamBId)),
  );
  for (const pairing of night.rounds![2].pairings) {
    assert.equal(
      priorPairs.has(opponentKey(pairing.teamAId, pairing.teamBId)),
      false,
      "With four teams and three rounds, the final round should complete the unique round-robin opponent set.",
    );
  }

  night = await startNextGameNightRoundForUser(gameNightId, ownerUserId);
  assert.equal(night.activeRoundNumber, 3);
  await finishCurrentRound(deviceKeys, 3, suffix);

  night = await getGameNightForUser(gameNightId, ownerUserId);
  assert.equal(night.completedRoundCount, 3);
  assert.equal(night.rounds?.length, 3, "No fourth round should be prepared after the configured final round.");

  const completed = await setGameNightStatusForUser(gameNightId, ownerUserId, "completed");
  assert.equal(completed.status, "completed");
  assert.equal(completed.completedRoundCount, 3);

  // Automatic mode uses board polling as an idempotent wake-up. A zero-delay
  // second round should become playable on the next registered-board poll.
  const autoNightId = `fixture-auto-night-${suffix}`;
  await createGameNightForUser({
    id: autoNightId,
    leagueId,
    seasonId,
    userId: ownerUserId,
    name: "Automatic Advance Night",
    scheduledAt: Date.now() + 120_000,
    settings: {
      ...DEFAULT_GAME_NIGHT_SETTINGS,
      teamCreationMode: "automatic",
      targetTeamCount: 4,
      minTeamPlayers: 1,
      maxTeamPlayers: 1,
      dummyPlayerMode: "none",
      boardCount: 2,
      roundCount: 2,
      pairingStrategy: "random",
      roundAdvanceMode: "automatic",
      roundAdvanceDelaySeconds: 0,
      intermissionAfterRounds: [],
      legsPerMatch: 1,
      startingScore: 301,
      finishRule: "straight",
    },
  });
  for (let index = 0; index < leaguePlayerIds.length; index += 1) {
    await updateGameNightAttendanceForUser({
      attendanceId: `fixture-auto-attendance-${index}-${suffix}`,
      gameNightId: autoNightId,
      leaguePlayerId: leaguePlayerIds[index],
      userId: ownerUserId,
      checkedIn: true,
      duesStatus: "paid",
    });
  }
  await prepareGameNightTeamsForUser(autoNightId, ownerUserId);
  await populateGameNightBoardsForUser(autoNightId, ownerUserId);
  await setGameNightStatusForUser(autoNightId, ownerUserId, "active");
  await finishCurrentRound(deviceKeys, 1, `auto-${suffix}`);

  const autoPrepared = await getGameNightForUser(autoNightId, ownerUserId);
  assert.equal(autoPrepared.rounds?.[1].status, "draft");
  const autoConnection = await getBoardDeviceConnectionForCredential(deviceKeys[0]);
  assert.equal(autoConnection.assignment?.roundNumber, 2, "A zero-delay automatic round must activate on board polling.");
  assert.ok(autoConnection.assignment?.matchSessionId);

  console.log("Game Night fixture/rotation contract test passed.");
}

run().catch((error) => {
  console.error("Game Night fixture/rotation contract test failed.", error);
  process.exitCode = 1;
});
