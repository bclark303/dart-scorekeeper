import { createHash, randomBytes, randomInt } from "node:crypto";

import { eq } from "drizzle-orm";

import { boardDevices } from "../board-device-schema";
import { getDatabase } from "../client";
import { appMetadata } from "../schema";
import { requireVenueAdminForUser } from "./venueHardware";

const PAIRING_TTL_MS = 10 * 60 * 1000;
const PAIRING_PREFIX = "board-device-pair:";
const DEVICE_PAIRING_PREFIX = "board-device-pair-device:";

function hashCredential(value: string) {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function issueDeviceKey(deviceId: string) {
  const secret = randomBytes(32).toString("base64url");
  const deviceKey = `dsk_${deviceId}.${secret}`;
  return { deviceKey, credentialHash: hashCredential(deviceKey) };
}

async function deleteMetadata(key: string) {
  await getDatabase().delete(appMetadata).where(eq(appMetadata.key, key));
}

async function setMetadata(key: string, value: string, now: number) {
  await getDatabase()
    .insert(appMetadata)
    .values({ key, value, updatedAt: now })
    .onConflictDoUpdate({
      target: appMetadata.key,
      set: { value, updatedAt: now },
    });
}

async function issueUniqueCode() {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
    const [existing] = await getDatabase()
      .select({ key: appMetadata.key })
      .from(appMetadata)
      .where(eq(appMetadata.key, `${PAIRING_PREFIX}${code}`))
      .limit(1);
    if (!existing) return code;
  }
  throw new Error("Could not allocate a unique pairing code.");
}

export async function createBoardDevicePairingForUser(input: {
  deviceId: string;
  userId: string;
  now?: number;
}) {
  const database = getDatabase();
  const [device] = await database
    .select({
      id: boardDevices.id,
      venueId: boardDevices.venueId,
      status: boardDevices.status,
    })
    .from(boardDevices)
    .where(eq(boardDevices.id, input.deviceId))
    .limit(1);

  if (!device) throw new Error("Board device was not found.");
  await requireVenueAdminForUser(device.venueId, input.userId);
  if (device.status !== "active") {
    throw new Error("Enable the board device before pairing it.");
  }

  const devicePairingKey = `${DEVICE_PAIRING_PREFIX}${device.id}`;
  const [previous] = await database
    .select({ value: appMetadata.value })
    .from(appMetadata)
    .where(eq(appMetadata.key, devicePairingKey))
    .limit(1);

  if (previous?.value) {
    await deleteMetadata(`${PAIRING_PREFIX}${previous.value}`);
  }

  const now = input.now ?? Date.now();
  const code = await issueUniqueCode();
  const expiresAt = now + PAIRING_TTL_MS;
  await setMetadata(
    `${PAIRING_PREFIX}${code}`,
    JSON.stringify({ deviceId: device.id, expiresAt }),
    now,
  );
  await setMetadata(devicePairingKey, code, now);

  return { code, expiresAt };
}

export async function claimBoardDevicePairing(input: {
  code: string;
  now?: number;
}) {
  const code = input.code.replace(/\D/g, "");
  if (!/^\d{6}$/.test(code)) {
    throw new Error("Enter the six-digit pairing code.");
  }

  const database = getDatabase();
  const pairKey = `${PAIRING_PREFIX}${code}`;
  const [pairing] = await database
    .select({ value: appMetadata.value })
    .from(appMetadata)
    .where(eq(appMetadata.key, pairKey))
    .limit(1);

  if (!pairing) {
    throw new Error("That pairing code is invalid or has already been used.");
  }

  let payload: { deviceId?: string; expiresAt?: number } = {};
  try {
    payload = JSON.parse(pairing.value) as typeof payload;
  } catch {
    // Treat malformed metadata as an expired/invalid pairing below.
  }

  const now = input.now ?? Date.now();
  if (!payload.deviceId || typeof payload.expiresAt !== "number" || payload.expiresAt <= now) {
    await database.delete(appMetadata).where(eq(appMetadata.key, pairKey));
    if (payload.deviceId) {
      await database
        .delete(appMetadata)
        .where(eq(appMetadata.key, `${DEVICE_PAIRING_PREFIX}${payload.deviceId}`));
    }
    throw new Error("That pairing code has expired. Create a new one.");
  }

  const [device] = await database
    .select({ id: boardDevices.id, status: boardDevices.status })
    .from(boardDevices)
    .where(eq(boardDevices.id, payload.deviceId))
    .limit(1);

  if (!device || device.status !== "active") {
    throw new Error("This board device is not available for pairing.");
  }

  const { deviceKey, credentialHash } = issueDeviceKey(device.id);
  await database.transaction(async (transaction) => {
    await transaction
      .update(boardDevices)
      .set({ credentialHash, updatedAt: now })
      .where(eq(boardDevices.id, device.id));
    await transaction.delete(appMetadata).where(eq(appMetadata.key, pairKey));
    await transaction
      .delete(appMetadata)
      .where(eq(appMetadata.key, `${DEVICE_PAIRING_PREFIX}${device.id}`));
  });

  return { deviceKey };
}
