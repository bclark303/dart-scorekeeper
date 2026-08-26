/**
 * Stable product capabilities used at the commercial boundary.
 *
 * Keep these names independent from marketing plan names and billing providers.
 * UI labels, prices, and provider products may change without changing feature code.
 */
export const COMMERCIAL_CAPABILITIES = {
  CASUAL_PLAY: "casual.play",
  CASUAL_SAVED_GAMES: "casual.saved_games",
  CASUAL_HISTORY: "casual.history",
  LEAGUE_ACCESS: "league.access",
  LEAGUE_MANAGE: "league.manage",
  LEAGUE_ROSTER: "league.roster",
  LEAGUE_GAME_NIGHT: "league.game_night",
  LEAGUE_DEVICES: "league.devices",
  LEAGUE_STATISTICS: "league.statistics",
  LEAGUE_STATUS_DISPLAYS: "league.status_displays",
} as const;

export type CommercialCapability =
  (typeof COMMERCIAL_CAPABILITIES)[keyof typeof COMMERCIAL_CAPABILITIES];

/** Capabilities intended to remain available in the free casual product. */
export const CASUAL_FREE_CAPABILITIES: readonly CommercialCapability[] = [
  COMMERCIAL_CAPABILITIES.CASUAL_PLAY,
  COMMERCIAL_CAPABILITIES.CASUAL_SAVED_GAMES,
  COMMERCIAL_CAPABILITIES.CASUAL_HISTORY,
];

/**
 * Capabilities supplied by a league commercial entitlement.
 *
 * This deliberately describes product access, not a named price tier. If future
 * tiers are introduced, they can supply subsets/supersets without changing the
 * capability IDs used by the application.
 */
export const LEAGUE_PRODUCT_CAPABILITIES: readonly CommercialCapability[] = [
  COMMERCIAL_CAPABILITIES.LEAGUE_ACCESS,
  COMMERCIAL_CAPABILITIES.LEAGUE_MANAGE,
  COMMERCIAL_CAPABILITIES.LEAGUE_ROSTER,
  COMMERCIAL_CAPABILITIES.LEAGUE_GAME_NIGHT,
  COMMERCIAL_CAPABILITIES.LEAGUE_DEVICES,
  COMMERCIAL_CAPABILITIES.LEAGUE_STATISTICS,
  COMMERCIAL_CAPABILITIES.LEAGUE_STATUS_DISPLAYS,
];
