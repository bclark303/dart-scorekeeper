import { and, eq, isNull } from "drizzle-orm";

import { buildSeasonAnalytics } from "@/lib/league/seasonAnalytics";
import { getDatabase } from "../client";
import {
  gameNightAttendance,
  gameNightTeamMembers,
  gameNightTeams,
  gameNights,
} from "../game-night-schema";
import {
  leagueMatchDarts,
  leagueMatchSessions,
  leagueMatchTurns,
} from "../league-match-schema";
import { leaguePlayers, seasonRosterEntries } from "../league-schema";
import { leagueMemberships, leagues, players, seasons } from "../schema";
import { LeaguePermissionError } from "./leagues";

export async function getSeasonAnalyticsForUser(
  seasonId: string,
  userId: string,
) {
  const database = getDatabase();

  const [season] = await database
    .select({
      id: seasons.id,
      name: seasons.name,
      leagueId: seasons.leagueId,
      leagueName: leagues.name,
    })
    .from(seasons)
    .innerJoin(leagues, eq(seasons.leagueId, leagues.id))
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

  const [roster, nights, attendance, teamMembers, matches, turns, darts] =
    await Promise.all([
      database
        .select({
          leaguePlayerId: leaguePlayers.id,
          playerId: players.id,
          displayName: players.displayName,
        })
        .from(seasonRosterEntries)
        .innerJoin(
          leaguePlayers,
          eq(seasonRosterEntries.leaguePlayerId, leaguePlayers.id),
        )
        .innerJoin(players, eq(leaguePlayers.playerId, players.id))
        .where(eq(seasonRosterEntries.seasonId, seasonId)),

      database
        .select({
          id: gameNights.id,
          name: gameNights.name,
          scheduledAt: gameNights.scheduledAt,
          status: gameNights.status,
        })
        .from(gameNights)
        .where(eq(gameNights.seasonId, seasonId)),

      database
        .select({
          gameNightId: gameNightAttendance.gameNightId,
          leaguePlayerId: gameNightAttendance.leaguePlayerId,
          status: gameNightAttendance.status,
        })
        .from(gameNightAttendance)
        .innerJoin(
          gameNights,
          eq(gameNightAttendance.gameNightId, gameNights.id),
        )
        .where(eq(gameNights.seasonId, seasonId)),

      database
        .select({
          gameNightId: gameNightTeams.gameNightId,
          teamId: gameNightTeamMembers.teamId,
          leaguePlayerId: gameNightTeamMembers.leaguePlayerId,
          displayName: gameNightTeamMembers.displayName,
          isDummy: gameNightTeamMembers.isDummy,
        })
        .from(gameNightTeamMembers)
        .innerJoin(
          gameNightTeams,
          eq(gameNightTeamMembers.teamId, gameNightTeams.id),
        )
        .innerJoin(gameNights, eq(gameNightTeams.gameNightId, gameNights.id))
        .where(eq(gameNights.seasonId, seasonId)),

      database
        .select({
          id: leagueMatchSessions.id,
          gameNightId: leagueMatchSessions.gameNightId,
          teamAId: leagueMatchSessions.teamAId,
          teamBId: leagueMatchSessions.teamBId,
        })
        .from(leagueMatchSessions)
        .innerJoin(
          gameNights,
          eq(leagueMatchSessions.gameNightId, gameNights.id),
        )
        .where(eq(gameNights.seasonId, seasonId)),

      database
        .select({
          gameNightId: leagueMatchSessions.gameNightId,
          matchSessionId: leagueMatchTurns.matchSessionId,
          teamId: leagueMatchTurns.teamId,
          leaguePlayerId: leagueMatchTurns.leaguePlayerId,
          displayName: leagueMatchTurns.displayName,
          isDummy: leagueMatchTurns.isDummy,
          scoreEntered: leagueMatchTurns.scoreEntered,
          dartsThrown: leagueMatchTurns.dartsThrown,
          isBust: leagueMatchTurns.isBust,
          isCheckout: leagueMatchTurns.isCheckout,
        })
        .from(leagueMatchTurns)
        .innerJoin(
          leagueMatchSessions,
          eq(leagueMatchTurns.matchSessionId, leagueMatchSessions.id),
        )
        .innerJoin(
          gameNights,
          eq(leagueMatchSessions.gameNightId, gameNights.id),
        )
        .where(
          and(
            eq(gameNights.seasonId, seasonId),
            isNull(leagueMatchTurns.voidedAt),
          ),
        ),

      database
        .select({
          leaguePlayerId: leagueMatchTurns.leaguePlayerId,
          segment: leagueMatchDarts.segment,
          multiplier: leagueMatchDarts.multiplier,
          score: leagueMatchDarts.score,
        })
        .from(leagueMatchDarts)
        .innerJoin(
          leagueMatchTurns,
          eq(leagueMatchDarts.turnId, leagueMatchTurns.id),
        )
        .innerJoin(
          leagueMatchSessions,
          eq(leagueMatchTurns.matchSessionId, leagueMatchSessions.id),
        )
        .innerJoin(
          gameNights,
          eq(leagueMatchSessions.gameNightId, gameNights.id),
        )
        .where(
          and(
            eq(gameNights.seasonId, seasonId),
            isNull(leagueMatchTurns.voidedAt),
          ),
        ),
    ]);

  return buildSeasonAnalytics({
    leagueId: season.leagueId,
    leagueName: season.leagueName,
    seasonId: season.id,
    seasonName: season.name,
    roster,
    nights,
    attendance: attendance.map((row) => ({
      gameNightId: row.gameNightId,
      leaguePlayerId: row.leaguePlayerId,
      checkedIn: row.status === "checked_in",
    })),
    teamMembers,
    matches,
    turns,
    darts,
  });
}
