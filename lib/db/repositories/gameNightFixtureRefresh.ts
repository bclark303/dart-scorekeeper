import type { GameNightSummary } from "@/lib/league/gameNightContracts";

import {
  activateAutomaticRoundIfDue,
  getGameNightForUser,
} from "./gameNightFixtures";

/**
 * Read-with-tick boundary used by the coordinator UI.
 *
 * Authorization happens before the idempotent timer check. This means an
 * authenticated league member viewing the night can wake an automatic round
 * exactly when its configured delay/intermission expires, without requiring a
 * background worker or a registered board to be online.
 */
export async function refreshGameNightForUser(
  gameNightId: string,
  userId: string,
): Promise<GameNightSummary> {
  const before = await getGameNightForUser(gameNightId, userId);
  if (before.status === "active") {
    await activateAutomaticRoundIfDue(gameNightId);
  }
  return getGameNightForUser(gameNightId, userId);
}
