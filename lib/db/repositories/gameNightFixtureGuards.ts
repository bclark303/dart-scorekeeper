import { and, eq, gt, inArray } from "drizzle-orm";

import { getDatabase } from "../client";
import {
  gameNightBoardPairings,
  gameNights,
} from "../game-night-schema";
import { leagueMatchSessions } from "../league-match-schema";
import { seasons } from "../schema";
import { activateAutomaticRoundIfDue } from "./gameNightFixtures";

export async function activateAutomaticRoundsForLeague(leagueId: string) {
  const nights = await getDatabase()
    .select({ id: gameNights.id })
    .from(gameNights)
    .innerJoin(seasons, eq(gameNights.seasonId, seasons.id))
    .where(and(eq(seasons.leagueId, leagueId), eq(gameNights.status, "active")));
  for (const night of nights) {
    await activateAutomaticRoundIfDue(night.id);
  }
}

export async function assertMatchRoundPlayable(matchId: string) {
  const [row] = await getDatabase()
    .select({
      gameNightStatus: gameNights.status,
      pairingStatus: gameNightBoardPairings.status,
      roundNumber: gameNightBoardPairings.roundNumber,
    })
    .from(leagueMatchSessions)
    .innerJoin(
      gameNightBoardPairings,
      eq(leagueMatchSessions.pairingId, gameNightBoardPairings.id),
    )
    .innerJoin(
      gameNights,
      eq(leagueMatchSessions.gameNightId, gameNights.id),
    )
    .where(eq(leagueMatchSessions.id, matchId))
    .limit(1);
  if (!row) throw new Error("League match was not found.");

  // Let the established league-match lifecycle produce its existing
  // "Start the game night" error before the overall night is active. The new
  // synchronized-round guard only becomes authoritative once league play is
  // actually underway.
  if (row.gameNightStatus !== "active") return;

  if (
    row.pairingStatus !== "ready" &&
    row.pairingStatus !== "active" &&
    row.pairingStatus !== "completed"
  ) {
    throw new Error(
      `Round ${row.roundNumber} has been prepared but has not started yet.`,
    );
  }
}

export async function getMatchRoundForUndo(matchId: string) {
  const [row] = await getDatabase()
    .select({
      gameNightId: leagueMatchSessions.gameNightId,
      roundNumber: gameNightBoardPairings.roundNumber,
    })
    .from(leagueMatchSessions)
    .innerJoin(
      gameNightBoardPairings,
      eq(leagueMatchSessions.pairingId, gameNightBoardPairings.id),
    )
    .where(eq(leagueMatchSessions.id, matchId))
    .limit(1);
  if (!row) throw new Error("League match was not found.");

  const future = await getDatabase()
    .select({ status: gameNightBoardPairings.status })
    .from(gameNightBoardPairings)
    .where(
      and(
        eq(gameNightBoardPairings.gameNightId, row.gameNightId),
        gt(gameNightBoardPairings.roundNumber, row.roundNumber),
      ),
    );
  if (future.some((pairing) => pairing.status !== "draft")) {
    throw new Error(
      "A completed earlier round cannot be reopened after the next round has started.",
    );
  }
  return row;
}

export async function discardFutureDraftRounds(
  gameNightId: string,
  afterRoundNumber: number,
) {
  const future = await getDatabase()
    .select({ id: gameNightBoardPairings.id, status: gameNightBoardPairings.status })
    .from(gameNightBoardPairings)
    .where(
      and(
        eq(gameNightBoardPairings.gameNightId, gameNightId),
        gt(gameNightBoardPairings.roundNumber, afterRoundNumber),
      ),
    );
  if (!future.length) return;
  if (future.some((pairing) => pairing.status !== "draft")) {
    throw new Error("Only draft future rounds can be discarded.");
  }
  // Match sessions cascade when their pairings are removed.
  await getDatabase()
    .delete(gameNightBoardPairings)
    .where(
      and(
        eq(gameNightBoardPairings.gameNightId, gameNightId),
        gt(gameNightBoardPairings.roundNumber, afterRoundNumber),
        inArray(gameNightBoardPairings.id, future.map((pairing) => pairing.id)),
      ),
    );
}
