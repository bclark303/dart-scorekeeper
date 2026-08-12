import assert from "node:assert/strict";

import {
  addLeaguePlayerToSeasonForUser,
  createGameNightForUser,
  createLeagueForUser,
  createLeaguePlayerForUser,
  populateGameNightBoardsForUser,
  prepareGameNightTeamsForUser,
  setGameNightStatusForUser,
  startLeagueMatchForUser,
  submitLeagueMatchTurnForUser,
  updateGameNightAttendanceForUser,
} from "@/lib/db";
import { DEFAULT_GAME_NIGHT_SETTINGS } from "@/lib/league/gameNightContracts";

async function createNight(input: {
  suffix: string;
  label: string;
  leagueId: string;
  seasonId: string;
  ownerUserId: string;
  leaguePlayerIds: string[];
  dummyScore: number;
  startingScore: number;
  legsPerMatch: number;
}) {
  const gameNightId = `${input.label}-night-${input.suffix}`;
  await createGameNightForUser({
    id: gameNightId,
    leagueId: input.leagueId,
    seasonId: input.seasonId,
    userId: input.ownerUserId,
    name: `${input.label} Dummy Night`,
    scheduledAt: Date.now() + 60_000,
    settings: {
      ...DEFAULT_GAME_NIGHT_SETTINGS,
      teamCreationMode: "automatic",
      targetTeamCount: 2,
      minTeamPlayers: 2,
      maxTeamPlayers: 2,
      dummyPlayerMode: "fill",
      dummyScore: input.dummyScore,
      boardCount: 1,
      startingScore: input.startingScore,
      finishRule: "straight",
      legsPerMatch: input.legsPerMatch,
    },
  });

  for (let index = 0; index < input.leaguePlayerIds.length; index += 1) {
    await updateGameNightAttendanceForUser({
      attendanceId: `${input.label}-attendance-${index}-${input.suffix}`,
      gameNightId,
      leaguePlayerId: input.leaguePlayerIds[index],
      userId: input.ownerUserId,
      checkedIn: true,
      duesStatus: "paid",
    });
  }

  await prepareGameNightTeamsForUser(gameNightId, input.ownerUserId);
  const populated = await populateGameNightBoardsForUser(
    gameNightId,
    input.ownerUserId,
  );
  const matchId = populated.pairings[0]?.matchSessionId;
  assert.ok(matchId, "Populating the board must create a match session.");

  await setGameNightStatusForUser(gameNightId, input.ownerUserId, "active");
  const match = await startLeagueMatchForUser(matchId, input.ownerUserId);
  assert.equal(match.teamA.members.length, 2);
  assert.equal(match.teamB.members.length, 2);
  assert.equal(match.teamA.members[1].isDummy, true);
  assert.equal(match.teamB.members[1].isDummy, true);

  return { gameNightId, matchId, match };
}

async function run() {
  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const ownerUserId = `dummy-owner-${suffix}`;
  const leagueId = `dummy-league-${suffix}`;
  const seasonId = `dummy-season-${suffix}`;

  await createLeagueForUser({
    id: leagueId,
    membershipId: `dummy-owner-membership-${suffix}`,
    userId: ownerUserId,
    name: "Dummy Scoring Contract League",
    firstSeason: { id: seasonId, name: "Season One" },
  });

  const leaguePlayerIds: string[] = [];
  for (let index = 0; index < 2; index += 1) {
    const leaguePlayerId = `dummy-league-player-${index}-${suffix}`;
    leaguePlayerIds.push(leaguePlayerId);
    await createLeaguePlayerForUser({
      playerId: `dummy-player-${index}-${suffix}`,
      leaguePlayerId,
      leagueId,
      userId: ownerUserId,
      displayName: `Dummy Test Player ${index + 1}`,
    });
    await addLeaguePlayerToSeasonForUser({
      rosterEntryId: `dummy-roster-${index}-${suffix}`,
      leagueId,
      seasonId,
      leaguePlayerId,
      userId: ownerUserId,
    });
  }

  // Half-actual mode: 0 is the backwards-compatible rule selector.
  const half = await createNight({
    suffix,
    label: "half",
    leagueId,
    seasonId,
    ownerUserId,
    leaguePlayerIds,
    dummyScore: 0,
    startingScore: 40,
    legsPerMatch: 3,
  });
  assert.equal(half.match.dummyScore, 0);

  let match = await submitLeagueMatchTurnForUser({
    matchId: half.matchId,
    userId: ownerUserId,
    turnId: `half-a-real-${suffix}`,
    scoreEntered: 20,
    dartsThrown: 1,
    darts: [
      {
        id: `half-a-dart-${suffix}`,
        segment: 20,
        multiplier: 1,
        score: 20,
      },
    ],
  });
  assert.equal(match.teamA.score, 20);

  match = await submitLeagueMatchTurnForUser({
    matchId: half.matchId,
    userId: ownerUserId,
    turnId: `half-b-real-${suffix}`,
    scoreEntered: 0,
    dartsThrown: 3,
  });

  // Client lies and submits 180/3. The repository must replace it with half
  // of the real partner's single S20: 10 points in one synthetic dart.
  match = await submitLeagueMatchTurnForUser({
    matchId: half.matchId,
    userId: ownerUserId,
    turnId: `half-a-dummy-${suffix}`,
    scoreEntered: 180,
    dartsThrown: 3,
  });
  assert.equal(match.turns[0].isDummy, true);
  assert.equal(match.turns[0].scoreEntered, 10);
  assert.equal(match.turns[0].dartsThrown, 1);
  assert.equal(match.turns[0].darts.length, 0);
  assert.equal(match.teamA.score, 10);

  match = await submitLeagueMatchTurnForUser({
    matchId: half.matchId,
    userId: ownerUserId,
    turnId: `half-b-dummy-${suffix}`,
    scoreEntered: 180,
    dartsThrown: 1,
  });
  assert.equal(match.turns[0].scoreEntered, 0);
  assert.equal(match.turns[0].dartsThrown, 3);

  // Team A's real player checks out leg 1. Leg 2 starts with Team B's dummy
  // because member starting positions rotate by leg. That dummy must NOT reuse
  // Team B's real-player turn from leg 1.
  match = await submitLeagueMatchTurnForUser({
    matchId: half.matchId,
    userId: ownerUserId,
    turnId: `half-a-checkout-${suffix}`,
    scoreEntered: 10,
    dartsThrown: 1,
  });
  assert.equal(match.currentLegNumber, 2);
  assert.equal(match.currentTeamId, match.teamB.id);
  assert.equal(
    match.teamB.members.find((member) => member.id === match.currentMemberId)?.isDummy,
    true,
  );

  match = await submitLeagueMatchTurnForUser({
    matchId: half.matchId,
    userId: ownerUserId,
    turnId: `half-new-leg-dummy-${suffix}`,
    scoreEntered: 180,
    dartsThrown: 3,
  });
  assert.equal(match.turns[0].legNumber, 2);
  assert.equal(
    match.turns[0].scoreEntered,
    0,
    "A dummy starting a new leg must not inherit a partner turn from the previous leg.",
  );

  // Fixed mode: any positive dummyScore is the fixed per-turn value.
  const fixed = await createNight({
    suffix,
    label: "fixed",
    leagueId,
    seasonId,
    ownerUserId,
    leaguePlayerIds,
    dummyScore: 45,
    startingScore: 301,
    legsPerMatch: 1,
  });
  assert.equal(fixed.match.dummyScore, 45);

  await submitLeagueMatchTurnForUser({
    matchId: fixed.matchId,
    userId: ownerUserId,
    turnId: `fixed-a-real-${suffix}`,
    scoreEntered: 20,
    dartsThrown: 1,
  });
  await submitLeagueMatchTurnForUser({
    matchId: fixed.matchId,
    userId: ownerUserId,
    turnId: `fixed-b-real-${suffix}`,
    scoreEntered: 0,
    dartsThrown: 3,
  });

  match = await submitLeagueMatchTurnForUser({
    matchId: fixed.matchId,
    userId: ownerUserId,
    turnId: `fixed-a-dummy-${suffix}`,
    scoreEntered: 180,
    dartsThrown: 1,
    darts: [
      {
        id: `fixed-bogus-dart-${suffix}`,
        segment: 20,
        multiplier: 3,
        score: 60,
      },
    ],
  });
  assert.equal(match.turns[0].isDummy, true);
  assert.equal(
    match.turns[0].scoreEntered,
    45,
    "The server must enforce the configured fixed dummy score regardless of client input.",
  );
  assert.equal(match.turns[0].dartsThrown, 3);
  assert.equal(
    match.turns[0].darts.length,
    0,
    "Synthetic dummy turns must not persist fake graphical dart history.",
  );

  console.log("Authoritative dummy scoring integration contract test passed.");
}

run().catch((error) => {
  console.error("Authoritative dummy scoring integration contract test failed.", error);
  process.exitCode = 1;
});
