import { eq } from "drizzle-orm";

import type { GameNightSummary } from "@/lib/league/gameNightContracts";
import { getDatabase } from "../client";
import { venues } from "../venue-schema";
import { setGameNightVenueForUser as setGameNightVenueBase } from "./gameNights";

/**
 * Public Game Night venue mutation. Archived venues remain visible to venue
 * administrators for history/restoration, but cannot be selected for new play.
 */
export async function setGameNightVenueForUser(
  gameNightId: string,
  venueId: string,
  userId: string,
): Promise<GameNightSummary> {
  const [venue] = await getDatabase()
    .select({ status: venues.status })
    .from(venues)
    .where(eq(venues.id, venueId))
    .limit(1);
  if (!venue) throw new Error("Venue was not found.");
  if (venue.status !== "active") {
    throw new Error("Archived venues cannot be assigned to a Game Night. Restore the venue first.");
  }
  return setGameNightVenueBase(gameNightId, venueId, userId);
}
