import { and, eq } from "drizzle-orm";

import { buildGameNightStats } from "@/lib/league/gameNightStats";
import { getDatabase } from "../client";
import { gameNights } from "../game-night-schema";
import { leaguePlayers } from "../league-schema";
import { leagueMatchSessions, leagueMatchTurns } from "../league-match-schema";
import { leagueMemberships, seasons } from "../schema";
import { LeaguePermissionError } from "./leagues";

export async function getGameNightStatsForUser(
  gameNightId: string,
  userId: string,
) {
  const database = getDatabase();
  const [night] = await database
    .select({ leagueId: seasons.leagueId })
    .from(gameNights)
    .innerJoin(seasons, eq(gameNights.seasonId, seasons.id))
    .where(eq(gameNights.id, gameNightId))
    .limit(1);

  if (!night) throw new Error("Game night was not found.");

  const [membership] = await database
    .select({ id: leagueMemberships.id })
    .from(leagueMemberships)
    .where(
      and(
        eq(leagueMemberships.leagueId, night.leagueId),
        eq(leagueMemberships.userId, userId),
        eq(leagueMemberships.status, "active"),
      ),
    )
    .limit(1);

  if (!membership) {
    throw new LeaguePermissionError("League membership is required.");
  }

  const turns = await database
    .select({
      playerId: leaguePlayers.playerId,
      leaguePlayerId: leagueMatchTurns.leaguePlayerId,
      displayName: leagueMatchTurns.displayName,
      scoreEntered: leagueMatchTurns.scoreEntered,
      isBust: leagueMatchTurns.isBust,
      isCheckout: leagueMatchTurns.isCheckout,
      isDummy: leagueMatchTurns.isDummy,
      voidedAt: leagueMatchTurns.voidedAt,
      finishRule: leagueMatchSessions.finishRule,
    })
    .from(leagueMatchTurns)
    .innerJoin(
      leagueMatchSessions,
      eq(leagueMatchTurns.matchSessionId, leagueMatchSessions.id),
    )
    .leftJoin(leaguePlayers, eq(leagueMatchTurns.leaguePlayerId, leaguePlayers.id))
    .where(eq(leagueMatchSessions.gameNightId, gameNightId));

  return buildGameNightStats(turns);
}
