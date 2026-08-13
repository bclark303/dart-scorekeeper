import assert from "node:assert/strict";

import {
  createGameNightForUser,
  createGameNightTemplateForUser,
  createLeagueForUser,
  getGameNightForUser,
  getGameNightTemplateForUser,
  LeaguePermissionError,
  listGameNightTemplatesForUser,
  updateGameNightTemplateForUser,
} from "@/lib/db";
import { DEFAULT_GAME_NIGHT_SETTINGS } from "@/lib/league/gameNightContracts";

async function run() {
  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const ownerUserId = `template-owner-${suffix}`;
  const outsiderUserId = `template-outsider-${suffix}`;
  const leagueId = `template-league-${suffix}`;
  const seasonId = `template-season-${suffix}`;

  await createLeagueForUser({
    id: leagueId,
    membershipId: `template-membership-${suffix}`,
    userId: ownerUserId,
    name: "Template Contract League",
    firstSeason: { id: seasonId, name: "Season One" },
    now: 1_910_000_000_000,
  });

  const regular = await createGameNightTemplateForUser({
    id: `template-regular-${suffix}`,
    leagueId,
    userId: ownerUserId,
    name: "Regular Night",
    settings: {
      ...DEFAULT_GAME_NIGHT_SETTINGS,
      startingScore: 501,
      legsPerMatch: 3,
      roundCount: 3,
      pairingStrategy: "random",
    },
    now: 1_910_000_000_010,
  });
  assert.equal(regular.isDefault, true, "The first league template should become the default.");

  const tournament = await createGameNightTemplateForUser({
    id: `template-tournament-${suffix}`,
    leagueId,
    userId: ownerUserId,
    name: "Tournament Night",
    settings: {
      ...DEFAULT_GAME_NIGHT_SETTINGS,
      startingScore: 301,
      finishRule: "straight",
      legsPerMatch: 5,
      roundCount: 4,
      pairingStrategy: "round_robin",
    },
    isDefault: true,
    now: 1_910_000_000_020,
  });
  assert.equal(tournament.isDefault, true);

  let templates = await listGameNightTemplatesForUser(leagueId, ownerUserId);
  assert.equal(templates.length, 2);
  assert.equal(templates[0].id, tournament.id, "Default template should be listed first.");
  assert.equal(templates.find((item) => item.id === regular.id)?.isDefault, false);

  await assert.rejects(
    () => createGameNightTemplateForUser({
      id: `template-duplicate-${suffix}`,
      leagueId,
      userId: ownerUserId,
      name: "Regular Night",
      settings: DEFAULT_GAME_NIGHT_SETTINGS,
    }),
    /already exists/,
  );

  const snapshot = await getGameNightTemplateForUser(tournament.id, ownerUserId);
  const gameNightId = `template-night-${suffix}`;
  await createGameNightForUser({
    id: gameNightId,
    leagueId,
    seasonId,
    userId: ownerUserId,
    name: "Snapshotted Night",
    scheduledAt: 1_910_100_000_000,
    settings: snapshot.settings,
    now: 1_910_000_000_100,
  });

  await updateGameNightTemplateForUser({
    templateId: tournament.id,
    userId: ownerUserId,
    settings: {
      ...tournament.settings,
      startingScore: 701,
      legsPerMatch: 7,
    },
    now: 1_910_000_000_200,
  });

  const updatedTemplate = await getGameNightTemplateForUser(tournament.id, ownerUserId);
  assert.equal(updatedTemplate.settings.startingScore, 701);
  assert.equal(updatedTemplate.settings.legsPerMatch, 7);

  const snapshottedNight = await getGameNightForUser(gameNightId, ownerUserId);
  assert.equal(snapshottedNight.settings.startingScore, 301);
  assert.equal(snapshottedNight.settings.legsPerMatch, 5);

  await updateGameNightTemplateForUser({
    templateId: regular.id,
    userId: ownerUserId,
    isDefault: true,
    now: 1_910_000_000_300,
  });
  templates = await listGameNightTemplatesForUser(leagueId, ownerUserId);
  assert.equal(templates[0].id, regular.id);
  assert.equal(templates.filter((item) => item.isDefault).length, 1);

  await assert.rejects(
    () => listGameNightTemplatesForUser(leagueId, outsiderUserId),
    (error: unknown) => error instanceof LeaguePermissionError,
    "Non-members must not be able to inspect league templates.",
  );

  console.log("Game-night template contract test passed.");
}

run().catch((error) => {
  console.error("Game-night template contract test failed.", error);
  process.exitCode = 1;
});
