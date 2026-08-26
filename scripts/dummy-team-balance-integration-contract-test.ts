import assert from "node:assert/strict";

import {
  addLeaguePlayerToSeasonForUser,
  createGameNightForUser,
  createLeagueForUser,
  createLeaguePlayerForUser,
  prepareGameNightTeamsForUser,
  updateGameNightAttendanceForUser,
} from "@/lib/db";
import { DEFAULT_GAME_NIGHT_SETTINGS } from "@/lib/league/gameNightContracts";

async function run() {
  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const userId = `dummy-balance-owner-${suffix}`;
  const leagueId = `dummy-balance-league-${suffix}`;
  const seasonId = `dummy-balance-season-${suffix}`;

  await createLeagueForUser({
    id: leagueId,
    membershipId: `dummy-balance-membership-${suffix}`,
    userId,
    name: "Dummy Balance Contract League",
    firstSeason: { id: seasonId, name: "Season One" },
    now: 1_930_000_000_000,
  });

  const leaguePlayerIds: string[] = [];
  for (let index = 0; index < 10; index += 1) {
    const leaguePlayerId = `dummy-balance-league-player-${index}-${suffix}`;
    leaguePlayerIds.push(leaguePlayerId);
    await createLeaguePlayerForUser({
      playerId: `dummy-balance-player-${index}-${suffix}`,
      leaguePlayerId,
      leagueId,
      userId,
      displayName: `Balance Player ${index + 1}`,
      now: 1_930_000_000_010 + index,
    });
    await addLeaguePlayerToSeasonForUser({
      rosterEntryId: `dummy-balance-roster-${index}-${suffix}`,
      leagueId,
      seasonId,
      leaguePlayerId,
      userId,
      now: 1_930_000_000_030 + index,
    });
  }

  const gameNightId = `dummy-balance-night-${suffix}`;
  await createGameNightForUser({
    id: gameNightId,
    leagueId,
    seasonId,
    userId,
    name: "Balanced Dummy Night",
    scheduledAt: 1_930_100_000_000,
    settings: {
      ...DEFAULT_GAME_NIGHT_SETTINGS,
      teamCreationMode: "automatic",
      targetTeamCount: 4,
      minTeamPlayers: 2,
      maxTeamPlayers: 4,
      dummyPlayerMode: "balance",
      boardCount: 2,
    },
    now: 1_930_000_000_100,
  });

  for (let index = 0; index < leaguePlayerIds.length; index += 1) {
    await updateGameNightAttendanceForUser({
      attendanceId: `dummy-balance-attendance-${index}-${suffix}`,
      gameNightId,
      leaguePlayerId: leaguePlayerIds[index],
      userId,
      checkedIn: true,
      duesStatus: "paid",
      now: 1_930_000_000_200 + index,
    });
  }

  const gameNight = await prepareGameNightTeamsForUser(gameNightId, userId);
  assert.equal(gameNight.settings.dummyPlayerMode, "balance");
  assert.equal(gameNight.teams.length, 4);
  assert.deepEqual(
    gameNight.teams.map((team) => team.members.length).sort((a, b) => a - b),
    [3, 3, 3, 3],
  );
  assert.equal(
    gameNight.teams
      .flatMap((team) => team.members)
      .filter((member) => member.isDummy).length,
    2,
  );

  console.log("Dummy team balance repository integration contract test passed.");
}

run().catch((error) => {
  console.error("Dummy team balance repository integration contract test failed.", error);
  process.exitCode = 1;
});
