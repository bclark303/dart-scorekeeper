import { and, eq } from "drizzle-orm";

import type { VenueStatus, VenueSummary } from "@/lib/league/boardDeviceContracts";
import { getDatabase } from "../client";
import { gameNights } from "../game-night-schema";
import { seasons } from "../schema";
import { leagueVenues, venues } from "../venue-schema";
import {
  requireLeagueAdminForVenueAccess,
  requireVenueAdminForUser,
  requireVenueLinkedToLeague,
} from "./venueHardware";

function asVenueStatus(value: string): VenueStatus {
  return value === "archived" ? "archived" : "active";
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

function validateVenueName(value: string) {
  const name = value.trim();
  if (!name || name.length > 100) throw new Error("Venue name must be 1-100 characters.");
  return name;
}

async function unfinishedVenueGameNights(venueId: string) {
  const rows = await getDatabase()
    .select({ id: gameNights.id, name: gameNights.name, status: gameNights.status })
    .from(gameNights)
    .where(eq(gameNights.venueId, venueId));
  return rows.filter((night) => night.status !== "completed" && night.status !== "cancelled");
}

async function unfinishedLeagueVenueGameNights(leagueId: string, venueId: string) {
  const rows = await getDatabase()
    .select({ id: gameNights.id, name: gameNights.name, status: gameNights.status })
    .from(gameNights)
    .innerJoin(seasons, eq(gameNights.seasonId, seasons.id))
    .where(and(eq(seasons.leagueId, leagueId), eq(gameNights.venueId, venueId)));
  return rows.filter((night) => night.status !== "completed" && night.status !== "cancelled");
}

/** Create a venue and immediately make it available to the selected league. */
export async function createVenueForLeagueForUser(input: {
  leagueId: string;
  userId: string;
  name: string;
  now?: number;
}): Promise<VenueSummary> {
  await requireLeagueAdminForVenueAccess(input.leagueId, input.userId);
  const now = input.now ?? Date.now();
  const row = {
    id: crypto.randomUUID(),
    name: validateVenueName(input.name),
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
      venueId: row.id,
      createdAt: now,
    });
  });

  return summarizeVenue(row);
}

/** Rename, archive, or restore a venue without destroying historical references. */
export async function updateVenueForUser(input: {
  venueId: string;
  userId: string;
  name?: string;
  status?: VenueStatus;
  now?: number;
}): Promise<VenueSummary> {
  await requireVenueAdminForUser(input.venueId, input.userId);
  const [existing] = await getDatabase()
    .select()
    .from(venues)
    .where(eq(venues.id, input.venueId))
    .limit(1);
  if (!existing) throw new Error("Venue was not found.");

  const nextName = input.name === undefined ? existing.name : validateVenueName(input.name);
  const nextStatus = input.status ?? asVenueStatus(existing.status);
  if (nextStatus !== "active" && nextStatus !== "archived") throw new Error("Invalid venue status.");

  if (nextStatus === "archived" && existing.status !== "archived") {
    const unfinished = await unfinishedVenueGameNights(input.venueId);
    if (unfinished.length) {
      const examples = unfinished.slice(0, 3).map((night) => night.name).join(", ");
      const extra = unfinished.length > 3 ? ` and ${unfinished.length - 3} more` : "";
      throw new Error(
        `This venue still has ${unfinished.length} unfinished Game Night${unfinished.length === 1 ? "" : "s"} (${examples}${extra}). Complete, cancel, or move them before archiving the venue.`,
      );
    }
  }

  const now = input.now ?? Date.now();
  await getDatabase()
    .update(venues)
    .set({ name: nextName, status: nextStatus, updatedAt: now })
    .where(eq(venues.id, input.venueId));

  const [updated] = await getDatabase()
    .select()
    .from(venues)
    .where(eq(venues.id, input.venueId))
    .limit(1);
  if (!updated) throw new Error("Updated venue could not be reloaded.");
  return summarizeVenue(updated);
}

/**
 * Remove a league's permission to use a venue. Historical Game Nights keep
 * their venue reference, but unfinished nights must be moved or closed first.
 */
export async function unlinkVenueFromLeagueForUser(input: {
  leagueId: string;
  venueId: string;
  userId: string;
}) {
  await requireLeagueAdminForVenueAccess(input.leagueId, input.userId);
  await requireVenueAdminForUser(input.venueId, input.userId);
  await requireVenueLinkedToLeague(input.leagueId, input.venueId);

  const unfinished = await unfinishedLeagueVenueGameNights(input.leagueId, input.venueId);
  if (unfinished.length) {
    throw new Error(
      `This league still has ${unfinished.length} unfinished Game Night${unfinished.length === 1 ? "" : "s"} at this venue. Complete, cancel, or move them before removing the venue from the league.`,
    );
  }

  await getDatabase()
    .delete(leagueVenues)
    .where(and(eq(leagueVenues.leagueId, input.leagueId), eq(leagueVenues.venueId, input.venueId)));
}
