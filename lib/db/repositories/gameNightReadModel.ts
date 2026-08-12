import type { GameNightSummary } from "@/lib/league/gameNightContracts";

import {
  getGameNightForUser as getFixtureGameNightForUser,
  listGameNightsForUser as listFixtureGameNightsForUser,
} from "./gameNightFixtures";
import {
  hydrateGameNightAutoLayout,
  hydrateGameNightAutoLayouts,
} from "./gameNightAutoLayout";

/**
 * Public Game Night read boundary.
 *
 * The fixture repository owns round-aware state; the auto-layout layer owns
 * the persisted Auto/Manual setup modes. Returning the combined model here
 * keeps API callers, tests, and future non-HTTP consumers consistent.
 */
export async function getGameNightForUser(
  gameNightId: string,
  userId: string,
): Promise<GameNightSummary> {
  return hydrateGameNightAutoLayout(
    await getFixtureGameNightForUser(gameNightId, userId),
  );
}

export async function listGameNightsForUser(
  leagueId: string,
  userId: string,
): Promise<GameNightSummary[]> {
  return hydrateGameNightAutoLayouts(
    await listFixtureGameNightsForUser(leagueId, userId),
  );
}
