import assert from "node:assert/strict";

import {
  generateFixtureRound,
  type FixtureHistoryPairing,
} from "@/lib/league/fixtureEngine";

function seededRandom(seed: number) {
  let value = seed >>> 0;
  return () => {
    value += 0x6d2b79f5;
    let t = value;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function opponentKey(a: string, b: string) {
  return [a, b].sort().join(":");
}

function assertUniqueRound(plan: ReturnType<typeof generateFixtureRound>) {
  const teams = plan.pairings.flatMap((pairing) => [pairing.teamAId, pairing.teamBId]);
  const boards = plan.pairings.map((pairing) => pairing.boardId);
  assert.equal(new Set(teams).size, teams.length, "A team may appear only once in one synchronized round.");
  assert.equal(new Set(boards).size, boards.length, "A board may host only one match in one synchronized round.");
}

function run() {
  const teams4 = ["A", "B", "C", "D"];
  const boards2 = ["board-1", "board-2"];
  const historyRound1: FixtureHistoryPairing[] = [
    { roundNumber: 1, boardId: "board-1", teamAId: "A", teamBId: "B", winnerTeamId: "A" },
    { roundNumber: 1, boardId: "board-2", teamAId: "C", teamBId: "D", winnerTeamId: "C" },
  ];

  const randomRound2 = generateFixtureRound({
    teamIds: teams4,
    boardIds: boards2,
    roundNumber: 2,
    strategy: "random",
    boardRotationType: "rotate",
    history: historyRound1,
    random: seededRandom(11),
  });
  assertUniqueRound(randomRound2);
  const previousOpponents = new Set(historyRound1.map((pairing) => opponentKey(pairing.teamAId, pairing.teamBId)));
  for (const pairing of randomRound2.pairings) {
    assert.equal(
      previousOpponents.has(opponentKey(pairing.teamAId, pairing.teamBId)),
      false,
      "Random pairing must avoid a rematch whenever another complete matching exists.",
    );
  }
  const boardForAInRound1 = historyRound1.find((pairing) => pairing.teamAId === "A")?.boardId;
  const boardForAInRound2 = randomRound2.pairings.find(
    (pairing) => pairing.teamAId === "A" || pairing.teamBId === "A",
  )?.boardId;
  assert.notEqual(
    boardForAInRound2,
    boardForAInRound1,
    "Rotate mode should move a team to another board when the assignment permits it.",
  );

  const roundRobinOpponents = new Set<string>();
  for (let roundNumber = 1; roundNumber <= 3; roundNumber += 1) {
    const plan = generateFixtureRound({
      teamIds: teams4,
      boardIds: boards2,
      roundNumber,
      strategy: "round_robin",
      boardRotationType: "fixed",
      history: [],
    });
    assertUniqueRound(plan);
    for (const pairing of plan.pairings) {
      roundRobinOpponents.add(opponentKey(pairing.teamAId, pairing.teamBId));
    }
  }
  assert.equal(
    roundRobinOpponents.size,
    6,
    "Four-team round robin must cover all six unique opponent pairings in three rounds.",
  );

  const teams5 = ["A", "B", "C", "D", "E"];
  const byeHistory: FixtureHistoryPairing[] = [];
  const byes: string[] = [];
  for (let roundNumber = 1; roundNumber <= 5; roundNumber += 1) {
    const plan = generateFixtureRound({
      teamIds: teams5,
      boardIds: boards2,
      roundNumber,
      strategy: "random",
      boardRotationType: "rotate",
      history: byeHistory,
      random: seededRandom(roundNumber * 97),
    });
    assertUniqueRound(plan);
    assert.equal(plan.byeTeamIds.length, 1);
    byes.push(plan.byeTeamIds[0]);
    for (const pairing of plan.pairings) {
      byeHistory.push({
        roundNumber,
        boardId: pairing.boardId,
        teamAId: pairing.teamAId,
        teamBId: pairing.teamBId,
      });
    }
  }
  assert.equal(
    new Set(byes).size,
    5,
    "No team should receive a second random bye until every team has received one.",
  );

  const swissHistory: FixtureHistoryPairing[] = [
    { roundNumber: 1, boardId: "board-1", teamAId: "A", teamBId: "D", winnerTeamId: "A" },
    { roundNumber: 1, boardId: "board-2", teamAId: "B", teamBId: "C", winnerTeamId: "B" },
    { roundNumber: 2, boardId: "board-1", teamAId: "A", teamBId: "C", winnerTeamId: "A" },
    { roundNumber: 2, boardId: "board-2", teamAId: "B", teamBId: "D", winnerTeamId: "B" },
  ];
  const swiss = generateFixtureRound({
    teamIds: teams4,
    boardIds: boards2,
    roundNumber: 3,
    strategy: "swiss",
    boardRotationType: "rotate",
    history: swissHistory,
    random: seededRandom(44),
  });
  assertUniqueRound(swiss);
  const swissKeys = new Set(swiss.pairings.map((pairing) => opponentKey(pairing.teamAId, pairing.teamBId)));
  assert.ok(swissKeys.has(opponentKey("A", "B")), "Swiss mode should pair the two undefeated teams when they have not met.");
  assert.ok(swissKeys.has(opponentKey("C", "D")), "Swiss mode should pair teams with the same record when possible.");

  const manual = generateFixtureRound({
    teamIds: teams4,
    boardIds: boards2,
    roundNumber: 1,
    strategy: "manual",
    boardRotationType: "manual",
    history: [],
    random: seededRandom(1),
  });
  assert.deepEqual(
    manual.pairings.map(({ teamAId, teamBId }) => [teamAId, teamBId]),
    [["A", "B"], ["C", "D"]],
    "Manual strategy starts with a predictable draft the coordinator can edit.",
  );

  console.log("Fixture engine contract test passed.");
}

run();
