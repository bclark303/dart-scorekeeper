import assert from "node:assert/strict";

import { buildSeasonAnalytics } from "@/lib/league/seasonAnalytics";

const analytics = buildSeasonAnalytics({
  leagueId: "league-1",
  leagueName: "Analytics League",
  seasonId: "season-1",
  seasonName: "Season One",
  roster: [
    { leaguePlayerId: "a", playerId: "pa", displayName: "A" },
    { leaguePlayerId: "b", playerId: "pb", displayName: "B" },
    { leaguePlayerId: "c", playerId: "pc", displayName: "C" },
    { leaguePlayerId: "d", playerId: "pd", displayName: "D" },
  ],
  nights: [
    { id: "n1", name: "Night 1", scheduledAt: 1000, status: "completed" },
    { id: "n2", name: "Night 2", scheduledAt: 2000, status: "completed" },
  ],
  attendance: [
    { gameNightId: "n1", leaguePlayerId: "a", checkedIn: true },
    { gameNightId: "n2", leaguePlayerId: "a", checkedIn: true },
    { gameNightId: "n1", leaguePlayerId: "b", checkedIn: true },
    { gameNightId: "n2", leaguePlayerId: "b", checkedIn: true },
    { gameNightId: "n1", leaguePlayerId: "c", checkedIn: true },
    { gameNightId: "n1", leaguePlayerId: "d", checkedIn: true },
    { gameNightId: "n2", leaguePlayerId: "d", checkedIn: true },
  ],
  teamMembers: [
    { gameNightId: "n1", teamId: "t1", leaguePlayerId: "a", displayName: "A", isDummy: false },
    { gameNightId: "n1", teamId: "t1", leaguePlayerId: "b", displayName: "B", isDummy: false },
    { gameNightId: "n1", teamId: "t2", leaguePlayerId: "c", displayName: "C", isDummy: false },
    { gameNightId: "n1", teamId: "t2", leaguePlayerId: "d", displayName: "D", isDummy: false },
    { gameNightId: "n2", teamId: "t3", leaguePlayerId: "a", displayName: "A", isDummy: false },
    { gameNightId: "n2", teamId: "t3", leaguePlayerId: "c", displayName: "C", isDummy: false },
    { gameNightId: "n2", teamId: "t4", leaguePlayerId: "b", displayName: "B", isDummy: false },
    { gameNightId: "n2", teamId: "t4", leaguePlayerId: "d", displayName: "D", isDummy: false },
  ],
  matches: [
    { id: "m1", gameNightId: "n1", teamAId: "t1", teamBId: "t2" },
    { id: "m2", gameNightId: "n2", teamAId: "t3", teamBId: "t4" },
  ],
  turns: [
    { gameNightId: "n1", matchSessionId: "m1", teamId: "t1", leaguePlayerId: "a", displayName: "A", isDummy: false, scoreEntered: 60, dartsThrown: 3, isBust: false, isCheckout: false },
    { gameNightId: "n1", matchSessionId: "m1", teamId: "t2", leaguePlayerId: "c", displayName: "C", isDummy: false, scoreEntered: 45, dartsThrown: 3, isBust: false, isCheckout: false },
    { gameNightId: "n1", matchSessionId: "m1", teamId: "t1", leaguePlayerId: "b", displayName: "B", isDummy: false, scoreEntered: 40, dartsThrown: 2, isBust: false, isCheckout: true },
    { gameNightId: "n2", matchSessionId: "m2", teamId: "t4", leaguePlayerId: "b", displayName: "B", isDummy: false, scoreEntered: 80, dartsThrown: 3, isBust: true, isCheckout: false },
    { gameNightId: "n2", matchSessionId: "m2", teamId: "t4", leaguePlayerId: "d", displayName: "D", isDummy: false, scoreEntered: 50, dartsThrown: 1, isBust: false, isCheckout: true },
  ],
  darts: [
    { leaguePlayerId: "a", segment: "20", multiplier: 3, score: 60 },
    { leaguePlayerId: "b", segment: "miss", multiplier: 0, score: 0 },
  ],
});

assert.equal(analytics.totalNights, 2);
assert.equal(analytics.completedNights, 2);
assert.equal(analytics.totalLegs, 2);
assert.equal(analytics.detailedDartsRecorded, 2);

const a = analytics.players.find((player) => player.leaguePlayerId === "a");
const b = analytics.players.find((player) => player.leaguePlayerId === "b");
const c = analytics.players.find((player) => player.leaguePlayerId === "c");
const d = analytics.players.find((player) => player.leaguePlayerId === "d");
assert.ok(a && b && c && d);
assert.equal(a.nightsAttended, 2);
assert.equal(c.attendanceRate, 50);
assert.equal(a.legWins, 1);
assert.equal(a.legLosses, 1);
assert.equal(b.legWins, 2);
assert.equal(b.legLosses, 0);
assert.equal(b.pointsScored, 40, "Bust points must not contribute to average.");
assert.equal(b.dartsThrown, 5, "Bust darts still count toward darts thrown.");
assert.equal(Number(b.threeDartAverage.toFixed(1)), 24.0);
assert.equal(d.highestCheckout, 50);

const ab = analytics.partnerships.find((pair) =>
  [pair.playerAId, pair.playerBId].includes("a") && [pair.playerAId, pair.playerBId].includes("b"),
);
assert.ok(ab);
assert.equal(ab.nightsTogether, 1);
assert.equal(ab.legWins, 1);

const ac = analytics.partnerships.find((pair) =>
  [pair.playerAId, pair.playerBId].includes("a") && [pair.playerAId, pair.playerBId].includes("c"),
);
assert.ok(ac);
assert.equal(ac.legLosses, 1);

const ad = analytics.headToHead.find((pair) =>
  [pair.playerAId, pair.playerBId].includes("a") && [pair.playerAId, pair.playerBId].includes("d"),
);
assert.ok(ad);
assert.equal(ad.legs, 2);

assert.equal(analytics.segments[0]?.label, "T20");
assert.ok(analytics.scoreBuckets.some((bucket) => bucket.label === "0–20" && bucket.count === 1));

console.log("Season analytics contract test passed.");
