import assert from "node:assert/strict";

import { generateFixtureRound } from "@/lib/league/fixtureEngine";
import {
  DEFAULT_GAME_NIGHT_SETTINGS,
  resolveGameNightSettings,
} from "@/lib/league/gameNightContracts";
import { optimizeGameNightLayout } from "@/lib/league/gameNightLayout";
import { isValidResolvedGameNightSettings } from "@/lib/league/gameNightSettingsValidation";
import { buildSeasonLegStandings } from "@/lib/league/seasonLegStandings";

function opponentKey(a: string, b: string) {
  return [a, b].sort().join(":");
}

const fourBoardLeague = optimizeGameNightLayout(
  {
    ...DEFAULT_GAME_NIGHT_SETTINGS,
    teamCreationMode: "automatic",
    teamCountMode: "automatic",
    teamSizeMode: "automatic",
    boardCountMode: "manual",
    boardCount: 4,
  },
  28,
);
assert.equal(fourBoardLeague.settings.boardCount, 4);
assert.equal(
  fourBoardLeague.settings.targetTeamCount,
  8,
  "Four fixed boards must cap Auto Teams at eight simultaneous teams.",
);
assert.equal(fourBoardLeague.settings.minTeamPlayers, 3);
assert.equal(fourBoardLeague.settings.maxTeamPlayers, 4);
assert.match(fourBoardLeague.recommendation.description, /venue-cap fit/);

const teamIds = Array.from({ length: 8 }, (_, index) => `team-${index + 1}`);
const boardIds = Array.from({ length: 4 }, (_, index) => `board-${index + 1}`);
const roundOne = generateFixtureRound({
  teamIds,
  boardIds,
  roundNumber: 1,
  strategy: "fixed",
  boardRotationType: "fixed",
  history: [],
  random: () => 0.37,
});
assert.equal(roundOne.pairings.length, 4);
assert.equal(roundOne.byeTeamIds.length, 0);

const roundOneHistory = roundOne.pairings.map((pairing) => ({
  ...pairing,
  roundNumber: 1,
  winnerTeamId: null,
}));
const roundTwo = generateFixtureRound({
  teamIds,
  boardIds,
  roundNumber: 2,
  strategy: "fixed",
  boardRotationType: "fixed",
  history: roundOneHistory,
  random: () => 0.91,
});
assert.deepEqual(
  roundTwo.pairings.map((pairing) => opponentKey(pairing.teamAId, pairing.teamBId)),
  roundOne.pairings.map((pairing) => opponentKey(pairing.teamAId, pairing.teamBId)),
  "Fixed matchups must repeat Round 1 opponents regardless of later randomness.",
);
assert.deepEqual(
  roundTwo.pairings.map((pairing) => pairing.boardId),
  roundOne.pairings.map((pairing) => pairing.boardId),
  "Fixed board rotation must keep those repeated matchups on the same boards.",
);

const threeLegLeagueFormat = resolveGameNightSettings({
  ...DEFAULT_GAME_NIGHT_SETTINGS,
  roundCount: 3,
  pairingStrategy: "fixed",
  legsPerMatch: 1,
  intermissionAfterRounds: [2],
  intermissionDurationMinutes: 10,
});
assert.equal(isValidResolvedGameNightSettings(threeLegLeagueFormat), true);
assert.deepEqual(threeLegLeagueFormat.intermissionAfterRounds, [2]);

const standings = buildSeasonLegStandings(
  [
    { gameNightId: "night-1", winnerTeamId: "team-a", loserTeamId: "team-b" },
    { gameNightId: "night-1", winnerTeamId: "team-b", loserTeamId: "team-a" },
    { gameNightId: "night-2", winnerTeamId: "team-a", loserTeamId: "team-b" },
  ],
  [
    { teamId: "team-a", leaguePlayerId: "p1", displayName: "Player One", isDummy: false },
    { teamId: "team-a", leaguePlayerId: "p2", displayName: "Player Two", isDummy: false },
    { teamId: "team-b", leaguePlayerId: "p3", displayName: "Player Three", isDummy: false },
    { teamId: "team-b", leaguePlayerId: null, displayName: "Dummy", isDummy: true },
  ],
);
const playerOne = standings.find((standing) => standing.leaguePlayerId === "p1");
const playerThree = standings.find((standing) => standing.leaguePlayerId === "p3");
assert.ok(playerOne && playerThree);
assert.equal(playerOne.legWins, 2);
assert.equal(playerOne.legLosses, 1);
assert.equal(playerOne.nightsPlayed, 2);
assert.equal(playerThree.legWins, 1);
assert.equal(playerThree.legLosses, 2);
assert.equal(standings.some((standing) => standing.displayName === "Dummy"), false);

console.log("v0.5 league round model contract passed.");
