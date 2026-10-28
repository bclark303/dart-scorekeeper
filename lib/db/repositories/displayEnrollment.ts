import { createHash, randomBytes, randomInt, timingSafeEqual } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { getDatabase } from "@/lib/db/client";
import { appMetadata } from "@/lib/db/schema";
import { physicalBoards } from "@/lib/db/venue-schema";
import { requireVenueAdminForUser } from "@/lib/db/repositories/venueHardware";
import { getBoardDeviceAssignment } from "@/lib/db/repositories/fixtureBoardDevices";
import { getLeagueMatchAfterAuthorization } from "@/lib/db/repositories/leagueMatches";

const TTL = 5 * 60 * 1000;
const key = (id: string) => `display-enroll:${id}`;
const hash = (value: string) => createHash("sha256").update(value).digest("hex");
const equal = (a: string, b: string) => {
  const aa = Buffer.from(a, "hex"), bb = Buffer.from(b, "hex");
  return aa.length === bb.length && timingSafeEqual(aa, bb);
};
type Enrollment = { pin: string; verifierHash: string; expiresAt: number; credential?: string; deviceId?: string };
type Registration = { id: string; venueId: string; physicalBoardId: string | null; name: string; credentialHash: string; status: "active" | "disabled"; updatedAt: number };
const registrationKey = (id: string) => `display-device:${id}`;

async function load<T>(name: string): Promise<T | null> {
  const [row] = await getDatabase().select({ value: appMetadata.value }).from(appMetadata).where(eq(appMetadata.key, name)).limit(1);
  if (!row) return null;
  try { return JSON.parse(row.value) as T; } catch { return null; }
}
async function save(name: string, value: unknown) {
  const now = Date.now();
  await getDatabase().insert(appMetadata).values({ key: name, value: JSON.stringify(value), updatedAt: now })
    .onConflictDoUpdate({ target: appMetadata.key, set: { value: JSON.stringify(value), updatedAt: now } });
}

export async function beginDisplayEnrollment() {
  const requestId = randomBytes(16).toString("hex");
  const verifier = randomBytes(32).toString("base64url");
  const pin = String(randomInt(0, 1_000_000)).padStart(6, "0");
  const expiresAt = Date.now() + TTL;
  await save(key(requestId), { pin, verifierHash: hash(verifier), expiresAt } satisfies Enrollment);
  return { requestId, verifier, pin, expiresAt };
}

export async function pollDisplayEnrollment(requestId: string, verifier: string) {
  if (!/^[a-f0-9]{32}$/.test(requestId)) throw new Error("Invalid registration request.");
  const enrollment = await load<Enrollment>(key(requestId));
  if (!enrollment || !equal(hash(verifier), enrollment.verifierHash)) throw new Error("Registration request not found.");
  if (enrollment.expiresAt <= Date.now()) throw new Error("Pairing PIN expired.");
  if (!enrollment.credential) return { status: "pending" as const };
  // Deliver credential only to the display holding the 256-bit verifier, never to the administrator.
  return { status: "paired" as const, credential: enrollment.credential };
}

export async function claimDisplayEnrollment(input: { pin: string; userId: string; venueId: string; physicalBoardId: string; name: string }) {
  if (!/^\d{6}$/.test(input.pin)) throw new Error("Enter a six-digit PIN.");
  await requireVenueAdminForUser(input.venueId, input.userId);
  const [board] = await getDatabase().select({ id: physicalBoards.id }).from(physicalBoards)
    .where(and(eq(physicalBoards.id, input.physicalBoardId), eq(physicalBoards.venueId, input.venueId))).limit(1);
  if (!board) throw new Error("Selected board is not in the venue.");
  const name = input.name.trim();
  if (!name || name.length > 80) throw new Error("Display name must be 1–80 characters.");
  const now = Date.now();
  const candidates = await getDatabase().select({ key: appMetadata.key, value: appMetadata.value }).from(appMetadata);
  const pending = candidates.flatMap(row => {
    if (!row.key.startsWith("display-enroll:")) return [];
    try { const entry = JSON.parse(row.value) as Enrollment;
      return entry.pin === input.pin && entry.expiresAt > now && !entry.credential ? [{ key: row.key, entry }] : [];
    } catch { return []; }
  });
  if (pending.length !== 1) throw new Error("PIN missing, expired, or ambiguous. Restart pairing.");
  const { key: pendingKey, entry } = pending[0];
  const id = randomBytes(16).toString("hex");
  const credential = `dsd_${id}.${randomBytes(32).toString("base64url")}`;
  const device: Registration = { id, venueId: input.venueId, physicalBoardId: board.id, name, credentialHash: hash(credential), status: "active", updatedAt: now };
  await getDatabase().transaction(async tx => {
    const [latest] = await tx.select({ value: appMetadata.value }).from(appMetadata).where(eq(appMetadata.key, pendingKey)).limit(1);
    if (!latest || latest.value !== JSON.stringify(entry)) throw new Error("Pairing was already claimed.");
    await tx.insert(appMetadata).values({ key: registrationKey(id), value: JSON.stringify(device), updatedAt: now });
    const claimed = await tx.update(appMetadata).set({ value: JSON.stringify({ ...entry, credential, deviceId: id }), updatedAt: now })
      .where(and(eq(appMetadata.key, pendingKey), eq(appMetadata.value, latest.value)));
    if (claimed.rowsAffected !== 1) throw new Error("Pairing was already claimed.");
  });
  return { id, name, physicalBoardId: board.id };
}

export async function displayConnection(credential: string) {
  const match = /^dsd_([a-f0-9]{32})\.[A-Za-z0-9_-]{20,}$/.exec(credential);
  if (!match) throw new Error("Invalid display credential.");
  const device = await load<Registration>(registrationKey(match[1]));
  if (!device || device.status !== "active" || !equal(hash(credential), device.credentialHash)) throw new Error("Display not registered.");
  if (!device.physicalBoardId) return { display: { id: device.id, name: device.name, boardNumber: null, boardName: null }, assignment: null, match: null };\n  const board = await getDatabase().select().from(physicalBoards).where(eq(physicalBoards.id, device.physicalBoardId)).limit(1);
  if (!board[0] || board[0].venueId !== device.venueId) throw new Error("Display board is unavailable.");
  // Existing assignment resolver accepts a board-bound device summary; this path performs reads only.
  const assignment = await getBoardDeviceAssignment({
    id: device.id, venueId: device.venueId, venueName: "", name: device.name,
    physicalBoardId: device.physicalBoardId, boardNumber: board[0].boardNumber,
    boardName: board[0].name, status: "active", lastSeenAt: null, createdAt: device.updatedAt, updatedAt: device.updatedAt,
  });
  const currentMatch = assignment?.matchSessionId ? await getLeagueMatchAfterAuthorization(assignment.matchSessionId) : null;
  return { display: { id: device.id, name: device.name, boardNumber: board[0].boardNumber, boardName: board[0].name },
    assignment, match: currentMatch };
}

export type ManagedDisplay = {
  id: string; name: string; venueId: string; physicalBoardId: string | null;
  status: "active" | "disabled"; updatedAt: number;
};

export async function listDisplaysForVenue(input: { venueId: string; userId: string }) {
  await requireVenueAdminForUser(input.venueId, input.userId);
  const rows = await getDatabase().select({ key: appMetadata.key, value: appMetadata.value }).from(appMetadata);
  return rows.flatMap((row): ManagedDisplay[] => {
    if (!row.key.startsWith("display-device:")) return [];
    try {
      const device = JSON.parse(row.value) as Registration;
      return device.venueId === input.venueId ? [{
        id: device.id, name: device.name, venueId: device.venueId,
        physicalBoardId: device.physicalBoardId, status: device.status, updatedAt: device.updatedAt,
      }] : [];
    } catch { return []; }
  }).sort((a,b)=>a.name.localeCompare(b.name));
}

export async function updateDisplayForUser(input: {
  id: string; userId: string; venueId: string;
  physicalBoardId?: string | null; status?: "active" | "disabled";
}) {
  await requireVenueAdminForUser(input.venueId, input.userId);
  const current = await load<Registration>(registrationKey(input.id));
  if (!current || current.venueId !== input.venueId) throw new Error("Display not found at this venue.");
  let physicalBoardId = current.physicalBoardId;
  if (input.physicalBoardId !== undefined) {
    physicalBoardId = input.physicalBoardId;
    if (physicalBoardId !== null) {
      const [board] = await getDatabase().select({ id: physicalBoards.id }).from(physicalBoards)
        .where(and(eq(physicalBoards.id, physicalBoardId), eq(physicalBoards.venueId, input.venueId))).limit(1);
      if (!board) throw new Error("Board does not belong to this venue.");
    }
  }
  const updated = { ...current, physicalBoardId, status: input.status ?? current.status, updatedAt: Date.now() };
  await save(registrationKey(input.id), updated);
  return { id: updated.id, name: updated.name, venueId: updated.venueId,
    physicalBoardId: updated.physicalBoardId, status: updated.status, updatedAt: updated.updatedAt };
}
