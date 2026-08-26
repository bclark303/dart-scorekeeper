import type { LeagueMatchSummary } from "@/lib/league/matchContracts";

import {
  startLeagueMatchForUser as startRawLeagueMatchForUser,
  undoLastLeagueMatchTurnForUser as undoRawLeagueMatchForUser,
} from "./leagueMatches";
import {
  assertMatchRoundPlayable,
  discardFutureDraftRounds,
  getMatchRoundForUndo,
} from "./gameNightFixtureGuards";

export async function startLeagueMatchForUser(
  matchId: string,
  userId: string,
): Promise<LeagueMatchSummary> {
  await assertMatchRoundPlayable(matchId);
  return startRawLeagueMatchForUser(matchId, userId);
}

export async function undoLastLeagueMatchTurnForUser(
  matchId: string,
  userId: string,
): Promise<LeagueMatchSummary> {
  const round = await getMatchRoundForUndo(matchId);
  const updated = await undoRawLeagueMatchForUser(matchId, userId);
  await discardFutureDraftRounds(round.gameNightId, round.roundNumber);
  return updated;
}
