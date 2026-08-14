import { and, asc, eq, inArray, ne } from "drizzle-orm";

import type {
  PhysicalBoardStatus,
  PhysicalBoardSummary,
  VenueStatus,
  VenueSummary,
} from "@/lib/league/boardDeviceContracts";
import { getDatabase } from "../client";
import { gameNightBoards, gameNights } from "../game-night-schema";
import { appMetadata, leagueMemberships, leagues, seasons } from "../schema";
import { leagueVenues, physicalBoards, venues } from "../venue-schema";
import { LeaguePermissionError } from "./leagues";

const MANUAL_BOARD_SETUP_PREFIX = "venue-board-setup-manual:";

function asVenueStatus(value: string): VenueStatus {
  return value === "archived" ? "archived" : "active";
}

function asBoardStatus(value: string): PhysicalBoardStatus {
  return value === "out_of_service" ? "out_of_service" : "active";
}

function summarizeVenue(row: typeof venues.$inferSelect): VenueSummary {
  return {
    id: row.id,
    name: row.name,
    status: asVenueStatus(row.status),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function summarizeBoard(row: typeof physicalBoards.$inferSelect): PhysicalBoardSummary {
  return {
    id: row.id,
    venueId: row.venueId,
    boardNumber: row.boardNumber,
    name: row.name,
    status: asBoardStatus(row.status),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

async function activeLeagueRole(leagueId: string, userId: string) {
  const [membership] = await getDatabase()
    .select({ role: leagueMemberships.role })
    .from(leagueMemberships)
    .where(
      and(
        eq(leagueMemberships.leagueId, leagueId),
        eq(leagueMemberships.userId, userId),
        eq(leagueMemberships.status, "active"),
      ),
    )
    .limit(1);
  return membership?.role ?? null;
}

async function markVenueBoardSetupManual(venueId: string, now = Date.now()) {
  await getDatabase()
    .insert(appMetadata)
    .values({
      key: `${MANUAL_BOARD_SETUP_PREFIX}${venueId}`,
      value: "1",
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: appMetadata.key,
      set: { value: "1", updatedAt: now },
    });
}

async function venueBoardSetupIsManual(venueId: string) {
  const [row] = await getDatabase()
    .select({ key: appMetadata.key })
    .from(appMetadata)
    .where(eq(appMetadata.key, `${MANUAL_BOARD_SETUP_PREFIX}${venueId}`))
    .limit(1);
  return Boolean(row);
}

export async function requireLeagueAdminForVenueAccess(leagueId: string, userId: string) {
  const role = await activeLeagueRole(leagueId, userId);
  if (role !== "owner" && role !== "admin") throw new LeaguePermissionError();
}

export async function requireVenueAdminForUser(venueId: string, userId: string) {
  const [membership] = await getDatabase()
    .select({ role: leagueMemberships.role })
    .from(leagueVenues)
    .innerJoin(
      leagueMemberships,
      and(
        eq(leagueMemberships.leagueId, leagueVenues.leagueId),
        eq(leagueMemberships.userId, userId),
        eq(leagueMemberships.status, "active"),
      ),
    )
    .where(
      and(
        eq(leagueVenues.venueId, venueId),
        inArray(leagueMemberships.role, ["owner", "admin"]),
      ),
    )
    .limit(1);
  if (!membership) {
    throw new LeaguePermissionError("Administrator access to a league using this venue is required.");
  }
}

export async function requireVenueLinkedToLeague(leagueId: string, venueId: string) {
  const [link] = await getDatabase()
    .select({ id: leagueVenues.id })
    .from(leagueVenues)
    .where(and(eq(leagueVenues.leagueId, leagueId), eq(leagueVenues.venueId, venueId)))
    .limit(1);
  if (!link) throw new Error("That venue is not available to this league.");
}

export async function listVenuesForLeagueForUser(
  leagueId: string,
  userId: string,
): Promise<VenueSummary[]> {
  const role = await activeLeagueRole(leagueId, userId);
  if (!role) throw new LeaguePermissionError("League membership is required.");
  const rows = await getDatabase()
    .select({ venue: venues })
    .from(leagueVenues)
    .innerJoin(venues, eq(leagueVenues.venueId, venues.id))
    .where(eq(leagueVenues.leagueId, leagueId))
    .orderBy(asc(venues.name));
  return rows.map(({ venue }) => summarizeVenue(venue));
}

export async function getDefaultVenueForLeagueForUser(leagueId: string, userId: string) {
  const rows = await listVenuesForLeagueForUser(leagueId, userId);
  return rows.find((venue) => venue.status === "active") ?? rows[0] ?? null;
}

/**
 * Older databases and unusual imports may contain a league without a venue.
 * Create the minimum venue link lazily so those records remain usable.
 */
export async function ensureDefaultVenueForLeagueForUser(input: {
  leagueId: string;
  userId: string;
  venueName?: string;
  now?: number;
}): Promise<VenueSummary> {
  await requireLeagueAdminForVenueAccess(input.leagueId, input.userId);
  const existing = await getDefaultVenueForLeagueForUser(input.leagueId, input.userId);
  if (existing) return existing;

  const [league] = await getDatabase()
    .select({ name: leagues.name })
    .from(leagues)
    .where(eq(leagues.id, input.leagueId))
    .limit(1);
  if (!league) throw new Error("League was not found.");

  const now = input.now ?? Date.now();
  const venueId = crypto.randomUUID();
  const row = {
    id: venueId,
    name: input.venueName?.trim() || `${league.name} Venue`,
    status: "active",
    createdByUserId: input.userId,
    createdAt: now,
    updatedAt: now,
  };
  await getDatabase().transaction(async (tx) => {
    await tx.insert(venues).values(row);
    await tx.insert(leagueVenues).values({
      id: crypto.randomUUID(),
      leagueId: input.leagueId,
      venueId,
      createdAt: now,
    });
  });
  return summarizeVenue(row);
}

export async function listPhysicalBoardsForVenueForUser(input: {
  leagueId: string;
  venueId: string;
  userId: string;
}): Promise<PhysicalBoardSummary[]> {
  const role = await activeLeagueRole(input.leagueId, input.userId);
  if (!role) throw new LeaguePermissionError("League membership is required.");
  await requireVenueLinkedToLeague(input.leagueId, input.venueId);
  const rows = await getDatabase()
    .select()
    .from(physicalBoards)
    .where(eq(physicalBoards.venueId, input.venueId))
    .orderBy(asc(physicalBoards.boardNumber));
  return rows.map(summarizeBoard);
}

export async function listPhysicalBoardsForVenue(venueId: string) {
  return getDatabase()
    .select()
    .from(physicalBoards)
    .where(eq(physicalBoards.venueId, venueId))
    .orderBy(asc(physicalBoards.boardNumber));
}

export async function createPhysicalBoardForUser(input: {
  leagueId: string;
  venueId: string;
  userId: string;
  boardNumber: number;
  name?: string;
  now?: number;
}): Promise<PhysicalBoardSummary> {
  await requireLeagueAdminForVenueAccess(input.leagueId, input.userId);
  await requireVenueLinkedToLeague(input.leagueId, input.venueId);
  await requireVenueAdminForUser(input.venueId, input.userId);
  if (!Number.isInteger(input.boardNumber) || input.boardNumber < 1 || input.boardNumber > 128) {
    throw new Error("Board number must be from 1 to 128.");
  }
  const now = input.now ?? Date.now();
  const row = {
    id: crypto.randomUUID(),
    venueId: input.venueId,
    boardNumber: input.boardNumber,
    name: input.name?.trim() || `Board ${input.boardNumber}`,
    status: "active",
    createdAt: now,
    updatedAt: now,
  };
  await getDatabase().insert(physicalBoards).values(row);
  await markVenueBoardSetupManual(input.venueId, now);
  return summarizeBoard(row);
}

export async function updatePhysicalBoardForUser(input: {
  boardId: string;
  userId: string;
  name?: string;
  status?: PhysicalBoardStatus;
  now?: number;
}): Promise<PhysicalBoardSummary> {
  const [existing] = await getDatabase()
    .select()
    .from(physicalBoards)
    .where(eq(physicalBoards.id, input.boardId))
    .limit(1);
  if (!existing) throw new Error("Physical board was not found.");
  await requireVenueAdminForUser(existing.venueId, input.userId);
  const name = input.name === undefined ? existing.name : input.name.trim();
  const status = input.status ?? asBoardStatus(existing.status);
  if (!name || name.length > 80) throw new Error("Board name must be 1-80 characters.");
  if (status !== "active" && status !== "out_of_service") throw new Error("Invalid board status.");
  const now = input.now ?? Date.now();
  await getDatabase()
    .update(physicalBoards)
    .set({ name, status, updatedAt: now })
    .where(eq(physicalBoards.id, input.boardId));
  await markVenueBoardSetupManual(existing.venueId, now);
  const [updated] = await getDatabase()
    .select()
    .from(physicalBoards)
    .where(eq(physicalBoards.id, input.boardId))
    .limit(1);
  if (!updated) throw new Error("Updated physical board could not be reloaded.");
  return summarizeBoard(updated);
}

/**
 * Preserve the old "board count" convenience until an administrator explicitly
 * manages venue hardware. Auto-provisioned venues may grow to satisfy a Game
 * Night's declared board count; manually managed venues never invent hardware.
 */
export async function bootstrapEmptyVenueBoards(venueId: string, count: number, now = Date.now()) {
  const existing = await listPhysicalBoardsForVenue(venueId);
  if (count <= 0 || existing.length >= count) return existing;
  if (await venueBoardSetupIsManual(venueId)) return existing;

  const usedNumbers = new Set(existing.map((board) => board.boardNumber));
  const values: Array<{
    id: string;
    venueId: string;
    boardNumber: number;
    name: string;
    status: string;
    createdAt: number;
    updatedAt: number;
  }> = [];
  let boardNumber = 1;
  while (existing.length + values.length < count) {
    while (usedNumbers.has(boardNumber)) boardNumber += 1;
    values.push({
      id: crypto.randomUUID(),
      venueId,
      boardNumber,
      name: `Board ${boardNumber}`,
      status: "active",
      createdAt: now,
      updatedAt: now,
    });
    usedNumbers.add(boardNumber);
    boardNumber += 1;
  }
  if (values.length) await getDatabase().insert(physicalBoards).values(values);
  return listPhysicalBoardsForVenue(venueId);
}

export async function activePhysicalBoardIdsUsedByOtherGameNights(
  gameNightId: string,
): Promise<Set<string>> {
  const rows = await getDatabase()
    .select({ physicalBoardId: gameNightBoards.physicalBoardId })
    .from(gameNightBoards)
    .innerJoin(gameNights, eq(gameNightBoards.gameNightId, gameNights.id))
    .where(and(eq(gameNights.status, "active"), ne(gameNights.id, gameNightId)));
  return new Set(
    rows
      .map((row) => row.physicalBoardId)
      .filter((id): id is string => Boolean(id)),
  );
}

export async function assertGameNightPhysicalBoardsAvailable(gameNightId: string) {
  const target = await getDatabase()
    .select({
      physicalBoardId: gameNightBoards.physicalBoardId,
      boardNumber: physicalBoards.boardNumber,
      boardName: physicalBoards.name,
    })
    .from(gameNightBoards)
    .leftJoin(physicalBoards, eq(gameNightBoards.physicalBoardId, physicalBoards.id))
    .where(eq(gameNightBoards.gameNightId, gameNightId));
  const targetIds = target
    .map((row) => row.physicalBoardId)
    .filter((id): id is string => Boolean(id));
  if (!targetIds.length) throw new Error("Assign physical boards before starting the Game Night.");

  const conflicts = await getDatabase()
    .select({
      physicalBoardId: gameNightBoards.physicalBoardId,
      gameNightId: gameNights.id,
      gameNightName: gameNights.name,
    })
    .from(gameNightBoards)
    .innerJoin(gameNights, eq(gameNightBoards.gameNightId, gameNights.id))
    .where(
      and(
        inArray(gameNightBoards.physicalBoardId, targetIds),
        eq(gameNights.status, "active"),
        ne(gameNights.id, gameNightId),
      ),
    );
  if (!conflicts.length) return;
  const boardNames = target
    .filter((board) => conflicts.some((conflict) => conflict.physicalBoardId === board.physicalBoardId))
    .map((board) => board.boardName || `Board ${board.boardNumber ?? "?"}`);
  throw new Error(
    `${boardNames.join(", ")} ${boardNames.length === 1 ? "is" : "are"} already in use by another active Game Night.`,
  );
}

export async function leagueIdForGameNight(gameNightId: string) {
  const [row] = await getDatabase()
    .select({ leagueId: seasons.leagueId })
    .from(gameNights)
    .innerJoin(seasons, eq(gameNights.seasonId, seasons.id))
    .where(eq(gameNights.id, gameNightId))
    .limit(1);
  return row?.leagueId ?? null;
}
