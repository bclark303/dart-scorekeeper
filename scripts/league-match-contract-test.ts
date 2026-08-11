import assert from "node:assert/strict";

import {
  addLeaguePlayerToSeasonForUser,
  createGameNightForUser,
  createLeagueForUser,
  createLeaguePlayerForUser,
  getGameNightForUser,
  getLeagueMatchForUser,
  populateGameNightBoardsForUser,
  prepareGameNightTeamsForUser,
  setGameNightStatusForUser,
  startLeagueMatchForUser,
  submitLeagueMatchTurnForUser,
  undoLastLeagueMatchTurnForUser,
  updateGameNightAttendanceForUser,
} from "@/lib/db";
import { DEFAULT_GAME_NIGHT_SETTINGS } from "@/lib/league/gameNightContracts";

async function run() {
  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const ownerUserId = `match-owner-${suffix}`;
  const outsiderUserId = `match-outsider-${suffix}`;
  const leagueId = `match-league-${suffix}`;
  const seasonId = `match-season-${suffix}`;

  await createLeagueForUser({
    id: leagueId,
    membershipId: `match-owner-membership-${suffix}`,
    userId: ownerUserId,
    name: "Central Match Contract League",
    firstSeason: { id: seasonId, name: "Season One" },
  });

  const leaguePlayerIds: string[] = [];
  for (let index = 0; index < 4; index += 1) {
    const leaguePlayerId = `match-league-player-${index}-${suffix}`;
    leaguePlayerIds.push(leaguePlayerId);
    await createLeaguePlayerForUser({
      playerId: `match-player-${index}-${suffix}`,
      leaguePlayerId,
      leagueId,
      userId: ownerUserId,
      displayName: `Match Player ${index + 1}`,
    });
    await addLeaguePlayerToSeasonForUser({
      rosterEntryId: `match-roster-${index}-${suffix}`,
      leagueId,
      seasonId,
      leaguePlayerId,
      userId: ownerUserId,
    });
  }

  const gameNightId = `match-night-${suffix}`;
  await createGameNightForUser({
    id: gameNightId,
    leagueId,
    seasonId,
    userId: ownerUserId,
    name: "Central Score Night",
    scheduledAt: Date.now() + 60_000,
    settings: {
      ...DEFAULT_GAME_NIGHT_SETTINGS,
      teamCreationMode: "automatic",
      targetTeamCount: 2,
      minTeamPlayers: 2,
      maxTeamPlayers: 2,
      dummyPlayerMode: "none",
      dummyScore: 45,
      boardCount: 1,
      startingScore: 301,
      finishRule: "double",
      legsPerMatch: 1,
    },
  });

  for (let index = 0; index < leaguePlayerIds.length; index += 1) {
    await updateGameNightAttendanceForUser({
      attendanceId: `match-attendance-${index}-${suffix}`,
      gameNightId,
      leaguePlayerId: leaguePlayerIds[index],
      userId: ownerUserId,
      checkedIn: true,
      duesStatus: "paid",
    });
  }

  await prepareGameNightTeamsForUser(gameNightId, ownerUserId);
  let gameNight = await populateGameNightBoardsForUser(gameNightId, ownerUserId);
  assert.equal(gameNight.pairings.length, 1);
  assert.ok(gameNight.pairings[0].matchSessionId, "Board population must create a central match session.");
  assert.equal(gameNight.pairings[0].matchStatus, "scheduled");

  const matchId = gameNight.pairings[0].matchSessionId!;
  let match = await getLeagueMatchForUser(matchId, ownerUserId);
  assert.equal(match.status, "scheduled");
  assert.equal(match.startingScore, 301);
  assert.equal(match.dummyScore, 45);
  assert.equal(match.teamA.members.length, 2);
  assert.equal(match.teamB.members.length, 2);

  await assert.rejects(
    () => getLeagueMatchForUser(matchId, outsiderUserId),
    /membership is required/,
    "Non-members must not be able to inspect a board match.",
  );

  await assert.rejects(
    () => startLeagueMatchForUser(matchId, ownerUserId),
    /Start the game night/,
    "A board match cannot start before the overall game night.",
  );

  gameNight = await setGameNightStatusForUser(gameNightId, ownerUserId, "active");
  assert.equal(gameNight.status, "active");
  match = await startLeagueMatchForUser(matchId, ownerUserId);
  assert.equal(match.status, "active");
  assert.equal(match.currentTeamId, match.teamA.id);

  const turnOneId = `central-turn-1-${suffix}`;
  match = await submitLeagueMatchTurnForUser({
    matchId,
    userId: ownerUserId,
    turnId: turnOneId,
    scoreEntered: 180,
    dartsThrown: 3,
  });
  assert.equal(match.turns.length, 1);
  assert.equal(match.teamA.score, 121);
  assert.equal(match.currentTeamId, match.teamB.id);

  const idempotentRetry = await submitLeagueMatchTurnForUser({
    matchId,
    userId: ownerUserId,
    turnId: turnOneId,
    scoreEntered: 180,
    dartsThrown: 3,
  });
  assert.equal(idempotentRetry.turns.length, 1, "Retrying a turn ID must not duplicate the turn.");

  match = await submitLeagueMatchTurnForUser({
    matchId,
    userId: ownerUserId,
    turnId: `central-turn-2-${suffix}`,
    scoreEntered: 0,
    dartsThrown: 3,
  });
  assert.equal(match.currentTeamId, match.teamA.id);

  match = await submitLeagueMatchTurnForUser({
    matchId,
    userId: ownerUserId,
    turnId: `central-turn-bust-${suffix}`,
    scoreEntered: 121,
    dartsThrown: 3,
    checkoutConfirmed: false,
  });
  assert.equal(match.status, "active");
  assert.equal(match.teamA.score, 121, "Unconfirmed double-out zero must be recorded as a bust.");
  assert.equal(match.turns[0].isBust, true);
  assert.equal(match.currentTeamId, match.teamB.id);

  match = await submitLeagueMatchTurnForUser({
    matchId,
    userId: ownerUserId,
    turnId: `central-turn-3-${suffix}`,
    scoreEntered: 0,
    dartsThrown: 3,
  });
  assert.equal(match.currentTeamId, match.teamA.id);

  match = await submitLeagueMatchTurnForUser({
    matchId,
    userId: ownerUserId,
    turnId: `central-turn-checkout-${suffix}`,
    scoreEntered: 121,
    dartsThrown: 3,
    checkoutConfirmed: true,
  });
  assert.equal(match.status, "completed");
  assert.equal(match.teamA.legsWon, 1);
  assert.equal(match.winnerTeamId, match.teamA.id);

  gameNight = await getGameNightForUser(gameNightId, ownerUserId);
  assert.equal(gameNight.pairings[0].matchStatus, "completed");
  assert.equal(gameNight.pairings[0].winnerTeamId, match.teamA.id);

  match = await undoLastLeagueMatchTurnForUser(matchId, ownerUserId);
  assert.equal(match.status, "active", "Undoing the deciding turn must reopen the match.");
  assert.equal(match.teamA.score, 121);
  assert.equal(match.teamA.legsWon, 0);
  assert.equal(match.currentTeamId, match.teamA.id);

  match = await submitLeagueMatchTurnForUser({
    matchId,
    userId: ownerUserId,
    turnId: `central-turn-checkout-retry-${suffix}`,
    scoreEntered: 121,
    dartsThrown: 3,
    checkoutConfirmed: true,
  });
  assert.equal(match.status, "completed");
  assert.equal(match.winnerTeamId, match.teamA.id);

  console.log("Central league match contract test passed.");
}

run().catch((error) => {
  console.error("Central league match contract test failed.", error);
  process.exitCode = 1;
});
