import assert from "node:assert/strict";

import { DEFAULT_GAME_NIGHT_SETTINGS } from "@/lib/league/gameNightContracts";
import { optimizeGameNightLayout } from "@/lib/league/gameNightLayout";

function automaticSettings() {
  return {
    ...DEFAULT_GAME_NIGHT_SETTINGS,
    teamCountMode: "automatic" as const,
    teamSizeMode: "automatic" as const,
    boardCountMode: "automatic" as const,
  };
}

{
  const result = optimizeGameNightLayout(automaticSettings(), 8);
  assert.equal(result.settings.targetTeamCount, 4);
  assert.equal(result.settings.minTeamPlayers, 2);
  assert.equal(result.settings.maxTeamPlayers, 2);
  assert.equal(result.settings.boardCount, 2);
  assert.equal(result.recommendation.hasBye, false);
}

{
  const result = optimizeGameNightLayout(automaticSettings(), 10);
  assert.equal(result.settings.targetTeamCount, 4);
  assert.equal(result.settings.minTeamPlayers, 2);
  assert.equal(result.settings.maxTeamPlayers, 3);
  assert.equal(result.settings.boardCount, 2);
  assert.equal(result.recommendation.hasBye, false);
}

{
  const result = optimizeGameNightLayout(automaticSettings(), 12);
  assert.equal(result.settings.targetTeamCount, 6);
  assert.equal(result.settings.minTeamPlayers, 2);
  assert.equal(result.settings.maxTeamPlayers, 2);
  assert.equal(result.settings.boardCount, 3);
}

{
  const result = optimizeGameNightLayout(automaticSettings(), 7);
  assert.equal(result.settings.targetTeamCount, 3);
  assert.equal(result.settings.minTeamPlayers, 2);
  assert.equal(result.settings.maxTeamPlayers, 3);
  assert.equal(result.settings.boardCount, 1);
  assert.equal(result.recommendation.hasBye, true);
}

{
  const result = optimizeGameNightLayout(
    {
      ...DEFAULT_GAME_NIGHT_SETTINGS,
      teamCountMode: "automatic",
      teamSizeMode: "manual",
      minTeamPlayers: 3,
      maxTeamPlayers: 4,
      boardCountMode: "manual",
      boardCount: 2,
    },
    12,
  );
  assert.equal(result.settings.targetTeamCount, 4);
  assert.equal(result.settings.minTeamPlayers, 3);
  assert.equal(result.settings.maxTeamPlayers, 4);
  assert.equal(result.settings.boardCount, 2);
}

{
  const result = optimizeGameNightLayout(
    {
      ...DEFAULT_GAME_NIGHT_SETTINGS,
      teamCountMode: "manual",
      targetTeamCount: 4,
      teamSizeMode: "automatic",
      boardCountMode: "manual",
      boardCount: 2,
    },
    9,
  );
  assert.equal(result.settings.targetTeamCount, 4);
  assert.equal(result.settings.minTeamPlayers, 2);
  assert.equal(result.settings.maxTeamPlayers, 3);
  assert.equal(result.settings.boardCount, 2);
}

{
  const result = optimizeGameNightLayout(
    {
      ...DEFAULT_GAME_NIGHT_SETTINGS,
      teamCountMode: "manual",
      targetTeamCount: 5,
      teamSizeMode: "manual",
      boardCountMode: "automatic",
    },
    10,
  );
  assert.equal(result.settings.targetTeamCount, 5);
  assert.equal(result.settings.boardCount, 2);
  assert.equal(result.recommendation.hasBye, true);
}

{
  const manual = {
    ...DEFAULT_GAME_NIGHT_SETTINGS,
    teamCountMode: "manual" as const,
    targetTeamCount: 6,
    teamSizeMode: "manual" as const,
    minTeamPlayers: 2,
    maxTeamPlayers: 5,
    boardCountMode: "manual" as const,
    boardCount: 2,
  };
  const result = optimizeGameNightLayout(manual, 17);
  assert.equal(result.settings.targetTeamCount, 6);
  assert.equal(result.settings.minTeamPlayers, 2);
  assert.equal(result.settings.maxTeamPlayers, 5);
  assert.equal(result.settings.boardCount, 2);
}

console.log("Game Night automatic layout contract test passed.");
