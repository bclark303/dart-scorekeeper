import {
  CASUAL_FREE_CAPABILITIES,
  COMMERCIAL_CAPABILITIES,
  LEAGUE_PRODUCT_CAPABILITIES,
  type CommercialCapability,
} from "./capabilities";

/**
 * Why a league currently has commercial access.
 *
 * Provider names intentionally do not appear here. A billing subscription, for
 * example, is translated by an adapter into `source: "subscription"`.
 */
export type LeagueAccessSource =
  | "preview"
  | "trial"
  | "subscription"
  | "manual_grant";

export type LeagueAccessState = "active" | "grace" | "inactive";

/** Provider-neutral commercial state for one league. */
export type LeagueAccessSnapshot = {
  leagueId: string;
  source: LeagueAccessSource;
  state: LeagueAccessState;
  /** Optional absolute expiry for trials, grants, or grace periods. */
  validUntil: number | null;
};

export type CommercialEntitlementContext = {
  leagueAccess?: LeagueAccessSnapshot | null;
  now?: number;
};

export class CommercialEntitlementError extends Error {
  capability: CommercialCapability;

  constructor(capability: CommercialCapability) {
    super(`Commercial capability is not available: ${capability}`);
    this.name = "CommercialEntitlementError";
    this.capability = capability;
  }
}

export function isLeagueAccessUsable(
  access: LeagueAccessSnapshot | null | undefined,
  now = Date.now(),
): access is LeagueAccessSnapshot {
  if (!access || access.state === "inactive") {
    return false;
  }

  return access.validUntil === null || access.validUntil > now;
}

/**
 * Resolve product capabilities without mixing them with league-role permissions.
 *
 * A future protected mutation should require BOTH the normal role/ownership
 * authorization and the relevant commercial capability.
 */
export function resolveCommercialCapabilities(
  context: CommercialEntitlementContext = {},
): ReadonlySet<CommercialCapability> {
  const capabilities = new Set<CommercialCapability>(CASUAL_FREE_CAPABILITIES);

  if (isLeagueAccessUsable(context.leagueAccess, context.now)) {
    for (const capability of LEAGUE_PRODUCT_CAPABILITIES) {
      capabilities.add(capability);
    }
  }

  return capabilities;
}

export function hasCommercialCapability(
  capability: CommercialCapability,
  context: CommercialEntitlementContext = {},
): boolean {
  return resolveCommercialCapabilities(context).has(capability);
}

export function assertCommercialCapability(
  capability: CommercialCapability,
  context: CommercialEntitlementContext = {},
): void {
  if (!hasCommercialCapability(capability, context)) {
    throw new CommercialEntitlementError(capability);
  }
}

/**
 * Current development access: league features remain fully unlocked while the
 * paid product is still being built and evaluated.
 */
export function createPreviewLeagueAccess(leagueId: string): LeagueAccessSnapshot {
  return {
    leagueId,
    source: "preview",
    state: "active",
    validUntil: null,
  };
}

/** Convenience check for the top-level paid product boundary. */
export function canAccessLeagueProduct(
  context: CommercialEntitlementContext = {},
): boolean {
  return hasCommercialCapability(COMMERCIAL_CAPABILITIES.LEAGUE_ACCESS, context);
}
