import assert from "node:assert/strict";

import { buildGameNightStats } from "@/lib/league/gameNightStats";
import { legsNeededToWin } from "@/lib/league/matchFormat";

const stats = buildGameNightStats([
  {
    leaguePlayerId: "p1",
    displayName: "Alice",
    scoreEntered: 180,
    isBust: false,
    isCheckout: false,
    isDummy: false,
    voidedAt: null,
    finishRule: "double",
  },
  {
    leaguePlayerId: "p1",
    displayName: "Alice",
    scoreEntered: 40,
    isBust: false,
    isCheckout: true,
    isDummy: false,
    voidedAt: null,
    finishRule: "double",
  },
  {
    leaguePlayerId: "p2",
    displayName: "Bob",
    scoreEntered: 180,
    isBust: false,
    isCheckout: false,
    isDummy: false,
    voidedAt: null,
    finishRule: "double",
  },
  {
    leaguePlayerId: "p2",
    displayName: "Bob",
    scoreEntered: 180,
    isBust: true,
    isCheckout: false,
    isDummy: false,
    voidedAt: null,
    finishRule: "double",
  },
  {
    leaguePlayerId: "p2",
    displayName: "Bob",
    scoreEntered: 140,
    isBust: false,
    isCheckout: false,
    isDummy: false,
    voidedAt: 1234,
    finishRule: "double",
  },
  {
    leaguePlayerId: null,
    displayName: "Dummy 1",
    scoreEntered: 180,
    isBust: false,
    isCheckout: false,
    isDummy: true,
    voidedAt: null,
    finishRule: "double",
  },
]);

assert.equal(legsNeededToWin(1), 1);
assert.equal(legsNeededToWin(3), 2);
assert.equal(legsNeededToWin(5), 3);
assert.throws(() => legsNeededToWin(2), /Unsupported best-of format/);

assert.equal(stats.players.length, 2);
assert.equal(stats.total180s, 2);
assert.equal(stats.totalDoubleOuts, 1);
assert.equal(
  stats.players.find((player) => player.leaguePlayerId === "p1")?.doubleOuts,
  1,
);
assert.equal(
  stats.players.find((player) => player.leaguePlayerId === "p1")
    ?.highestCheckout,
  40,
);
assert.equal(
  stats.players.find((player) => player.leaguePlayerId === "p2")?.count180s,
  1,
);
assert.equal(stats.highestTurn?.value, 180);
assert.deepEqual(
  stats.highestTurn?.players.map((player) => player.displayName).sort(),
  ["Alice", "Bob"],
);
assert.equal(stats.most180s?.value, 1);

console.log("Game Night stats and Best-of contract test passed.");
