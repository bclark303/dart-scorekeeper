import { createHash, randomBytes } from "node:crypto";

import { eq } from "drizzle-orm";

import { leagueBoardDevices } from "@/lib/db/board-device-schema";
import { getDatabase } from "@/lib/db/client";
import { appMetadata } from "@/lib/db/schema";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PAIRING_PREFIX = "board-device-pair:";
const DEVICE_PAIRING_PREFIX = "board-device-pair-device:";

function noStoreJson(body: unknown, init?: ResponseInit) {
  const headers = new Headers(init?.headers);
  headers.set("Cache-Control", "no-store");
  return Response.json(body, { ...init, headers });
}

function issueDeviceKey(deviceId: string) {
  const secret = randomBytes(32).toString("base64url");
  const deviceKey = `dsk_${deviceId}.${secret}`;
  return {
    deviceKey,
    credentialHash: createHash("sha256")
      .update(deviceKey, "utf8")
      .digest("hex"),
  };
}

export async function POST(request: Request) {
  let input: { code?: string };
  try {
    input = await request.json();
  } catch {
    return noStoreJson({ error: "Invalid pairing request." }, { status: 400 });
  }

  const code = String(input.code ?? "").replace(/\D/g, "");
  if (!/^\d{6}$/.test(code)) {
    return noStoreJson(
      { error: "Enter the six-digit pairing code." },
      { status: 400 },
    );
  }

  const database = getDatabase();
  const pairKey = `${PAIRING_PREFIX}${code}`;
  const [pairing] = await database
    .select({ value: appMetadata.value })
    .from(appMetadata)
    .where(eq(appMetadata.key, pairKey))
    .limit(1);

  if (!pairing) {
    return noStoreJson(
      { error: "That pairing code is invalid or has already been used." },
      { status: 404 },
    );
  }

  let payload: { deviceId?: string; expiresAt?: number };
  try {
    payload = JSON.parse(pairing.value) as {
      deviceId?: string;
      expiresAt?: number;
    };
  } catch {
    payload = {};
  }

  if (
    !payload.deviceId ||
    typeof payload.expiresAt !== "number" ||
    payload.expiresAt <= Date.now()
  ) {
    await database.delete(appMetadata).where(eq(appMetadata.key, pairKey));
    if (payload.deviceId) {
      await database
        .delete(appMetadata)
        .where(
          eq(
            appMetadata.key,
            `${DEVICE_PAIRING_PREFIX}${payload.deviceId}`,
          ),
        );
    }
    return noStoreJson(
      { error: "That pairing code has expired. Create a new one." },
      { status: 410 },
    );
  }

  const [device] = await database
    .select({
      id: leagueBoardDevices.id,
      status: leagueBoardDevices.status,
    })
    .from(leagueBoardDevices)
    .where(eq(leagueBoardDevices.id, payload.deviceId))
    .limit(1);

  if (!device || device.status !== "active") {
    return noStoreJson(
      { error: "This board device is not available for pairing." },
      { status: 403 },
    );
  }

  const { deviceKey, credentialHash } = issueDeviceKey(device.id);
  const now = Date.now();

  await database.transaction(async (transaction) => {
    await transaction
      .update(leagueBoardDevices)
      .set({ credentialHash, updatedAt: now })
      .where(eq(leagueBoardDevices.id, device.id));
    await transaction.delete(appMetadata).where(eq(appMetadata.key, pairKey));
    await transaction
      .delete(appMetadata)
      .where(
        eq(appMetadata.key, `${DEVICE_PAIRING_PREFIX}${device.id}`),
      );
  });

  return noStoreJson({ deviceKey });
}
