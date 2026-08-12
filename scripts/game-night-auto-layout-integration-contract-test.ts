import assert from "node:assert/strict";

import {
  addLeaguePlayerToSeasonForUser,
  createGameNightForUser,
  createLeagueForUser,
  createLeaguePlayerForUser,
  getGameNightForUser,
  prepareGameNightTeamsForUser,
  updateGameNightAttendanceForUser,
} from "@/lib/db";
import { DEFAULT_GAME_NIGHT_SETTINGS } from "@/lib/league/gameNightContracts";

async function run() {
  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const userId = `auto-layout-owner-${suffix}`;
  const leagueId = `auto-layout-league-${suffix}`;
  const seasonId = `auto-layout-season-${suffix}`;

  await createLeagueForUser({
    id: leagueId,
    membershipId: `auto-layout-membership-${suffix}`,
    userId,
    name: "Automatic Layout Contract League",
    firstSeason: { id: seasonId, name: "Season One" },
    now: 1_920_000_000_000,
  });

  const leaguePlayerIds: string[] = [];
  for (let index = 0; index < 10; index += 1) {
    const leaguePlayerId = `auto-layout-league-player-${index}-${suffix}`;
    leaguePlayerIds.push(leaguePlayerId);
    await createLeaguePlayerForUser({
      playerId: `auto-layout-player-${index}-${suffix}`,
      leaguePlayerId,
      leagueId,
      userId,
      displayName: `Auto Player ${index + 1}`,
      now: 1_920_000_000_010 + index,
    });
    await addLeaguePlayerToSeasonForUser({
      rosterEntryId: `auto-layout-roster-${index}-${suffix}`,
      leagueId,
      seasonId,
      leaguePlayerId,
      userId,
      now: 1_920_000_000_030 + index,
    });
  }

  const gameNightId = `auto-layout-night-${suffix}`;
  await createGameNightForUser({
    id: gameNightId,
    leagueId,
    seasonId,
    userId,
    name: "Auto Layout Night",
    scheduledAt: 1_920_100_000_000,
    settings: {
      ...DEFAULT_GAME_NIGHT_SETTINGS,
      teamCreationMode: "automatic",
      teamCountMode: "automatic",
      teamSizeMode: "automatic",
      boardCountMode: "automatic",
      dummyPlayerMode: "none",
    },
    now: 1_920_000_000_100,
  });

  for (let index = 0; index < leaguePlayerIds.length; index += 1) {
    const night = await updateGameNightAttendanceForUser({
      attendanceId: `auto-layout-attendance-${index}-${suffix}`,
      gameNightId,
      leaguePlayerId: leaguePlayerIds[index],
      userId,
      checkedIn: true,
      duesStatus: "paid",
      now: 1_920_000_000_200 + index,
    });
    assert.equal(night.settings.teamCountMode, "automatic");
    assert.equal(night.settings.teamSizeMode, "automatic");
    assert.equal(night.settings.boardCountMode, "automatic");
  }

  let gameNight = await getGameNightForUser(gameNightId, userId);
  assert.equal(
    gameNight.attendance.filter((player) => player.status === "checked_in").length,
    10,
  );
  assert.equal(gameNight.settings.teamCountMode, "automatic");
  assert.equal(gameNight.settings.teamSizeMode, "automatic");
  assert.equal(gameNight.settings.boardCountMode, "automatic");
  assert.equal(gameNight.settings.targetTeamCount, 4);
  assert.equal(gameNight.settings.minTeamPlayers, 2);
  assert.equal(gameNight.settings.maxTeamPlayers, 3);
  assert.equal(gameNight.settings.boardCount, 2);

  gameNight = await prepareGameNightTeamsForUser(gameNightId, userId);
  assert.equal(gameNight.teams.length, 4);
  assert.deepEqual(
    gameNight.teams.map((team) => team.members.length).sort((a, b) => a - b),
    [2, 2, 3, 3],
  );
  assert.equal(
    gameNight.teams.flatMap((team) => team.members).filter((member) => member.isDummy).length,
    0,
  );

  // A late attendance change recalculates the saved Auto layout. Rebuilding
  // teams then consumes that new server-side recommendation rather than stale
  // browser values.
  for (let index = 8; index < 10; index += 1) {
    gameNight = await updateGameNightAttendanceForUser({
      gameNightId,
      leaguePlayerId: leaguePlayerIds[index],
      userId,
      checkedIn: false,
      duesStatus: "paid",
      now: 1_920_000_000_300 + index,
    });
  }
  assert.equal(gameNight.settings.targetTeamCount, 4);
  assert.equal(gameNight.settings.minTeamPlayers, 2);
  assert.equal(gameNight.settings.maxTeamPlayers, 2);
  assert.equal(gameNight.settings.boardCount, 2);

  gameNight = await prepareGameNightTeamsForUser(gameNightId, userId);
  assert.deepEqual(
    gameNight.teams.map((team) => team.members.length).sort((a, b) => a - b),
    [2, 2, 2, 2],
  );

  console.log("Game Night automatic layout repository integration contract test passed.");
}

run().catch((error) => {
  console.error("Game Night automatic layout repository integration contract test failed.", error);
  process.exitCode = 1;
});
