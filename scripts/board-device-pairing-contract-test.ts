import assert from "node:assert/strict";

import { createLeagueForUser } from "@/lib/db";
import {
  authenticateBoardDeviceCredential,
  registerBoardDeviceForUser,
} from "@/lib/db/repositories/boardDevices";
import {
  claimBoardDevicePairing,
  createBoardDevicePairingForUser,
} from "@/lib/db/repositories/boardDevicePairing";

async function run() {
  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const userId = `pair-owner-${suffix}`;
  const leagueId = `pair-league-${suffix}`;
  const deviceId = `pair-device-${suffix}`;

  await createLeagueForUser({
    id: leagueId,
    membershipId: `pair-membership-${suffix}`,
    userId,
    name: "Pairing Contract League",
    firstSeason: {
      id: `pair-season-${suffix}`,
      name: "Season One",
    },
  });

  const registered = await registerBoardDeviceForUser({
    id: deviceId,
    leagueId,
    userId,
    name: "Board 1 Scorer",
    boardNumber: 1,
    now: 1_000_000,
  });

  const pairing = await createBoardDevicePairingForUser({
    deviceId,
    userId,
    now: 2_000_000,
  });
  assert.match(pairing.code, /^\d{6}$/);
  assert.equal(pairing.expiresAt, 2_600_000);

  const claimed = await claimBoardDevicePairing({
    code: pairing.code,
    now: 2_001_000,
  });
  assert.notEqual(
    claimed.deviceKey,
    registered.deviceKey,
    "Pairing should rotate the permanent credential rather than expose the registration key.",
  );

  await assert.rejects(
    () => authenticateBoardDeviceCredential(registered.deviceKey),
    /Invalid board device key/,
    "Claiming a pairing must invalidate the old credential.",
  );

  const authenticated = await authenticateBoardDeviceCredential(
    claimed.deviceKey,
  );
  assert.equal(authenticated.id, deviceId);

  await assert.rejects(
    () => claimBoardDevicePairing({ code: pairing.code, now: 2_002_000 }),
    /invalid or has already been used/,
    "Pairing codes must be one-time use.",
  );

  const expiring = await createBoardDevicePairingForUser({
    deviceId,
    userId,
    now: 3_000_000,
  });
  await assert.rejects(
    () =>
      claimBoardDevicePairing({
        code: expiring.code,
        now: expiring.expiresAt + 1,
      }),
    /expired/,
    "Unused pairing codes must expire after the pairing window.",
  );

  console.log("Board device pairing contract test passed.");
}

run().catch((error) => {
  console.error("Board device pairing contract test failed.", error);
  process.exitCode = 1;
});
