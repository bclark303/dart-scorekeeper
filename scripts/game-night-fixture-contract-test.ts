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
  setGameNightTeamStatusForUser,
  startBoardDeviceMatchForCredential,
  startNextGameNightRoundForUser,
  submitBoardDeviceTurnForCredential,
  undoBoardDeviceTurnForCredential,
  undoLastLeagueMatchTurnForUser,
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

type ActiveBoardMatch = {
  deviceKey: string;
  matchId: string;
};

async function finishCurrentRound(
  deviceKeys: string[],
  roundNumber: number,
  suffix: string,
): Promise<ActiveBoardMatch[]> {
  const assignments: ActiveBoardMatch[] = [];
  for (const deviceKey of deviceKeys) {
    const connection = await getBoardDeviceConnectionForCredential(deviceKey);
    if (!connection.assignment?.matchSessionId) continue;
    assert.equal(connection.assignment.roundNumber, roundNumber);
    const matchId = connection.assignment.matchSessionId;
    assignments.push({ deviceKey, matchId });
    if (connection.match?.status === "scheduled") {
      await startBoardDeviceMatchForCredential(deviceKey, matchId);
    }
  }

  assert.ok(
    assignments.length > 0,
    `Round ${roundNumber} must have at least one playable board match.`,
  );
  for (let index = 0; index < assignments.length; index += 1) {
    const assignment = assignments[index];
    const completed = await finishStraightOutMatch(
      assignment.deviceKey,
      assignment.matchId,
      `${suffix}-r${roundNumber}-b${index + 1}`,
    );
    assert.equal(completed.status, "completed");
  }
  return assignments;
}

async function checkInPlayers(input: {
  gameNightId: string;
  leaguePlayerIds: string[];
  ownerUserId: string;
  suffix: string;
}) {
  for (let index = 0; index < input.leaguePlayerIds.length; index += 1) {
    await updateGameNightAttendanceForUser({
      attendanceId: `${input.gameNightId}-attendance-${index}-${input.suffix}`,
      gameNightId: input.gameNightId,
      leaguePlayerId: input.leaguePlayerIds[index],
      userId: input.ownerUserId,
      checkedIn: true,
      duesStatus: "paid",
    });
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

  await checkInPlayers({
    gameNightId,
    leaguePlayerIds,
    ownerUserId,
    suffix,
  });

  await prepareGameNightTeamsForUser(gameNightId, ownerUserId);
  let night = await populateGameNightBoardsForUser(gameNightId, ownerUserId);
  assert.equal(
    night.settings.roundCount,
    3,
    "Round count must persist on the Game Night.",
  );
  assert.equal(
    night.rounds?.length,
    1,
    "Board population should generate only the first round initially.",
  );
  assert.equal(
    night.rounds?.[0].status,
    "draft",
    "Round 1 must be an editable draft before the Game Night starts.",
  );
  assert.equal(night.rounds?.[0].pairings.length, 2);

  const devices: Array<{ deviceKey: string }> = [];
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

  await assert.rejects(
    () =>
      updateGameNightAttendanceForUser({
        gameNightId,
        leaguePlayerId: leaguePlayerIds[0],
        userId: ownerUserId,
        checkedIn: false,
        duesStatus: "paid",
      }),
    /locked after play starts/,
    "Attendance/team structure must lock after the Game Night starts.",
  );

  const round1Assignments = await finishCurrentRound(deviceKeys, 1, suffix);

  night = await getGameNightForUser(gameNightId, ownerUserId);
  assert.equal(night.status, "active");
  assert.equal(night.completedRoundCount, 1);
  assert.equal(
    night.rounds?.length,
    2,
    "Finishing the last board in Round 1 must prepare Round 2 immediately.",
  );
  assert.equal(
    night.rounds?.[1].status,
    "draft",
    "Prepared Round 2 must remain non-playable until round advance.",
  );

  for (const deviceKey of deviceKeys) {
    const waiting = await getBoardDeviceConnectionForCredential(deviceKey);
    assert.equal(waiting.assignment?.roundNumber, 1);
    assert.equal(
      waiting.match?.status,
      "completed",
      "A completed Round 1 match remains attached to its board for review/Undo until Round 2 starts.",
    );
  }

  await assert.rejects(
    () => setGameNightStatusForUser(gameNightId, ownerUserId, "completed"),
    /before all 3 configured rounds/,
    "The night cannot finish just because all currently played matches are complete.",
  );

  // Reopen one just-finished match. The generated next-round draft must be
  // discarded because its result history is now stale.
  await undoBoardDeviceTurnForCredential(
    round1Assignments[0].deviceKey,
    round1Assignments[0].matchId,
  );
  night = await getGameNightForUser(gameNightId, ownerUserId);
  assert.equal(night.rounds?.length, 1);
  assert.equal(night.completedRoundCount, 0);
  assert.equal(night.rounds?.[0].status, "active");

  await submitBoardDeviceTurnForCredential({
    deviceKey: round1Assignments[0].deviceKey,
    matchId: round1Assignments[0].matchId,
    turnId: `fixture-round1-redo-${suffix}`,
    scoreEntered: 121,
    dartsThrown: 3,
  });
  night = await getGameNightForUser(gameNightId, ownerUserId);
  assert.equal(night.completedRoundCount, 1);
  assert.equal(
    night.rounds?.[1].status,
    "draft",
    "Correcting the reopened result must regenerate a fresh next-round draft.",
  );

  const round1Pairs = new Set(
    night.rounds![0].pairings.map((pairing) =>
      opponentKey(pairing.teamAId, pairing.teamBId),
    ),
  );
  for (const pairing of night.rounds![1].pairings) {
    assert.equal(
      round1Pairs.has(opponentKey(pairing.teamAId, pairing.teamBId)),
      false,
      "Round 2 should avoid Round 1 opponents when four teams make that possible.",
    );
  }

  const withdrawnTeamId = night.rounds![1].pairings[0].teamAId;
  night = await setGameNightTeamStatusForUser(
    gameNightId,
    withdrawnTeamId,
    "withdrawn",
    ownerUserId,
  );
  assert.equal(night.rounds?.[1].pairings.length, 1);
  assert.equal(night.rounds?.[1].byeTeamIds.length, 1);
  assert.equal(
    night.rounds?.[1].pairings.some(
      (pairing) =>
        pairing.teamAId === withdrawnTeamId || pairing.teamBId === withdrawnTeamId,
    ),
    false,
    "A withdrawn team must disappear from future draft fixtures.",
  );
  night = await setGameNightTeamStatusForUser(
    gameNightId,
    withdrawnTeamId,
    "active",
    ownerUserId,
  );
  assert.equal(night.rounds?.[1].pairings.length, 2);
  assert.equal(night.rounds?.[1].byeTeamIds.length, 0);

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

  await assert.rejects(
    () => undoLastLeagueMatchTurnForUser(round1Assignments[0].matchId, ownerUserId),
    /cannot be reopened after the next round has started/,
    "Once Round 2 starts, a completed Round 1 result is locked against Undo.",
  );

  await finishCurrentRound(deviceKeys, 2, suffix);

  night = await getGameNightForUser(gameNightId, ownerUserId);
  assert.equal(night.completedRoundCount, 2);
  assert.equal(
    night.rounds?.[2].status,
    "draft",
    "Round 3 must be visible before it is released.",
  );

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
  assert.equal(
    night.rounds?.length,
    3,
    "No fourth round should be prepared after the configured final round.",
  );

  const completed = await setGameNightStatusForUser(
    gameNightId,
    ownerUserId,
    "completed",
  );
  assert.equal(completed.status, "completed");
  assert.equal(completed.completedRoundCount, 3);

  // Automatic mode uses board/coordinator polling as an idempotent wake-up. A
  // zero-delay second round should become playable on the next poll.
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
  await checkInPlayers({
    gameNightId: autoNightId,
    leaguePlayerIds,
    ownerUserId,
    suffix,
  });
  await prepareGameNightTeamsForUser(autoNightId, ownerUserId);
  await populateGameNightBoardsForUser(autoNightId, ownerUserId);
  await setGameNightStatusForUser(autoNightId, ownerUserId, "active");
  await finishCurrentRound(deviceKeys, 1, `auto-${suffix}`);

  const autoPrepared = await getGameNightForUser(autoNightId, ownerUserId);
  assert.equal(autoPrepared.rounds?.[1].status, "draft");
  const autoConnection = await getBoardDeviceConnectionForCredential(
    deviceKeys[0],
  );
  assert.equal(
    autoConnection.assignment?.roundNumber,
    2,
    "A zero-delay automatic round must activate on board polling.",
  );
  assert.ok(autoConnection.assignment?.matchSessionId);
  await finishCurrentRound(deviceKeys, 2, `auto-${suffix}`);
  await setGameNightStatusForUser(autoNightId, ownerUserId, "completed");

  // A scheduled intermission overrides the ordinary automatic delay. Board
  // polling must keep showing the completed prior round until the break ends,
  // while the coordinator retains an explicit early-end path.
  const breakNightId = `fixture-break-night-${suffix}`;
  await createGameNightForUser({
    id: breakNightId,
    leagueId,
    seasonId,
    userId: ownerUserId,
    name: "Intermission Night",
    scheduledAt: Date.now() + 180_000,
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
      intermissionAfterRounds: [1],
      intermissionDurationMinutes: 10,
      legsPerMatch: 1,
      startingScore: 301,
      finishRule: "straight",
    },
  });
  await checkInPlayers({
    gameNightId: breakNightId,
    leaguePlayerIds,
    ownerUserId,
    suffix,
  });
  await prepareGameNightTeamsForUser(breakNightId, ownerUserId);
  await populateGameNightBoardsForUser(breakNightId, ownerUserId);
  await setGameNightStatusForUser(breakNightId, ownerUserId, "active");
  await finishCurrentRound(deviceKeys, 1, `break-${suffix}`);

  const duringBreak = await getGameNightForUser(breakNightId, ownerUserId);
  assert.equal(duringBreak.rounds?.[0].status, "intermission");
  assert.equal(duringBreak.rounds?.[1].status, "draft");
  const breakConnection = await getBoardDeviceConnectionForCredential(
    deviceKeys[0],
  );
  assert.equal(
    breakConnection.assignment?.roundNumber,
    1,
    "Board polling must not auto-release the next round during an active intermission.",
  );
  assert.equal(breakConnection.match?.status, "completed");

  await assert.rejects(
    () => startNextGameNightRoundForUser(breakNightId, ownerUserId),
    /intermission is still active/,
  );
  const endedEarly = await startNextGameNightRoundForUser(
    breakNightId,
    ownerUserId,
    { endIntermissionEarly: true },
  );
  assert.equal(endedEarly.activeRoundNumber, 2);
  assert.equal(endedEarly.rounds?.[1].status, "ready");
  await finishCurrentRound(deviceKeys, 2, `break-${suffix}`);
  await setGameNightStatusForUser(breakNightId, ownerUserId, "completed");

  console.log("Game Night fixture/rotation contract test passed.");
}

run().catch((error) => {
  console.error("Game Night fixture/rotation contract test failed.", error);
  process.exitCode = 1;
});
