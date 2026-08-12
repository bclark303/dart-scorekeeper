import type { GameNightSummary } from "@/lib/league/gameNightContracts";

import {
  getGameNightForUser,
  setGameNightStatusForUser as setRawGameNightStatusForUser,
} from "./gameNights";

/**
 * Public Game Night lifecycle boundary.
 *
 * A single board match completing must never be able to end the whole league
 * night. Completion is only legal once every populated central board match is
 * complete. Cancellation remains an explicit administrative escape hatch.
 */
export async function setGameNightStatusForUser(
  gameNightId: string,
  userId: string,
  status: "active" | "completed" | "cancelled",
): Promise<GameNightSummary> {
  if (status === "completed") {
    const gameNight = await getGameNightForUser(gameNightId, userId);
    if (!gameNight.pairings.length) {
      throw new Error(
        "Cannot complete the Game Night before board matches have been populated.",
      );
    }

    const unfinished = gameNight.pairings.filter(
      (pairing) => pairing.matchStatus !== "completed",
    );
    if (unfinished.length) {
      const label = unfinished.length === 1 ? "board match is" : "board matches are";
      throw new Error(
        `Cannot complete the Game Night while ${unfinished.length} ${label} unfinished.`,
      );
    }
  }

  return setRawGameNightStatusForUser(gameNightId, userId, status);
}
