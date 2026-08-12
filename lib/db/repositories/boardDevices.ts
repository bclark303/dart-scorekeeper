import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

import { and, desc, eq, inArray } from "drizzle-orm";

import type {
  BoardDeviceAssignmentSummary,
  BoardDeviceStatus,
  BoardDeviceSummary,
} from "@/lib/league/boardDeviceContracts";
import type { LeagueMatchDartInput, LeagueMatchSummary } from "@/lib/league/matchContracts";
import { getDatabase } from "../client";
import { leagueBoardDevices } from "../board-device-schema";
import {
  gameNightBoardPairings,
  gameNightBoards,
  gameNightTeams,
  gameNights,
} from "../game-night-schema";
import { leagueMatchSessions } from "../league-match-schema";
import { leagueMemberships, leagues, seasons } from "../schema";
import { LeaguePermissionError } from "./leagues";
import {
  getLeagueMatchAfterAuthorization,
  startLeagueMatchAfterAuthorization,
  submitLeagueMatchTurnAfterAuthorization,
  undoLastLeagueMatchTurnAfterAuthorization,
} from "./leagueMatches";

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

async function getActiveLeagueRole(leagueId: string, userId: string) {
  const [membership] = await getDatabase()
    .select({ role: leagueMemberships.role })
    .from(leagueMemberships)
    .where(
      and(
        eq(leagueMemberships.leagueId, leagueId),
        eq(leagueMemberships.userId, userId),
        eq(leagueMemberships.status, "active"),
      ),
    )
    .limit(1);
  return membership?.role ?? null;
}

async function requireLeagueAdmin(leagueId: string, userId: string) {
  const role = await getActiveLeagueRole(leagueId, userId);
  if (role !== "owner" && role !== "admin") throw new LeaguePermissionError();
}

async function getDeviceRow(deviceId: string) {
  const [row] = await getDatabase()
    .select({
      id: leagueBoardDevices.id,
      leagueId: leagueBoardDevices.leagueId,
      leagueName: leagues.name,
      name: leagueBoardDevices.name,
      boardNumber: leagueBoardDevices.boardNumber,
      status: leagueBoardDevices.status,
      credentialHash: leagueBoardDevices.credentialHash,
      createdByUserId: leagueBoardDevices.createdByUserId,
      lastSeenAt: leagueBoardDevices.lastSeenAt,
      createdAt: leagueBoardDevices.createdAt,
      updatedAt: leagueBoardDevices.updatedAt,
    })
    .from(leagueBoardDevices)
    .innerJoin(leagues, eq(leagueBoardDevices.leagueId, leagues.id))
    .where(eq(leagueBoardDevices.id, deviceId))
    .limit(1);
  return row ?? null;
}

function summarizeDevice(row: NonNullable<Awaited<ReturnType<typeof getDeviceRow>>>): BoardDeviceSummary {
  return {
    id: row.id,
    leagueId: row.leagueId,
    leagueName: row.leagueName,
    name: row.name,
    boardNumber: row.boardNumber,
    status: asStatus(row.status),
    lastSeenAt: row.lastSeenAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export async function listBoardDevicesForUser(
  leagueId: string,
  userId: string,
): Promise<BoardDeviceSummary[]> {
  await requireLeagueAdmin(leagueId, userId);
  const rows = await getDatabase()
    .select({ id: leagueBoardDevices.id })
    .from(leagueBoardDevices)
    .where(eq(leagueBoardDevices.leagueId, leagueId))
    .orderBy(leagueBoardDevices.boardNumber);

  const devices = await Promise.all(rows.map((row) => getDeviceRow(row.id)));
  return devices.filter((row): row is NonNullable<typeof row> => Boolean(row)).map(summarizeDevice);
}

export async function registerBoardDeviceForUser(input: {
  id?: string;
  leagueId: string;
  userId: string;
  name: string;
  boardNumber: number;
  now?: number;
}): Promise<{ device: BoardDeviceSummary; deviceKey: string }> {
  await requireLeagueAdmin(input.leagueId, input.userId);
  const name = input.name.trim();
  if (!name || name.length > 80) throw new Error("Device name must be 1-80 characters.");
  if (!Number.isInteger(input.boardNumber) || input.boardNumber < 1 || input.boardNumber > 32) {
    throw new Error("Board number must be from 1 to 32.");
  }

  const id = input.id ?? crypto.randomUUID();
  const { deviceKey, credentialHash } = issueDeviceKey(id);
  const now = input.now ?? Date.now();
  await getDatabase().insert(leagueBoardDevices).values({
    id,
    leagueId: input.leagueId,
    name,
    boardNumber: input.boardNumber,
    status: "active",
    credentialHash,
    createdByUserId: input.userId,
    lastSeenAt: null,
    createdAt: now,
    updatedAt: now,
  });

  const row = await getDeviceRow(id);
  if (!row) throw new Error("Registered board device could not be reloaded.");
  return { device: summarizeDevice(row), deviceKey };
}

export async function updateBoardDeviceForUser(input: {
  deviceId: string;
  userId: string;
  name?: string;
  boardNumber?: number;
  status?: BoardDeviceStatus;
  now?: number;
}): Promise<BoardDeviceSummary> {
  const existing = await getDeviceRow(input.deviceId);
  if (!existing) throw new Error("Board device was not found.");
  await requireLeagueAdmin(existing.leagueId, input.userId);

  const name = input.name === undefined ? existing.name : input.name.trim();
  const boardNumber = input.boardNumber ?? existing.boardNumber;
  const status = input.status ?? asStatus(existing.status);
  if (!name || name.length > 80) throw new Error("Device name must be 1-80 characters.");
  if (!Number.isInteger(boardNumber) || boardNumber < 1 || boardNumber > 32) {
    throw new Error("Board number must be from 1 to 32.");
  }
  if (status !== "active" && status !== "disabled") throw new Error("Invalid device status.");

  await getDatabase()
    .update(leagueBoardDevices)
    .set({ name, boardNumber, status, updatedAt: input.now ?? Date.now() })
    .where(eq(leagueBoardDevices.id, input.deviceId));
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
  await requireLeagueAdmin(existing.leagueId, input.userId);

  const { deviceKey, credentialHash } = issueDeviceKey(input.deviceId);
  await getDatabase()
    .update(leagueBoardDevices)
    .set({ credentialHash, updatedAt: input.now ?? Date.now() })
    .where(eq(leagueBoardDevices.id, input.deviceId));
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
    .update(leagueBoardDevices)
    .set({ lastSeenAt: now })
    .where(eq(leagueBoardDevices.id, row.id));
  return { ...summarizeDevice(row), lastSeenAt: now };
}

export async function getBoardDeviceAssignment(
  device: BoardDeviceSummary,
): Promise<BoardDeviceAssignmentSummary | null> {
  const rows = await getDatabase()
    .select({
      gameNightId: gameNights.id,
      gameNightName: gameNights.name,
      gameNightStatus: gameNights.status,
      scheduledAt: gameNights.scheduledAt,
      boardId: gameNightBoards.id,
      boardName: gameNightBoards.name,
      boardNumber: gameNightBoards.boardNumber,
      pairingId: gameNightBoardPairings.id,
      teamAId: gameNightBoardPairings.teamAId,
      teamBId: gameNightBoardPairings.teamBId,
      matchSessionId: leagueMatchSessions.id,
      matchStatus: leagueMatchSessions.status,
    })
    .from(gameNights)
    .innerJoin(seasons, eq(gameNights.seasonId, seasons.id))
    .innerJoin(
      gameNightBoards,
      and(
        eq(gameNightBoards.gameNightId, gameNights.id),
        eq(gameNightBoards.boardNumber, device.boardNumber),
      ),
    )
    .leftJoin(
      gameNightBoardPairings,
      and(
        eq(gameNightBoardPairings.gameNightId, gameNights.id),
        eq(gameNightBoardPairings.boardId, gameNightBoards.id),
        eq(gameNightBoardPairings.roundNumber, 1),
      ),
    )
    .leftJoin(leagueMatchSessions, eq(leagueMatchSessions.pairingId, gameNightBoardPairings.id))
    .where(
      and(
        eq(seasons.leagueId, device.leagueId),
        inArray(gameNights.status, ["ready", "active"]),
      ),
    )
    .orderBy(desc(gameNights.scheduledAt));

  if (!rows.length) return null;
  const row = rows.find((item) => item.gameNightStatus === "active") ?? rows[0];
  let teamAName: string | null = null;
  let teamBName: string | null = null;
  if (row.teamAId) {
    const [team] = await getDatabase()
      .select({ name: gameNightTeams.name })
      .from(gameNightTeams)
      .where(eq(gameNightTeams.id, row.teamAId))
      .limit(1);
    teamAName = team?.name ?? null;
  }
  if (row.teamBId) {
    const [team] = await getDatabase()
      .select({ name: gameNightTeams.name })
      .from(gameNightTeams)
      .where(eq(gameNightTeams.id, row.teamBId))
      .limit(1);
    teamBName = team?.name ?? null;
  }

  const matchStatus =
    row.matchStatus === "active" || row.matchStatus === "completed"
      ? row.matchStatus
      : row.matchSessionId
        ? "scheduled"
        : null;

  return {
    gameNightId: row.gameNightId,
    gameNightName: row.gameNightName,
    gameNightStatus: row.gameNightStatus,
    scheduledAt: row.scheduledAt,
    boardId: row.boardId,
    boardName: row.boardName,
    boardNumber: row.boardNumber,
    matchSessionId: row.matchSessionId,
    matchStatus,
    teamAName,
    teamBName,
  };
}

async function requireAssignedMatch(deviceKey: string, matchId: string) {
  const device = await authenticateBoardDeviceCredential(deviceKey);
  const assignment = await getBoardDeviceAssignment(device);
  if (!assignment?.matchSessionId) {
    throw new BoardDeviceAssignmentError("This board does not currently have a match assignment.");
  }
  if (assignment.matchSessionId !== matchId) {
    throw new BoardDeviceAssignmentError("That match is not assigned to this board device.");
  }
  return { device, assignment };
}

export async function getBoardDeviceConnectionForCredential(deviceKey: string): Promise<{
  device: BoardDeviceSummary;
  assignment: BoardDeviceAssignmentSummary | null;
  match: LeagueMatchSummary | null;
}> {
  const device = await authenticateBoardDeviceCredential(deviceKey);
  const assignment = await getBoardDeviceAssignment(device);
  const match = assignment?.matchSessionId
    ? await getLeagueMatchAfterAuthorization(assignment.matchSessionId)
    : null;
  return { device, assignment, match };
}

export async function getBoardDeviceMatchForCredential(
  deviceKey: string,
  matchId: string,
): Promise<LeagueMatchSummary> {
  await requireAssignedMatch(deviceKey, matchId);
  return getLeagueMatchAfterAuthorization(matchId);
}

export async function startBoardDeviceMatchForCredential(
  deviceKey: string,
  matchId: string,
): Promise<LeagueMatchSummary> {
  await requireAssignedMatch(deviceKey, matchId);
  return startLeagueMatchAfterAuthorization(matchId);
}

export async function submitBoardDeviceTurnForCredential(input: {
  deviceKey: string;
  matchId: string;
  turnId: string;
  scoreEntered: number;
  dartsThrown: 1 | 2 | 3;
  checkoutConfirmed?: boolean;
  darts?: LeagueMatchDartInput[];
}): Promise<LeagueMatchSummary> {
  await requireAssignedMatch(input.deviceKey, input.matchId);
  return submitLeagueMatchTurnAfterAuthorization({
    matchId: input.matchId,
    turnId: input.turnId,
    scoreEntered: input.scoreEntered,
    dartsThrown: input.dartsThrown,
    checkoutConfirmed: input.checkoutConfirmed,
    darts: input.darts,
  });
}

export async function undoBoardDeviceTurnForCredential(
  deviceKey: string,
  matchId: string,
): Promise<LeagueMatchSummary> {
  await requireAssignedMatch(deviceKey, matchId);
  return undoLastLeagueMatchTurnAfterAuthorization(matchId);
}
