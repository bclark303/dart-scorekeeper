import assert from "node:assert/strict";

import {
  createLeagueForUser,
  createSeasonForUser,
  LeaguePermissionError,
  listLeaguesForUser,
} from "@/lib/db";

async function run() {
  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const ownerUserId = `league-owner-${suffix}`;
  const outsiderUserId = `league-outsider-${suffix}`;
  const leagueId = `league-${suffix}`;
  const firstSeasonId = `season-first-${suffix}`;

  const created = await createLeagueForUser({
    id: leagueId,
    membershipId: `membership-${suffix}`,
    userId: ownerUserId,
    name: "Contract Test League",
    firstSeason: {
      id: firstSeasonId,
      name: "Season One",
    },
    now: 1_800_000_000_000,
  });

  assert.equal(created.membershipRole, "owner");
  assert.equal(created.status, "active");
  assert.equal(created.seasons.length, 1);
  assert.equal(created.seasons[0]?.status, "draft");

  const ownerLeagues = await listLeaguesForUser(ownerUserId);
  const ownerLeague = ownerLeagues.find((league) => league.id === leagueId);
  assert.ok(ownerLeague, "League owner should be able to list the created league.");
  assert.equal(ownerLeague.membershipRole, "owner");
  assert.equal(ownerLeague.seasons[0]?.name, "Season One");

  const secondSeason = await createSeasonForUser({
    id: `season-second-${suffix}`,
    leagueId,
    userId: ownerUserId,
    name: "Season Two",
    now: 1_800_000_000_100,
  });
  assert.equal(secondSeason.status, "draft");

  const refreshed = await listLeaguesForUser(ownerUserId);
  const refreshedLeague = refreshed.find((league) => league.id === leagueId);
  assert.equal(refreshedLeague?.seasons.length, 2);

  const outsiderLeagues = await listLeaguesForUser(outsiderUserId);
  assert.equal(
    outsiderLeagues.some((league) => league.id === leagueId),
    false,
    "Non-members must not be able to discover the league through their list.",
  );

  await assert.rejects(
    () =>
      createSeasonForUser({
        id: `season-denied-${suffix}`,
        leagueId,
        userId: outsiderUserId,
        name: "Unauthorized Season",
      }),
    (error: unknown) => error instanceof LeaguePermissionError,
    "A non-member must not be able to create a season.",
  );

  console.log("League framework contract test passed.");
}

run().catch((error) => {
  console.error("League framework contract test failed.", error);
  process.exitCode = 1;
});
