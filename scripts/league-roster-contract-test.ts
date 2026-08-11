import assert from "node:assert/strict";

import {
  addLeaguePlayerToSeasonForUser,
  createLeagueForUser,
  createLeaguePlayerForUser,
  LeaguePermissionError,
  listLeaguePlayersForUser,
  removeLeaguePlayerFromSeasonForUser,
} from "@/lib/db";

async function run() {
  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const ownerUserId = `roster-owner-${suffix}`;
  const outsiderUserId = `roster-outsider-${suffix}`;
  const leagueId = `roster-league-${suffix}`;
  const seasonId = `roster-season-${suffix}`;
  const leaguePlayerId = `league-player-${suffix}`;

  await createLeagueForUser({
    id: leagueId,
    membershipId: `roster-membership-${suffix}`,
    userId: ownerUserId,
    name: "Roster Contract League",
    firstSeason: { id: seasonId, name: "Roster Season" },
    now: 1_800_000_010_000,
  });

  const created = await createLeaguePlayerForUser({
    playerId: `player-${suffix}`,
    leaguePlayerId,
    leagueId,
    userId: ownerUserId,
    displayName: "Persistent Player",
    now: 1_800_000_010_100,
  });
  assert.equal(created.displayName, "Persistent Player");
  assert.deepEqual(created.seasonIds, []);

  const listed = await listLeaguePlayersForUser(leagueId, ownerUserId);
  assert.equal(listed.some((player) => player.id === leaguePlayerId), true);

  const enrolled = await addLeaguePlayerToSeasonForUser({
    rosterEntryId: `roster-entry-${suffix}`,
    leagueId,
    seasonId,
    leaguePlayerId,
    userId: ownerUserId,
    now: 1_800_000_010_200,
  });
  assert.deepEqual(enrolled.seasonIds, [seasonId]);

  const withdrawn = await removeLeaguePlayerFromSeasonForUser({
    leagueId,
    seasonId,
    leaguePlayerId,
    userId: ownerUserId,
    now: 1_800_000_010_300,
  });
  assert.deepEqual(withdrawn.seasonIds, []);

  const reEnrolled = await addLeaguePlayerToSeasonForUser({
    rosterEntryId: `ignored-on-reactivation-${suffix}`,
    leagueId,
    seasonId,
    leaguePlayerId,
    userId: ownerUserId,
    now: 1_800_000_010_400,
  });
  assert.deepEqual(reEnrolled.seasonIds, [seasonId]);

  await assert.rejects(
    () => listLeaguePlayersForUser(leagueId, outsiderUserId),
    (error: unknown) => error instanceof LeaguePermissionError,
    "A non-member must not be able to list league players.",
  );

  await assert.rejects(
    () =>
      createLeaguePlayerForUser({
        playerId: `denied-player-${suffix}`,
        leaguePlayerId: `denied-league-player-${suffix}`,
        leagueId,
        userId: outsiderUserId,
        displayName: "Denied Player",
      }),
    (error: unknown) => error instanceof LeaguePermissionError,
    "A non-member must not be able to create league players.",
  );

  console.log("League roster contract test passed.");
}

run().catch((error) => {
  console.error("League roster contract test failed.", error);
  process.exitCode = 1;
});
