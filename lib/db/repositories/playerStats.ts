import { and, eq, isNull } from "drizzle-orm";

import type {
  PlayerCareerStats,
  PlayerLeagueStats,
  PlayerStatTotals,
} from "@/lib/league/playerStatsContracts";
import { getDatabase } from "../client";
import { gameNights } from "../game-night-schema";
import { leagueMatchSessions, leagueMatchTurns } from "../league-match-schema";
import { leaguePlayers } from "../league-schema";
import { leagueMemberships, leagues, players, seasons } from "../schema";
import { LeaguePermissionError } from "./leagues";

function emptyTotals(): PlayerStatTotals {
  return {
    turns: 0,
    pointsScored: 0,
    count100Plus: 0,
    count140Plus: 0,
    count180s: 0,
    highestTurn: 0,
    doubleOuts: 0,
    highestCheckout: 0,
  };
}

function applyTurn(
  totals: PlayerStatTotals,
  turn: {
    scoreEntered: number;
    isBust: boolean;
    isCheckout: boolean;
    isDummy: boolean;
    voidedAt: number | null;
    finishRule: string;
  },
) {
  if (turn.voidedAt !== null || turn.isDummy) return;

  totals.turns += 1;
  if (!turn.isBust) {
    totals.pointsScored += turn.scoreEntered;
    totals.highestTurn = Math.max(totals.highestTurn, turn.scoreEntered);
    if (turn.scoreEntered >= 100) totals.count100Plus += 1;
    if (turn.scoreEntered >= 140) totals.count140Plus += 1;
    if (turn.scoreEntered === 180) totals.count180s += 1;
  }

  if (turn.isCheckout) {
    totals.highestCheckout = Math.max(totals.highestCheckout, turn.scoreEntered);
    if (turn.finishRule === "double") totals.doubleOuts += 1;
  }
}

export async function getPlayerCareerStatsForUser(
  playerId: string,
  userId: string,
): Promise<PlayerCareerStats> {
  const database = getDatabase();

  const [visiblePlayer] = await database
    .select({ id: players.id, displayName: players.displayName })
    .from(players)
    .innerJoin(leaguePlayers, eq(leaguePlayers.playerId, players.id))
    .innerJoin(
      leagueMemberships,
      and(
        eq(leagueMemberships.leagueId, leaguePlayers.leagueId),
        eq(leagueMemberships.userId, userId),
        eq(leagueMemberships.status, "active"),
      ),
    )
    .where(
      and(
        eq(players.id, playerId),
        eq(leaguePlayers.status, "active"),
        isNull(players.archivedAt),
      ),
    )
    .limit(1);

  if (!visiblePlayer) {
    throw new LeaguePermissionError("Player is not available through your leagues.");
  }

  const turns = await database
    .select({
      leagueId: leagues.id,
      leagueName: leagues.name,
      seasonId: seasons.id,
      seasonName: seasons.name,
      scoreEntered: leagueMatchTurns.scoreEntered,
      isBust: leagueMatchTurns.isBust,
      isCheckout: leagueMatchTurns.isCheckout,
      isDummy: leagueMatchTurns.isDummy,
      voidedAt: leagueMatchTurns.voidedAt,
      finishRule: leagueMatchSessions.finishRule,
    })
    .from(leagueMatchTurns)
    .innerJoin(leaguePlayers, eq(leagueMatchTurns.leaguePlayerId, leaguePlayers.id))
    .innerJoin(players, eq(leaguePlayers.playerId, players.id))
    .innerJoin(
      leagueMatchSessions,
      eq(leagueMatchTurns.matchSessionId, leagueMatchSessions.id),
    )
    .innerJoin(gameNights, eq(leagueMatchSessions.gameNightId, gameNights.id))
    .innerJoin(seasons, eq(gameNights.seasonId, seasons.id))
    .innerJoin(leagues, eq(seasons.leagueId, leagues.id))
    .innerJoin(
      leagueMemberships,
      and(
        eq(leagueMemberships.leagueId, leagues.id),
        eq(leagueMemberships.userId, userId),
        eq(leagueMemberships.status, "active"),
      ),
    )
    .where(eq(players.id, playerId));

  const totals = emptyTotals();
  const leaguesById = new Map<string, PlayerLeagueStats>();

  for (const turn of turns) {
    applyTurn(totals, turn);

    const league = leaguesById.get(turn.leagueId) ?? {
      leagueId: turn.leagueId,
      leagueName: turn.leagueName,
      totals: emptyTotals(),
      seasons: [],
    };
    applyTurn(league.totals, turn);

    let season = league.seasons.find((item) => item.seasonId === turn.seasonId);
    if (!season) {
      season = {
        seasonId: turn.seasonId,
        seasonName: turn.seasonName,
        totals: emptyTotals(),
      };
      league.seasons.push(season);
    }
    applyTurn(season.totals, turn);
    leaguesById.set(turn.leagueId, league);
  }

  return {
    playerId: visiblePlayer.id,
    displayName: visiblePlayer.displayName,
    totals,
    leagues: [...leaguesById.values()]
      .map((league) => ({
        ...league,
        seasons: [...league.seasons].sort((a, b) => a.seasonName.localeCompare(b.seasonName)),
      }))
      .sort((a, b) => a.leagueName.localeCompare(b.leagueName)),
  };
}
