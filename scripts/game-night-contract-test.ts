import assert from "node:assert/strict";

import {
  addLeaguePlayerToSeasonForUser,
  assignGameNightPlayerToTeamForUser,
  createGameNightForUser,
  createLeagueForUser,
  createLeaguePlayerForUser,
  getGameNightForUser,
  LeaguePermissionError,
  populateGameNightBoardsForUser,
  prepareGameNightTeamsForUser,
  setGameNightStatusForUser,
  updateGameNightAttendanceForUser,
} from "@/lib/db";
import { DEFAULT_GAME_NIGHT_SETTINGS } from "@/lib/league/gameNightContracts";

async function run() {
  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const ownerUserId = `night-owner-${suffix}`;
  const outsiderUserId = `night-outsider-${suffix}`;
  const leagueId = `night-league-${suffix}`;
  const seasonId = `night-season-${suffix}`;

  await createLeagueForUser({
    id: leagueId,
    membershipId: `night-membership-${suffix}`,
    userId: ownerUserId,
    name: "Game Night Contract League",
    firstSeason: { id: seasonId, name: "Season One" },
    now: 1_900_000_000_000,
  });

  const leaguePlayerIds: string[] = [];
  for (let index = 0; index < 4; index += 1) {
    const leaguePlayerId = `night-league-player-${index}-${suffix}`;
    leaguePlayerIds.push(leaguePlayerId);
    await createLeaguePlayerForUser({
      playerId: `night-player-${index}-${suffix}`,
      leaguePlayerId,
      leagueId,
      userId: ownerUserId,
      displayName: `Player ${index + 1}`,
      now: 1_900_000_000_010 + index,
    });
    await addLeaguePlayerToSeasonForUser({
      rosterEntryId: `night-roster-${index}-${suffix}`,
      leagueId,
      seasonId,
      leaguePlayerId,
      userId: ownerUserId,
      now: 1_900_000_000_020 + index,
    });
  }

  const gameNightId = `game-night-${suffix}`;
  let gameNight = await createGameNightForUser({
    id: gameNightId,
    leagueId,
    seasonId,
    userId: ownerUserId,
    name: "Tuesday Night",
    scheduledAt: 1_900_100_000_000,
    settings: {
      ...DEFAULT_GAME_NIGHT_SETTINGS,
      teamCreationMode: "hybrid",
      targetTeamCount: 2,
      minTeamPlayers: 2,
      maxTeamPlayers: 3,
      dummyPlayerMode: "none",
      boardCount: 1,
    },
    now: 1_900_000_000_100,
  });
  assert.equal(gameNight.seasonId, seasonId);
  assert.equal(gameNight.boards.length, 1);
  assert.equal(gameNight.attendance.length, 4);

  for (let index = 0; index < leaguePlayerIds.length; index += 1) {
    gameNight = await updateGameNightAttendanceForUser({
      attendanceId: `night-attendance-${index}-${suffix}`,
      gameNightId,
      leaguePlayerId: leaguePlayerIds[index],
      userId: ownerUserId,
      checkedIn: true,
      duesStatus: index === 0 ? "paid" : "unpaid",
      now: 1_900_000_000_200 + index,
    });
  }
  assert.equal(gameNight.attendance.filter((player) => player.status === "checked_in").length, 4);
  assert.equal(gameNight.attendance.find((player) => player.leaguePlayerId === leaguePlayerIds[0])?.duesStatus, "paid");

  gameNight = await prepareGameNightTeamsForUser(gameNightId, ownerUserId);
  assert.equal(gameNight.teams.length, 2);
  assert.deepEqual(gameNight.teams.map((team) => team.members.length).sort(), [2, 2]);

  const sourceTeam = gameNight.teams.find((team) => team.members.some((member) => member.leaguePlayerId === leaguePlayerIds[0]));
  const otherTeam = gameNight.teams.find((team) => team.id !== sourceTeam?.id);
  assert.ok(sourceTeam && otherTeam);
  gameNight = await assignGameNightPlayerToTeamForUser(gameNightId, leaguePlayerIds[0], otherTeam.id, ownerUserId);
  assert.equal(gameNight.teams.find((team) => team.id === otherTeam.id)?.members.length, 3);
  await assert.rejects(
    () => populateGameNightBoardsForUser(gameNightId, ownerUserId),
    /below the minimum team size/,
    "Hybrid manual edits must still obey minimum-team rules before boards are populated.",
  );

  gameNight = await prepareGameNightTeamsForUser(gameNightId, ownerUserId);
  gameNight = await populateGameNightBoardsForUser(gameNightId, ownerUserId);
  assert.equal(gameNight.status, "ready");
  assert.equal(gameNight.pairings.length, 1);

  gameNight = await setGameNightStatusForUser(gameNightId, ownerUserId, "active");
  assert.equal(gameNight.status, "active");

  await assert.rejects(
    () => getGameNightForUser(gameNightId, outsiderUserId),
    (error: unknown) => error instanceof LeaguePermissionError,
    "Non-members must not be able to inspect league game-night data.",
  );

  const dummyNightId = `dummy-night-${suffix}`;
  await createGameNightForUser({
    id: dummyNightId,
    leagueId,
    seasonId,
    userId: ownerUserId,
    name: "Short Night",
    scheduledAt: 1_900_200_000_000,
    settings: {
      ...DEFAULT_GAME_NIGHT_SETTINGS,
      teamCreationMode: "automatic",
      targetTeamCount: 2,
      minTeamPlayers: 2,
      maxTeamPlayers: 3,
      dummyPlayerMode: "fill",
      boardCount: 1,
    },
  });
  for (let index = 0; index < 3; index += 1) {
    await updateGameNightAttendanceForUser({
      gameNightId: dummyNightId,
      leaguePlayerId: leaguePlayerIds[index],
      userId: ownerUserId,
      checkedIn: true,
      duesStatus: "unpaid",
    });
  }
  let dummyNight = await prepareGameNightTeamsForUser(dummyNightId, ownerUserId);
  assert.equal(dummyNight.teams.flatMap((team) => team.members).filter((member) => member.isDummy).length, 1);
  dummyNight = await populateGameNightBoardsForUser(dummyNightId, ownerUserId);
  assert.equal(dummyNight.pairings.length, 1);

  console.log("Game-night framework contract test passed.");
}

run().catch((error) => {
  console.error("Game-night framework contract test failed.", error);
  process.exitCode = 1;
});
