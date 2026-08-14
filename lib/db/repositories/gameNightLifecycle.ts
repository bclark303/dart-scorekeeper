import {
  resolveGameNightSettings,
  type GameNightSummary,
} from "@/lib/league/gameNightContracts";

import {
  activateGameNightRound,
  getGameNightForUser,
} from "./gameNightFixtures";
import { setGameNightStatusForUser as setRawGameNightStatusForUser } from "./gameNights";
import { assertGameNightPhysicalBoardsAvailable } from "./venueHardware";

/**
 * Public Game Night lifecycle boundary.
 *
 * Starting the night releases Round 1 to registered boards. Future rounds are
 * prepared as drafts and are released separately so synchronized play cannot
 * leak into the next round early.
 */
export async function setGameNightStatusForUser(
  gameNightId: string,
  userId: string,
  status: "active" | "completed" | "cancelled",
): Promise<GameNightSummary> {
  if (status === "active") {
    const before = await getGameNightForUser(gameNightId, userId);
    if (!before.pairings.length) {
      throw new Error("Populate the boards before starting the Game Night.");
    }
    await assertGameNightPhysicalBoardsAvailable(gameNightId);
    await setRawGameNightStatusForUser(gameNightId, userId, "active");
    await activateGameNightRound(gameNightId, 1);
    return getGameNightForUser(gameNightId, userId);
  }

  if (status === "completed") {
    const gameNight = await getGameNightForUser(gameNightId, userId);
    const settings = resolveGameNightSettings(gameNight.settings);
    if (!gameNight.pairings.length) {
      throw new Error(
        "Cannot complete the Game Night before board matches have been populated.",
      );
    }
    if ((gameNight.currentRoundNumber ?? 0) < settings.roundCount) {
      throw new Error(
        `Cannot complete the Game Night before all ${settings.roundCount} configured rounds have been generated and played.`,
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

  await setRawGameNightStatusForUser(gameNightId, userId, status);
  return getGameNightForUser(gameNightId, userId);
}
