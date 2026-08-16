import { and, asc, eq, ne } from "drizzle-orm";

import type { GameNightBoardUsageSummary } from "@/lib/league/gameNightBoardOperations";
import type { GameNightSummary } from "@/lib/league/gameNightContracts";
import { getDatabase } from "../client";
import { gameNightBoards, gameNights } from "../game-night-schema";
import { seasons } from "../schema";
import { physicalBoards } from "../venue-schema";
import { getGameNightForUser } from "./gameNightReadModel";
import { requireLeagueAdminForVenueAccess } from "./venueHardware";

async function getOperationContext(gameNightId: string) {
  const [row] = await getDatabase()
    .select({
      gameNightId: gameNights.id,
      leagueId: seasons.leagueId,
      venueId: gameNights.venueId,
      status: gameNights.status,
    })
    .from(gameNights)
    .innerJoin(seasons, eq(gameNights.seasonId, seasons.id))
    .where(eq(gameNights.id, gameNightId))
    .limit(1);
  if (!row) throw new Error("Game Night was not found.");
  return row;
}

/**
 * Return non-closed allocations at the same venue so coordinators can see
 * potential pre-play sharing and hard active-use conflicts before acting.
 *
 * Game Nights currently have a start time but no duration, so this deliberately
 * reports allocations rather than pretending to know whether two scheduled
 * nights truly overlap. The UI can show the other night's scheduled time and
 * explain that simultaneous active use is the authoritative conflict rule.
 */
export async function listGameNightBoardUsagesForUser(
  gameNightId: string,
  userId: string,
): Promise<GameNightBoardUsageSummary[]> {
  const context = await getOperationContext(gameNightId);
  await requireLeagueAdminForVenueAccess(context.leagueId, userId);
  if (!context.venueId) return [];

  const rows = await getDatabase()
    .select({
      physicalBoardId: gameNightBoards.physicalBoardId,
      gameNightId: gameNights.id,
      gameNightName: gameNights.name,
      gameNightStatus: gameNights.status,
      scheduledAt: gameNights.scheduledAt,
    })
    .from(gameNightBoards)
    .innerJoin(gameNights, eq(gameNightBoards.gameNightId, gameNights.id))
    .where(and(eq(gameNights.venueId, context.venueId), ne(gameNights.id, gameNightId)))
    .orderBy(asc(gameNights.scheduledAt));

  return rows
    .filter(
      (row) =>
        Boolean(row.physicalBoardId) &&
        row.gameNightStatus !== "completed" &&
        row.gameNightStatus !== "cancelled",
    )
    .map((row) => ({
      physicalBoardId: row.physicalBoardId!,
      gameNightId: row.gameNightId,
      gameNightName: row.gameNightName,
      gameNightStatus: row.gameNightStatus,
      scheduledAt: row.scheduledAt,
    }));
}

/**
 * Move one live Game Night board slot to another physical board.
 *
 * The logical game_night_board row is preserved, so every fixture, match
 * session, score, and round reference keeps the same identity. Only the
 * permanent physical location serving that slot changes. A scorer attached to
 * the destination board will therefore receive the existing match immediately.
 */
export async function relocateGameNightBoardForUser(input: {
  gameNightId: string;
  gameNightBoardId: string;
  physicalBoardId: string;
  userId: string;
  now?: number;
}): Promise<GameNightSummary> {
  const context = await getOperationContext(input.gameNightId);
  await requireLeagueAdminForVenueAccess(context.leagueId, input.userId);
  if (context.status !== "active") {
    throw new Error(
      "Live board relocation is available only while the Game Night is active. Use the Boards workspace before play.",
    );
  }
  if (!context.venueId) throw new Error("This Game Night does not have a venue assigned.");

  const [slot] = await getDatabase()
    .select()
    .from(gameNightBoards)
    .where(
      and(
        eq(gameNightBoards.id, input.gameNightBoardId),
        eq(gameNightBoards.gameNightId, input.gameNightId),
      ),
    )
    .limit(1);
  if (!slot) throw new Error("Game Night board slot was not found.");
  if (slot.physicalBoardId === input.physicalBoardId) {
    return getGameNightForUser(input.gameNightId, input.userId);
  }

  const [target] = await getDatabase()
    .select()
    .from(physicalBoards)
    .where(eq(physicalBoards.id, input.physicalBoardId))
    .limit(1);
  if (!target || target.venueId !== context.venueId) {
    throw new Error("The destination board does not belong to this Game Night venue.");
  }
  if (target.status !== "active") {
    throw new Error("Out-of-service boards cannot receive a live match.");
  }

  const [sameNightUse] = await getDatabase()
    .select({ id: gameNightBoards.id })
    .from(gameNightBoards)
    .where(
      and(
        eq(gameNightBoards.gameNightId, input.gameNightId),
        eq(gameNightBoards.physicalBoardId, target.id),
        ne(gameNightBoards.id, input.gameNightBoardId),
      ),
    )
    .limit(1);
  if (sameNightUse) {
    throw new Error(`${target.name} is already assigned to another board slot in this Game Night.`);
  }

  const [activeConflict] = await getDatabase()
    .select({
      gameNightName: gameNights.name,
    })
    .from(gameNightBoards)
    .innerJoin(gameNights, eq(gameNightBoards.gameNightId, gameNights.id))
    .where(
      and(
        eq(gameNightBoards.physicalBoardId, target.id),
        eq(gameNights.status, "active"),
        ne(gameNights.id, input.gameNightId),
      ),
    )
    .limit(1);
  if (activeConflict) {
    throw new Error(`${target.name} is already in use by ${activeConflict.gameNightName}.`);
  }

  const now = input.now ?? Date.now();
  await getDatabase().transaction(async (tx) => {
    await tx
      .update(gameNightBoards)
      .set({
        physicalBoardId: target.id,
        boardNumber: target.boardNumber,
        name: target.name,
      })
      .where(eq(gameNightBoards.id, input.gameNightBoardId));
    await tx
      .update(gameNights)
      .set({ updatedAt: now })
      .where(eq(gameNights.id, input.gameNightId));
  });

  return getGameNightForUser(input.gameNightId, input.userId);
}
