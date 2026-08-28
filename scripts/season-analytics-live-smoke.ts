import assert from "node:assert/strict";
import { eq } from "drizzle-orm";

import { user } from "@/lib/db/auth-schema";
import { getDatabase } from "@/lib/db/client";
import { getSeasonAnalyticsForUser } from "@/lib/db/repositories/seasonAnalytics";

async function run() {
  const database = getDatabase();
  const [account] = await database
    .select({ id: user.id, email: user.email })
    .from(user)
    .where(eq(user.email, "test@test.com"))
    .limit(1);

  assert.ok(account, "test@test.com must exist before the closeout analytics smoke check.");

  const analytics = await getSeasonAnalyticsForUser("v05-closeout-season", account.id);
  assert.equal(analytics.leagueName, "v0.5-closeout");
  assert.equal(analytics.totalPlayers, 28);
  assert.equal(analytics.totalNights, 22);
  assert.equal(analytics.totalLegs, 228);
  assert.equal(analytics.totalTurns, 7484);
  assert.equal(analytics.players.length, 28);
  assert.equal(analytics.players[0]?.displayName, "Closeout Player 21");
  assert.equal(analytics.players[0]?.legWins, 37);
  assert.equal(analytics.detailedDartsRecorded, 0);

  console.log("V0.5 CLOSEOUT ANALYTICS SMOKE PASSED");
  console.log(`League: ${analytics.leagueName}`);
  console.log(`Season: ${analytics.seasonName}`);
  console.log(`Players: ${analytics.totalPlayers}`);
  console.log(`Nights: ${analytics.totalNights}`);
  console.log(`Legs: ${analytics.totalLegs}`);
  console.log(`Turns: ${analytics.totalTurns}`);
  console.log(`League 3DA: ${analytics.leagueThreeDartAverage.toFixed(2)}`);
  console.log(`Top player: ${analytics.players[0]?.displayName} ${analytics.players[0]?.legWins}-${analytics.players[0]?.legLosses}`);
  console.log(`Partnership pairs: ${analytics.partnerships.length}`);
  console.log(`Head-to-head pairs: ${analytics.headToHead.length}`);
}

run().catch((error) => {
  console.error("V0.5 CLOSEOUT ANALYTICS SMOKE FAILED", error);
  process.exitCode = 1;
});
