import { and, eq, inArray, isNull } from "drizzle-orm";

import {
  buildSeasonLegStandings,
  type SeasonLegResultInput,
  type SeasonTeamMemberInput,
} from "@/lib/league/seasonLegStandings";
import { getDatabase } from "../client";
import { gameNightTeamMembers, gameNights } from "../game-night-schema";
import { leagueMatchSessions, leagueMatchTurns } from "../league-match-schema";
import { leagueMemberships, seasons } from "../schema";
import { LeaguePermissionError } from "./leagues";

export async function getSeasonLegStandingsForUser(
  seasonId: string,
  userId: string,
) {
  const database = getDatabase();
  const [season] = await database
    .select({
      id: seasons.id,
      leagueId: seasons.leagueId,
      name: seasons.name,
    })
    .from(seasons)
    .where(eq(seasons.id, seasonId))
    .limit(1);

  if (!season) throw new Error("Season was not found.");

  const [membership] = await database
    .select({ id: leagueMemberships.id })
    .from(leagueMemberships)
    .where(
      and(
        eq(leagueMemberships.leagueId, season.leagueId),
        eq(leagueMemberships.userId, userId),
        eq(leagueMemberships.status, "active"),
      ),
    )
    .limit(1);

  if (!membership) {
    throw new LeaguePermissionError("League membership is required.");
  }

  const checkoutRows = await database
    .select({
      gameNightId: leagueMatchSessions.gameNightId,
      teamAId: leagueMatchSessions.teamAId,
      teamBId: leagueMatchSessions.teamBId,
      winnerTeamId: leagueMatchTurns.teamId,
    })
    .from(leagueMatchTurns)
    .innerJoin(
      leagueMatchSessions,
      eq(leagueMatchTurns.matchSessionId, leagueMatchSessions.id),
    )
    .innerJoin(gameNights, eq(leagueMatchSessions.gameNightId, gameNights.id))
    .where(
      and(
        eq(gameNights.seasonId, seasonId),
        eq(leagueMatchTurns.isCheckout, true),
        isNull(leagueMatchTurns.voidedAt),
      ),
    );

  const legs: SeasonLegResultInput[] = checkoutRows.map((row) => ({
    gameNightId: row.gameNightId,
    winnerTeamId: row.winnerTeamId,
    loserTeamId:
      row.winnerTeamId === row.teamAId ? row.teamBId : row.teamAId,
  }));
  const teamIds = [...new Set(legs.flatMap((leg) => [leg.winnerTeamId, leg.loserTeamId]))];

  const memberRows = teamIds.length
    ? await database
        .select({
          teamId: gameNightTeamMembers.teamId,
          leaguePlayerId: gameNightTeamMembers.leaguePlayerId,
          displayName: gameNightTeamMembers.displayName,
          isDummy: gameNightTeamMembers.isDummy,
        })
        .from(gameNightTeamMembers)
        .where(inArray(gameNightTeamMembers.teamId, teamIds))
    : [];

  const members: SeasonTeamMemberInput[] = memberRows;
  const standings = buildSeasonLegStandings(legs, members);

  return {
    seasonId: season.id,
    seasonName: season.name,
    leagueId: season.leagueId,
    totalLegs: legs.length,
    standings,
  };
}
