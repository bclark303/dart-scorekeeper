import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

import { asc, eq } from "drizzle-orm";

import type {
  BoardDeviceStatus,
  BoardDeviceSummary,
  VenueHardwareResponse,
} from "@/lib/league/boardDeviceContracts";
import { boardDevices } from "../board-device-schema";
import { getDatabase } from "../client";
import { physicalBoards, venues } from "../venue-schema";
import {
  bootstrapEmptyVenueBoards,
  getDefaultVenueForLeagueForUser,
  listAdminVenuesForUser,
  listPhysicalBoardsForVenueForUser,
  listVenuesForLeagueForUser,
  requireLeagueAdminForVenueAccess,
  requireVenueAdminForUser,
  requireVenueLinkedToLeague,
} from "./venueHardware";

export class BoardDeviceCredentialError extends Error {
  readonly reason: "invalid" | "disabled";

  constructor(message: string, reason: "invalid" | "disabled" = "invalid") {
    super(message);
    this.name = "BoardDeviceCredentialError";
    this.reason = reason;
  }
}

export class BoardDeviceAssignmentError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BoardDeviceAssignmentError";
  }
}

function asStatus(value: string): BoardDeviceStatus {
  if (value === "active" || value === "disabled") return value;
  throw new Error(`Unsupported board device status: ${value}`);
}

function hashDeviceKey(value: string) {
  return createHash("sha256").update(value, "utf8").digest();
}

function issueDeviceKey(deviceId: string) {
  const secret = randomBytes(32).toString("base64url");
  const deviceKey = `dsk_${deviceId}.${secret}`;
  return {
    deviceKey,
    credentialHash: hashDeviceKey(deviceKey).toString("hex"),
  };
}

function parseDeviceId(deviceKey: string) {
  if (!deviceKey.startsWith("dsk_")) return null;
  const separator = deviceKey.indexOf(".", 4);
  if (separator <= 4) return null;
  const id = deviceKey.slice(4, separator);
  return id || null;
}

function credentialMatches(deviceKey: string, storedHex: string) {
  try {
    const actual = hashDeviceKey(deviceKey);
    const expected = Buffer.from(storedHex, "hex");
    return actual.length === expected.length && timingSafeEqual(actual, expected);
  } catch {
    return false;
  }
}

async function getDeviceRow(deviceId: string) {
  const [row] = await getDatabase()
    .select({
      id: boardDevices.id,
      venueId: boardDevices.venueId,
      venueName: venues.name,
      physicalBoardId: boardDevices.physicalBoardId,
      boardNumber: physicalBoards.boardNumber,
      boardName: physicalBoards.name,
      name: boardDevices.name,
      status: boardDevices.status,
      credentialHash: boardDevices.credentialHash,
      createdByUserId: boardDevices.createdByUserId,
      lastSeenAt: boardDevices.lastSeenAt,
      createdAt: boardDevices.createdAt,
      updatedAt: boardDevices.updatedAt,
    })
    .from(boardDevices)
    .innerJoin(venues, eq(boardDevices.venueId, venues.id))
    .leftJoin(physicalBoards, eq(boardDevices.physicalBoardId, physicalBoards.id))
    .where(eq(boardDevices.id, deviceId))
    .limit(1);
  return row ?? null;
}

function summarizeDevice(
  row: NonNullable<Awaited<ReturnType<typeof getDeviceRow>>>,
): BoardDeviceSummary {
  return {
    id: row.id,
    venueId: row.venueId,
    venueName: row.venueName,
    name: row.name,
    physicalBoardId: row.physicalBoardId,
    boardNumber: row.boardNumber ?? null,
    boardName: row.boardName ?? null,
    status: asStatus(row.status),
    lastSeenAt: row.lastSeenAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

async function physicalBoardForInput(input: {
  venueId: string;
  physicalBoardId?: string | null;
  boardNumber?: number;
}) {
  if (input.physicalBoardId === null) return null;
  if (input.physicalBoardId) {
    const [board] = await getDatabase()
      .select()
      .from(physicalBoards)
      .where(eq(physicalBoards.id, input.physicalBoardId))
      .limit(1);
    if (!board || board.venueId !== input.venueId) {
      throw new Error("The selected physical board does not belong to this venue.");
    }
    return board;
  }
  if (input.boardNumber !== undefined) {
    let boards = await getDatabase()
      .select()
      .from(physicalBoards)
      .where(eq(physicalBoards.venueId, input.venueId))
      .orderBy(asc(physicalBoards.boardNumber));
    let match = boards.find((candidate) => candidate.boardNumber === input.boardNumber);
    if (!match && input.boardNumber > 0) {
      // Compatibility for pre-alpha.12 clients: an auto-managed venue can grow
      // when a scorer is registered by board number. Explicitly managed venues
      // never invent a physical board and will still fail below.
      boards = await bootstrapEmptyVenueBoards(input.venueId, input.boardNumber);
      match = boards.find((candidate) => candidate.boardNumber === input.boardNumber);
    }
    if (!match) throw new Error(`Board ${input.boardNumber} is not configured at this venue.`);
    return match;
  }
  return undefined;
}

async function assignDeviceToBoard(deviceId: string, physicalBoardId: string | null, now: number) {
  await getDatabase().transaction(async (tx) => {
    if (physicalBoardId) {
      // A physical board can have only one scorer. Selecting a replacement is
      // intentionally a swap: the old device becomes an available spare.
      await tx
        .update(boardDevices)
        .set({ physicalBoardId: null, updatedAt: now })
        .where(eq(boardDevices.physicalBoardId, physicalBoardId));
    }
    await tx
      .update(boardDevices)
      .set({ physicalBoardId, updatedAt: now })
      .where(eq(boardDevices.id, deviceId));
  });
}

export async function getVenueHardwareForUser(input: {
  leagueId: string;
  userId: string;
  venueId?: string | null;
}): Promise<VenueHardwareResponse> {
  await requireLeagueAdminForVenueAccess(input.leagueId, input.userId);
  const [linkedVenues, adminVenues] = await Promise.all([
    listVenuesForLeagueForUser(input.leagueId, input.userId),
    listAdminVenuesForUser(input.userId),
  ]);
  const linkedIds = new Set(linkedVenues.map((item) => item.id));
  const availableVenues = adminVenues.filter((item) => !linkedIds.has(item.id));
  const venue = input.venueId
    ? linkedVenues.find((candidate) => candidate.id === input.venueId) ?? null
    : await getDefaultVenueForLeagueForUser(input.leagueId, input.userId);
  if (!venue) throw new Error("This league does not have a venue configured.");
  await requireVenueLinkedToLeague(input.leagueId, venue.id);
  const [boards, rows] = await Promise.all([
    listPhysicalBoardsForVenueForUser({
      leagueId: input.leagueId,
      venueId: venue.id,
      userId: input.userId,
    }),
    getDatabase()
      .select({ id: boardDevices.id })
      .from(boardDevices)
      .where(eq(boardDevices.venueId, venue.id))
      .orderBy(asc(boardDevices.name)),
  ]);
  const devices = await Promise.all(rows.map((row) => getDeviceRow(row.id)));
  return {
    venues: linkedVenues,
    availableVenues,
    venue,
    boards,
    devices: devices
      .filter((row): row is NonNullable<typeof row> => Boolean(row))
      .map(summarizeDevice),
  };
}

/** Compatibility helper: league selects an accessible venue, not device ownership. */
export async function listBoardDevicesForUser(
  leagueId: string,
  userId: string,
): Promise<BoardDeviceSummary[]> {
  const hardware = await getVenueHardwareForUser({ leagueId, userId });
  return hardware.devices ?? [];
}

export async function registerBoardDeviceForUser(input: {
  id?: string;
  leagueId: string;
  venueId?: string;
  userId: string;
  name: string;
  physicalBoardId?: string | null;
  boardNumber?: number;
  now?: number;
}): Promise<{ device: BoardDeviceSummary; deviceKey: string }> {
  await requireLeagueAdminForVenueAccess(input.leagueId, input.userId);
  const venue = input.venueId
    ? (await listVenuesForLeagueForUser(input.leagueId, input.userId)).find(
        (candidate) => candidate.id === input.venueId,
      ) ?? null
    : await getDefaultVenueForLeagueForUser(input.leagueId, input.userId);
  if (!venue) throw new Error("This league does not have a venue configured.");
  await requireVenueLinkedToLeague(input.leagueId, venue.id);
  await requireVenueAdminForUser(venue.id, input.userId);

  const name = input.name.trim();
  if (!name || name.length > 80) throw new Error("Device name must be 1-80 characters.");
  const board = await physicalBoardForInput({
    venueId: venue.id,
    physicalBoardId: input.physicalBoardId,
    boardNumber: input.boardNumber,
  });

  const id = input.id ?? crypto.randomUUID();
  const { deviceKey, credentialHash } = issueDeviceKey(id);
  const now = input.now ?? Date.now();
  await getDatabase().insert(boardDevices).values({
    id,
    venueId: venue.id,
    physicalBoardId: null,
    name,
    status: "active",
    credentialHash,
    createdByUserId: input.userId,
    lastSeenAt: null,
    createdAt: now,
    updatedAt: now,
  });
  if (board) await assignDeviceToBoard(id, board.id, now);

  const row = await getDeviceRow(id);
  if (!row) throw new Error("Registered board device could not be reloaded.");
  return { device: summarizeDevice(row), deviceKey };
}

export async function updateBoardDeviceForUser(input: {
  deviceId: string;
  userId: string;
  name?: string;
  physicalBoardId?: string | null;
  boardNumber?: number;
  status?: BoardDeviceStatus;
  now?: number;
}): Promise<BoardDeviceSummary> {
  const existing = await getDeviceRow(input.deviceId);
  if (!existing) throw new Error("Board device was not found.");
  await requireVenueAdminForUser(existing.venueId, input.userId);

  const name = input.name === undefined ? existing.name : input.name.trim();
  const status = input.status ?? asStatus(existing.status);
  if (!name || name.length > 80) throw new Error("Device name must be 1-80 characters.");
  if (status !== "active" && status !== "disabled") throw new Error("Invalid device status.");

  const boardInputProvided =
    Object.prototype.hasOwnProperty.call(input, "physicalBoardId") || input.boardNumber !== undefined;
  const board = boardInputProvided
    ? await physicalBoardForInput({
        venueId: existing.venueId,
        physicalBoardId: input.physicalBoardId,
        boardNumber: input.boardNumber,
      })
    : undefined;
  const now = input.now ?? Date.now();
  await getDatabase()
    .update(boardDevices)
    .set({ name, status, updatedAt: now })
    .where(eq(boardDevices.id, input.deviceId));
  if (boardInputProvided) {
    await assignDeviceToBoard(input.deviceId, board?.id ?? null, now);
  }

  const row = await getDeviceRow(input.deviceId);
  if (!row) throw new Error("Updated board device could not be reloaded.");
  return summarizeDevice(row);
}

export async function rotateBoardDeviceKeyForUser(input: {
  deviceId: string;
  userId: string;
  now?: number;
}): Promise<{ device: BoardDeviceSummary; deviceKey: string }> {
  const existing = await getDeviceRow(input.deviceId);
  if (!existing) throw new Error("Board device was not found.");
  await requireVenueAdminForUser(existing.venueId, input.userId);

  const { deviceKey, credentialHash } = issueDeviceKey(input.deviceId);
  await getDatabase()
    .update(boardDevices)
    .set({ credentialHash, updatedAt: input.now ?? Date.now() })
    .where(eq(boardDevices.id, input.deviceId));
  const row = await getDeviceRow(input.deviceId);
  if (!row) throw new Error("Rotated board device could not be reloaded.");
  return { device: summarizeDevice(row), deviceKey };
}

export async function authenticateBoardDeviceCredential(
  deviceKey: string,
): Promise<BoardDeviceSummary> {
  const deviceId = parseDeviceId(deviceKey);
  if (!deviceId) throw new BoardDeviceCredentialError("Invalid board device key.");
  const row = await getDeviceRow(deviceId);
  if (!row || !credentialMatches(deviceKey, row.credentialHash)) {
    throw new BoardDeviceCredentialError("Invalid board device key.");
  }
  if (row.status !== "active") {
    throw new BoardDeviceCredentialError("This board device has been disabled.", "disabled");
  }

  const now = Date.now();
  await getDatabase()
    .update(boardDevices)
    .set({ lastSeenAt: now })
    .where(eq(boardDevices.id, row.id));
  return { ...summarizeDevice(row), lastSeenAt: now };
}
