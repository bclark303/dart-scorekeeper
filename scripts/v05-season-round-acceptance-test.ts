import assert from "node:assert/strict";

import {
  DEFAULT_GAME_NIGHT_SETTINGS,
  resolveGameNightSettings,
} from "@/lib/league/gameNightContracts";
import { generateFixtureRound, type FixtureHistoryPairing } from "@/lib/league/fixtureEngine";
import { optimizeGameNightLayout } from "@/lib/league/gameNightLayout";

const ATTENDANCE = [15, 14, 17, 25, 12, 19, 27, 10, 10, 20, 22, 13, 16, 24, 26, 10, 22, 15, 10, 10, 25, 28];
const BOARD_COUNT = 4;

function opponentKey(a: string, b: string) {
  return [a, b].sort().join(":");
}

function pairingKeys(pairings: Array<{ teamAId: string; teamBId: string }>) {
  return pairings.map((pairing) => opponentKey(pairing.teamAId, pairing.teamBId)).sort();
}

const settings = resolveGameNightSettings({
  ...DEFAULT_GAME_NIGHT_SETTINGS,
  teamCreationMode: "automatic",
  teamCountMode: "automatic",
  teamSizeMode: "automatic",
  boardCountMode: "manual",
  boardCount: BOARD_COUNT,
  boardRotationType: "fixed",
  roundCount: 3,
  pairingStrategy: "fixed",
  roundAdvanceMode: "manual",
  intermissionAfterRounds: [2],
  intermissionDurationMinutes: 10,
  legsPerMatch: 1,
  startingScore: 601,
  finishRule: "double",
});

const rows: Array<{
  week: number;
  attendance: number;
  teams: number;
  minTeam: number;
  maxTeam: number;
  pairings: number;
}> = [];

for (let index = 0; index < ATTENDANCE.length; index += 1) {
  const attendance = ATTENDANCE[index];
  const optimized = optimizeGameNightLayout(settings, attendance);
  const teamCount = optimized.settings.targetTeamCount;
  const minTeam = optimized.settings.minTeamPlayers;
  const maxTeam = optimized.settings.maxTeamPlayers;
  const pairCount = Math.floor(teamCount / 2);

  assert.ok(teamCount <= BOARD_COUNT * 2, `Week ${index + 1}: Auto Teams exceeded venue capacity.`);
  assert.ok(pairCount <= BOARD_COUNT, `Week ${index + 1}: more pairings than physical boards.`);
  assert.ok(maxTeam - minTeam <= 1, `Week ${index + 1}: Auto Teams are not balanced.`);
  assert.ok(minTeam >= 2, `Week ${index + 1}: Auto Teams created a one-player team unexpectedly.`);

  const teamIds = Array.from({ length: teamCount }, (_, teamIndex) => `w${index + 1}-team-${teamIndex + 1}`);
  const boardIds = Array.from({ length: BOARD_COUNT }, (_, boardIndex) => `board-${boardIndex + 1}`);

  const roundOne = generateFixtureRound({
    teamIds,
    boardIds,
    roundNumber: 1,
    strategy: "fixed",
    boardRotationType: "fixed",
    history: [],
    random: () => 0.314159,
  });
  assert.ok(roundOne.pairings.length <= BOARD_COUNT);

  const historyOne: FixtureHistoryPairing[] = roundOne.pairings.map((pairing) => ({
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
    history: historyOne,
    random: () => 0.777,
  });
  assert.deepEqual(
    pairingKeys(roundTwo.pairings),
    pairingKeys(roundOne.pairings),
    `Week ${index + 1}: Round 2 changed fixed opponents.`,
  );

  const historyTwo: FixtureHistoryPairing[] = [
    ...historyOne,
    ...roundTwo.pairings.map((pairing) => ({
      ...pairing,
      roundNumber: 2,
      winnerTeamId: null,
    })),
  ];
  const roundThree = generateFixtureRound({
    teamIds,
    boardIds,
    roundNumber: 3,
    strategy: "fixed",
    boardRotationType: "fixed",
    history: historyTwo,
    random: () => 0.123,
  });
  assert.deepEqual(
    pairingKeys(roundThree.pairings),
    pairingKeys(roundOne.pairings),
    `Week ${index + 1}: Round 3 changed fixed opponents.`,
  );

  rows.push({
    week: index + 1,
    attendance,
    teams: teamCount,
    minTeam,
    maxTeam,
    pairings: roundOne.pairings.length,
  });
}

const fullNight = rows.find((row) => row.attendance === 28);
assert.ok(fullNight);
assert.equal(fullNight.teams, 8);
assert.equal(fullNight.minTeam, 3);
assert.equal(fullNight.maxTeam, 4);
assert.equal(fullNight.pairings, 4);
assert.deepEqual(settings.intermissionAfterRounds, [2]);
assert.equal(settings.intermissionDurationMinutes, 10);
assert.equal(settings.legsPerMatch, 1);
assert.equal(settings.startingScore, 601);

console.log("v0.5 22-week league season structural acceptance passed.");
console.table(rows);
