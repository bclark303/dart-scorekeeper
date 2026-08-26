import assert from "node:assert/strict";

import {
  CASUAL_FREE_CAPABILITIES,
  COMMERCIAL_CAPABILITIES,
  LEAGUE_PRODUCT_CAPABILITIES,
  CommercialEntitlementError,
  PreviewLeagueAccessProvider,
  assertCommercialCapability,
  createPreviewLeagueAccess,
  hasCommercialCapability,
  resolveCommercialCapabilities,
  type LeagueAccessSnapshot,
} from "../lib/commercial";

function activeAccess(
  source: LeagueAccessSnapshot["source"],
  validUntil: number | null = null,
): LeagueAccessSnapshot {
  return {
    leagueId: "league-1",
    source,
    state: "active",
    validUntil,
  };
}

async function main() {
  const free = resolveCommercialCapabilities({ now: 1_000 });
  for (const capability of CASUAL_FREE_CAPABILITIES) {
    assert.equal(free.has(capability), true, `free product should include ${capability}`);
  }
  for (const capability of LEAGUE_PRODUCT_CAPABILITIES) {
    assert.equal(free.has(capability), false, `free product should not include ${capability}`);
  }

  for (const source of ["preview", "trial", "subscription", "manual_grant"] as const) {
    const entitled = resolveCommercialCapabilities({
      leagueAccess: activeAccess(source),
      now: 1_000,
    });
    for (const capability of [...CASUAL_FREE_CAPABILITIES, ...LEAGUE_PRODUCT_CAPABILITIES]) {
      assert.equal(
        entitled.has(capability),
        true,
        `${source} access should include ${capability}`,
      );
    }
  }

  const grace: LeagueAccessSnapshot = {
    leagueId: "league-1",
    source: "subscription",
    state: "grace",
    validUntil: 2_000,
  };
  assert.equal(
    hasCommercialCapability(COMMERCIAL_CAPABILITIES.LEAGUE_GAME_NIGHT, {
      leagueAccess: grace,
      now: 1_500,
    }),
    true,
    "grace access should remain usable until it expires",
  );
  assert.equal(
    hasCommercialCapability(COMMERCIAL_CAPABILITIES.LEAGUE_GAME_NIGHT, {
      leagueAccess: grace,
      now: 2_001,
    }),
    false,
    "expired grace access should no longer unlock league capabilities",
  );

  const inactive: LeagueAccessSnapshot = {
    leagueId: "league-1",
    source: "subscription",
    state: "inactive",
    validUntil: null,
  };
  assert.equal(
    hasCommercialCapability(COMMERCIAL_CAPABILITIES.LEAGUE_MANAGE, { leagueAccess: inactive }),
    false,
  );

  assert.throws(
    () => assertCommercialCapability(COMMERCIAL_CAPABILITIES.LEAGUE_DEVICES),
    (error: unknown) =>
      error instanceof CommercialEntitlementError &&
      error.capability === COMMERCIAL_CAPABILITIES.LEAGUE_DEVICES,
  );

  const preview = createPreviewLeagueAccess("league-preview");
  assert.deepEqual(preview, {
    leagueId: "league-preview",
    source: "preview",
    state: "active",
    validUntil: null,
  });

  const provider = new PreviewLeagueAccessProvider();
  assert.deepEqual(await provider.getLeagueAccess("league-provider"), {
    leagueId: "league-provider",
    source: "preview",
    state: "active",
    validUntil: null,
  });

  const allCapabilityIds = [
    ...CASUAL_FREE_CAPABILITIES,
    ...LEAGUE_PRODUCT_CAPABILITIES,
  ];
  assert.equal(
    new Set(allCapabilityIds).size,
    allCapabilityIds.length,
    "commercial capability lists must not overlap",
  );

  console.log("Commercial entitlement contract passed.");
}

void main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
