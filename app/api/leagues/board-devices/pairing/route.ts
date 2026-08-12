import { randomInt } from "node:crypto";

import { and, eq } from "drizzle-orm";

import { getRequestSession } from "@/lib/auth/server";
import { leagueBoardDevices } from "@/lib/db/board-device-schema";
import { getDatabase } from "@/lib/db/client";
import { appMetadata, leagueMemberships } from "@/lib/db/schema";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PAIRING_TTL_MS = 10 * 60 * 1000;
const PAIRING_PREFIX = "board-device-pair:";
const DEVICE_PAIRING_PREFIX = "board-device-pair-device:";

function noStoreJson(body: unknown, init?: ResponseInit) {
  const headers = new Headers(init?.headers);
  headers.set("Cache-Control", "no-store");
  return Response.json(body, { ...init, headers });
}

async function deleteMetadata(key: string) {
  await getDatabase().delete(appMetadata).where(eq(appMetadata.key, key));
}

async function setMetadata(key: string, value: string) {
  await getDatabase()
    .insert(appMetadata)
    .values({ key, value, updatedAt: Date.now() })
    .onConflictDoUpdate({
      target: appMetadata.key,
      set: { value, updatedAt: Date.now() },
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

export async function POST(request: Request) {
  let session;
  try {
    session = await getRequestSession(request);
  } catch (error) {
    console.error("Authentication service unavailable during device pairing.", error);
    return noStoreJson(
      { error: "Account service is unavailable." },
      { status: 503 },
    );
  }

  if (!session?.user) {
    return noStoreJson({ error: "Authentication required." }, { status: 401 });
  }

  let input: { deviceId?: string };
  try {
    input = await request.json();
  } catch {
    return noStoreJson({ error: "Invalid pairing request." }, { status: 400 });
  }

  if (!input.deviceId) {
    return noStoreJson({ error: "deviceId is required." }, { status: 400 });
  }

  const database = getDatabase();
  const [device] = await database
    .select({
      id: leagueBoardDevices.id,
      leagueId: leagueBoardDevices.leagueId,
      status: leagueBoardDevices.status,
    })
    .from(leagueBoardDevices)
    .where(eq(leagueBoardDevices.id, input.deviceId))
    .limit(1);

  if (!device) {
    return noStoreJson({ error: "Board device was not found." }, { status: 404 });
  }

  const [membership] = await database
    .select({ role: leagueMemberships.role })
    .from(leagueMemberships)
    .where(
      and(
        eq(leagueMemberships.leagueId, device.leagueId),
        eq(leagueMemberships.userId, session.user.id),
        eq(leagueMemberships.status, "active"),
      ),
    )
    .limit(1);

  if (!membership || !["owner", "admin"].includes(membership.role)) {
    return noStoreJson(
      { error: "League administrator permission is required." },
      { status: 403 },
    );
  }

  if (device.status !== "active") {
    return noStoreJson(
      { error: "Enable the board device before pairing it." },
      { status: 400 },
    );
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

  const code = await issueUniqueCode();
  const expiresAt = Date.now() + PAIRING_TTL_MS;

  await setMetadata(
    `${PAIRING_PREFIX}${code}`,
    JSON.stringify({ deviceId: device.id, expiresAt }),
  );
  await setMetadata(devicePairingKey, code);

  return noStoreJson({ code, expiresAt });
}
