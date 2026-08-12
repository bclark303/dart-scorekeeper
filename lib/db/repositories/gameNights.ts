import { and, asc, eq, inArray } from "drizzle-orm";

import type {
  BoardRotationType,
  DummyPlayerMode,
  GameNightAttendanceStatus,
  GameNightDuesStatus,
  GameNightFinishRule,
  GameNightSettingsSummary,
  GameNightStatus,
  GameNightSummary,
  TeamCreationMode,
} from "@/lib/league/gameNightContracts";
import { dummyTargetSizeForTeams } from "@/lib/league/dummyTeamBalance";
import { getDatabase } from "../client";
import {
  gameNightAttendance,
  gameNightBoardPairings,
  gameNightBoards,
  gameNightSettings,
  gameNightTeamMembers,
  gameNightTeams,
  gameNights,
} from "../game-night-schema";
import { leaguePlayers, seasonRosterEntries } from "../league-schema";
import { leagueMatchSessions } from "../league-match-schema";
import { leagueMemberships, players, seasons } from "../schema";
import { LeaguePermissionError } from "./leagues";

export type CreateGameNightForUserInput = {
  id: string;
  leagueId: string;
  seasonId: string;
  userId: string;
  name: string;
  scheduledAt: number;
  settings: GameNightSettingsSummary;
  now?: number;
};

export type UpdateGameNightSettingsForUserInput = {
  gameNightId: string;
  userId: string;
  settings: GameNightSettingsSummary;
  now?: number;
};

export type UpdateGameNightAttendanceForUserInput = {
  attendanceId?: string;
  gameNightId: string;
  leaguePlayerId: string;
  userId: string;
  checkedIn: boolean;
  duesStatus: GameNightDuesStatus;
  now?: number;
};

function asGameNightStatus(value: string): GameNightStatus {
  if (
    value === "draft" ||
    value === "checkin" ||
    value === "ready" ||
    value === "active" ||
    value === "completed" ||
    value === "cancelled"
  ) return value;
  throw new Error(`Unsupported game-night status: ${value}`);
}

function asTeamCreationMode(value: string): TeamCreationMode {
  if (value === "manual" || value === "automatic" || value === "hybrid") return value;
  throw new Error(`Unsupported team creation mode: ${value}`);
}

function asDummyPlayerMode(value: string): DummyPlayerMode {
  if (value === "none" || value === "allow" || value === "fill" || value === "balance") return value;
  throw new Error(`Unsupported dummy player mode: ${value}`);
}

function asBoardRotationType(value: string): BoardRotationType {
  if (value === "fixed" || value === "rotate" || value === "manual") return value;
  throw new Error(`Unsupported board rotation type: ${value}`);
}

function asFinishRule(value: string): GameNightFinishRule {
  if (value === "straight" || value === "double") return value;
  throw new Error(`Unsupported finish rule: ${value}`);
}

function asAttendanceStatus(value: string): GameNightAttendanceStatus {
  if (value === "absent" || value === "checked_in") return value;
  throw new Error(`Unsupported attendance status: ${value}`);
}

function asDuesStatus(value: string): GameNightDuesStatus {
  if (value === "unpaid" || value === "paid" || value === "waived") return value;
  throw new Error(`Unsupported dues status: ${value}`);
}

function settingsFromRow(row: typeof gameNightSettings.$inferSelect): GameNightSettingsSummary {
  return {
    teamCreationMode: asTeamCreationMode(row.teamCreationMode),
    targetTeamCount: row.targetTeamCount,
    minTeamPlayers: row.minTeamPlayers,
    maxTeamPlayers: row.maxTeamPlayers,
    dummyPlayerMode: asDummyPlayerMode(row.dummyPlayerMode),
    dummyScore: row.dummyScore,
    boardCount: row.boardCount,
    boardRotationType: asBoardRotationType(row.boardRotationType),
    legsPerMatch: row.legsPerMatch,
    startingScore: row.startingScore,
    finishRule: asFinishRule(row.finishRule),
  };
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

async function requireLeagueMember(leagueId: string, userId: string) {
  const role = await getActiveLeagueRole(leagueId, userId);
  if (!role) throw new LeaguePermissionError("League membership is required.");
  return role;
}

async function requireLeagueAdmin(leagueId: string, userId: string) {
  const role = await requireLeagueMember(leagueId, userId);
  if (role !== "owner" && role !== "admin") throw new LeaguePermissionError();
}

async function getGameNightContext(gameNightId: string) {
  const [row] = await getDatabase()
    .select({
      gameNightId: gameNights.id,
      leagueId: seasons.leagueId,
      seasonId: gameNights.seasonId,
    })
    .from(gameNights)
    .innerJoin(seasons, eq(gameNights.seasonId, seasons.id))
    .where(eq(gameNights.id, gameNightId))
    .limit(1);
  if (!row) throw new Error("Game night was not found.");
  return row;
}

async function resetBoards(gameNightId: string, boardCount: number, now: number) {
  await getDatabase().delete(gameNightBoardPairings).where(eq(gameNightBoardPairings.gameNightId, gameNightId));
  await getDatabase().delete(gameNightBoards).where(eq(gameNightBoards.gameNightId, gameNightId));
  if (boardCount > 0) {
    await getDatabase().insert(gameNightBoards).values(
      Array.from({ length: boardCount }, (_, index) => ({
        id: crypto.randomUUID(),
        gameNightId,
        boardNumber: index + 1,
        name: `Board ${index + 1}`,
        createdAt: now,
      })),
    );
  }
}

async function getSeasonRosterPlayers(seasonId: string) {
  return getDatabase()
    .select({
      leaguePlayerId: leaguePlayers.id,
      displayName: players.displayName,
    })
    .from(seasonRosterEntries)
    .innerJoin(leaguePlayers, eq(seasonRosterEntries.leaguePlayerId, leaguePlayers.id))
    .innerJoin(players, eq(leaguePlayers.playerId, players.id))
    .where(
      and(
        eq(seasonRosterEntries.seasonId, seasonId),
        eq(seasonRosterEntries.status, "active"),
        eq(leaguePlayers.status, "active"),
      ),
    )
    .orderBy(asc(players.displayName));
}

export async function getGameNightForUser(
  gameNightId: string,
  userId: string,
): Promise<GameNightSummary> {
  const [night] = await getDatabase()
    .select({
      id: gameNights.id,
      leagueId: seasons.leagueId,
      seasonId: seasons.id,
      seasonName: seasons.name,
      name: gameNights.name,
      scheduledAt: gameNights.scheduledAt,
      status: gameNights.status,
      createdAt: gameNights.createdAt,
      updatedAt: gameNights.updatedAt,
    })
    .from(gameNights)
    .innerJoin(seasons, eq(gameNights.seasonId, seasons.id))
    .where(eq(gameNights.id, gameNightId))
    .limit(1);
  if (!night) throw new Error("Game night was not found.");
  await requireLeagueMember(night.leagueId, userId);

  const [settingsRow] = await getDatabase()
    .select()
    .from(gameNightSettings)
    .where(eq(gameNightSettings.gameNightId, gameNightId))
    .limit(1);
  if (!settingsRow) throw new Error("Game-night settings were not found.");

  const roster = await getSeasonRosterPlayers(night.seasonId);
  const attendanceRows = await getDatabase()
    .select()
    .from(gameNightAttendance)
    .where(eq(gameNightAttendance.gameNightId, gameNightId));
  const attendanceByPlayer = new Map(attendanceRows.map((row) => [row.leaguePlayerId, row]));

  const teamRows = await getDatabase()
    .select()
    .from(gameNightTeams)
    .where(eq(gameNightTeams.gameNightId, gameNightId))
    .orderBy(asc(gameNightTeams.teamIndex));
  const teamIds = teamRows.map((team) => team.id);
  const memberRows = teamIds.length
    ? await getDatabase()
        .select()
        .from(gameNightTeamMembers)
        .where(inArray(gameNightTeamMembers.teamId, teamIds))
        .orderBy(asc(gameNightTeamMembers.slotIndex))
    : [];
  const membersByTeam = new Map<string, typeof memberRows>();
  for (const member of memberRows) {
    const current = membersByTeam.get(member.teamId) ?? [];
    current.push(member);
    membersByTeam.set(member.teamId, current);
  }

  const boardRows = await getDatabase()
    .select()
    .from(gameNightBoards)
    .where(eq(gameNightBoards.gameNightId, gameNightId))
    .orderBy(asc(gameNightBoards.boardNumber));
  const boardNumberById = new Map(boardRows.map((board) => [board.id, board.boardNumber]));
  const pairingRows = await getDatabase()
    .select()
    .from(gameNightBoardPairings)
    .where(eq(gameNightBoardPairings.gameNightId, gameNightId))
    .orderBy(asc(gameNightBoardPairings.roundNumber));
  const pairedTeamIds = new Set(pairingRows.flatMap((row) => [row.teamAId, row.teamBId]));
  const matchSessionRows = await getDatabase()
    .select({
      id: leagueMatchSessions.id,
      pairingId: leagueMatchSessions.pairingId,
      status: leagueMatchSessions.status,
      winnerTeamId: leagueMatchSessions.winnerTeamId,
    })
    .from(leagueMatchSessions)
    .where(eq(leagueMatchSessions.gameNightId, gameNightId));
  const matchSessionByPairing = new Map(
    matchSessionRows.map((session) => [session.pairingId, session]),
  );

  return {
    ...night,
    status: asGameNightStatus(night.status),
    settings: settingsFromRow(settingsRow),
    attendance: roster.map((player) => {
      const row = attendanceByPlayer.get(player.leaguePlayerId);
      return {
        ...player,
        status: row ? asAttendanceStatus(row.status) : "absent",
        duesStatus: row ? asDuesStatus(row.duesStatus) : "unpaid",
        checkedInAt: row?.checkedInAt ?? null,
      };
    }),
    teams: teamRows.map((team) => ({
      id: team.id,
      teamIndex: team.teamIndex,
      name: team.name,
      source: team.source === "manual" ? "manual" : "automatic",
      members: (membersByTeam.get(team.id) ?? []).map((member) => ({
        id: member.id,
        leaguePlayerId: member.leaguePlayerId,
        displayName: member.displayName,
        isDummy: member.isDummy,
        slotIndex: member.slotIndex,
      })),
    })),
    boards: boardRows.map((board) => ({
      id: board.id,
      boardNumber: board.boardNumber,
      name: board.name,
    })),
    pairings: pairingRows.map((pairing) => ({
      id: pairing.id,
      boardId: pairing.boardId,
      boardNumber: boardNumberById.get(pairing.boardId) ?? 0,
      roundNumber: pairing.roundNumber,
      teamAId: pairing.teamAId,
      teamBId: pairing.teamBId,
      status:
        pairing.status === "active" || pairing.status === "completed"
          ? pairing.status
          : "scheduled",
      matchSessionId: matchSessionByPairing.get(pairing.id)?.id ?? null,
      matchStatus: (matchSessionByPairing.get(pairing.id)?.status ?? null) as
        | "scheduled"
        | "active"
        | "completed"
        | null,
      winnerTeamId: matchSessionByPairing.get(pairing.id)?.winnerTeamId ?? null,
    })),
    unpairedTeamIds: teamRows.filter((team) => !pairedTeamIds.has(team.id)).map((team) => team.id),
  };
}

export async function listGameNightsForUser(
  leagueId: string,
  userId: string,
): Promise<GameNightSummary[]> {
  await requireLeagueMember(leagueId, userId);
  const rows = await getDatabase()
    .select({ id: gameNights.id })
    .from(gameNights)
    .innerJoin(seasons, eq(gameNights.seasonId, seasons.id))
    .where(eq(seasons.leagueId, leagueId))
    .orderBy(asc(gameNights.scheduledAt));
  return Promise.all(rows.map((row) => getGameNightForUser(row.id, userId)));
}

export async function createGameNightForUser(
  input: CreateGameNightForUserInput,
): Promise<GameNightSummary> {
  await requireLeagueAdmin(input.leagueId, input.userId);
  const [season] = await getDatabase()
    .select({ id: seasons.id })
    .from(seasons)
    .where(and(eq(seasons.id, input.seasonId), eq(seasons.leagueId, input.leagueId)))
    .limit(1);
  if (!season) throw new Error("Season must belong to the selected league.");

  const now = input.now ?? Date.now();
  await getDatabase().transaction(async (tx) => {
    await tx.insert(gameNights).values({
      id: input.id,
      seasonId: input.seasonId,
      name: input.name.trim(),
      scheduledAt: input.scheduledAt,
      status: "checkin",
      createdByUserId: input.userId,
      createdAt: now,
      updatedAt: now,
    });
    await tx.insert(gameNightSettings).values({
      gameNightId: input.id,
      ...input.settings,
      updatedAt: now,
    });
  });
  await resetBoards(input.id, input.settings.boardCount, now);
  return getGameNightForUser(input.id, input.userId);
}

export async function updateGameNightSettingsForUser(
  input: UpdateGameNightSettingsForUserInput,
): Promise<GameNightSummary> {
  const context = await getGameNightContext(input.gameNightId);
  await requireLeagueAdmin(context.leagueId, input.userId);
  const now = input.now ?? Date.now();

  await getDatabase()
    .update(gameNightSettings)
    .set({ ...input.settings, updatedAt: now })
    .where(eq(gameNightSettings.gameNightId, input.gameNightId));
  await getDatabase()
    .update(gameNights)
    .set({ status: "checkin", updatedAt: now })
    .where(eq(gameNights.id, input.gameNightId));
  await resetBoards(input.gameNightId, input.settings.boardCount, now);
  return getGameNightForUser(input.gameNightId, input.userId);
}

export async function updateGameNightAttendanceForUser(
  input: UpdateGameNightAttendanceForUserInput,
): Promise<GameNightSummary> {
  const context = await getGameNightContext(input.gameNightId);
  await requireLeagueAdmin(context.leagueId, input.userId);

  const [eligible] = await getDatabase()
    .select({ id: leaguePlayers.id })
    .from(seasonRosterEntries)
    .innerJoin(leaguePlayers, eq(seasonRosterEntries.leaguePlayerId, leaguePlayers.id))
    .where(
      and(
        eq(seasonRosterEntries.seasonId, context.seasonId),
        eq(seasonRosterEntries.leaguePlayerId, input.leaguePlayerId),
        eq(seasonRosterEntries.status, "active"),
        eq(leaguePlayers.status, "active"),
      ),
    )
    .limit(1);
  if (!eligible) throw new Error("Only active season-roster players can check in.");

  const now = input.now ?? Date.now();
  const [existing] = await getDatabase()
    .select({ id: gameNightAttendance.id })
    .from(gameNightAttendance)
    .where(
      and(
        eq(gameNightAttendance.gameNightId, input.gameNightId),
        eq(gameNightAttendance.leaguePlayerId, input.leaguePlayerId),
      ),
    )
    .limit(1);

  const values = {
    status: input.checkedIn ? "checked_in" : "absent",
    duesStatus: input.duesStatus,
    checkedInAt: input.checkedIn ? now : null,
    duesUpdatedAt: input.duesStatus === "unpaid" ? null : now,
    updatedAt: now,
  };
  if (existing) {
    await getDatabase().update(gameNightAttendance).set(values).where(eq(gameNightAttendance.id, existing.id));
  } else {
    await getDatabase().insert(gameNightAttendance).values({
      id: input.attendanceId ?? crypto.randomUUID(),
      gameNightId: input.gameNightId,
      leaguePlayerId: input.leaguePlayerId,
      ...values,
    });
  }

  await getDatabase().delete(gameNightBoardPairings).where(eq(gameNightBoardPairings.gameNightId, input.gameNightId));
  if (!input.checkedIn) {
    const teams = await getDatabase().select({ id: gameNightTeams.id }).from(gameNightTeams).where(eq(gameNightTeams.gameNightId, input.gameNightId));
    if (teams.length) {
      await getDatabase().delete(gameNightTeamMembers).where(
        and(
          inArray(gameNightTeamMembers.teamId, teams.map((team) => team.id)),
          eq(gameNightTeamMembers.leaguePlayerId, input.leaguePlayerId),
        ),
      );
    }
  }
  await getDatabase().update(gameNights).set({ status: "checkin", updatedAt: now }).where(eq(gameNights.id, input.gameNightId));
  return getGameNightForUser(input.gameNightId, input.userId);
}

function shuffled<T>(items: T[]): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

export async function prepareGameNightTeamsForUser(
  gameNightId: string,
  userId: string,
): Promise<GameNightSummary> {
  const context = await getGameNightContext(gameNightId);
  await requireLeagueAdmin(context.leagueId, userId);
  const [settingsRow] = await getDatabase().select().from(gameNightSettings).where(eq(gameNightSettings.gameNightId, gameNightId)).limit(1);
  if (!settingsRow) throw new Error("Game-night settings were not found.");
  const settings = settingsFromRow(settingsRow);

  const checkedIn = await getDatabase()
    .select({ leaguePlayerId: leaguePlayers.id, displayName: players.displayName })
    .from(gameNightAttendance)
    .innerJoin(leaguePlayers, eq(gameNightAttendance.leaguePlayerId, leaguePlayers.id))
    .innerJoin(players, eq(leaguePlayers.playerId, players.id))
    .where(and(eq(gameNightAttendance.gameNightId, gameNightId), eq(gameNightAttendance.status, "checked_in")));

  if (settings.targetTeamCount < 2) throw new Error("At least two teams are required.");
  if (checkedIn.length > settings.targetTeamCount * settings.maxTeamPlayers) {
    throw new Error("Too many checked-in players for the configured number/size of teams.");
  }
  if (
    settings.teamCreationMode !== "manual" &&
    settings.dummyPlayerMode !== "fill" &&
    settings.dummyPlayerMode !== "balance" &&
    checkedIn.length < settings.targetTeamCount * settings.minTeamPlayers
  ) {
    throw new Error("Not enough checked-in players to satisfy the minimum team size without dummy filling.");
  }

  const now = Date.now();
  await getDatabase().delete(gameNightBoardPairings).where(eq(gameNightBoardPairings.gameNightId, gameNightId));
  const oldTeams = await getDatabase().select({ id: gameNightTeams.id }).from(gameNightTeams).where(eq(gameNightTeams.gameNightId, gameNightId));
  if (oldTeams.length) {
    await getDatabase().delete(gameNightTeamMembers).where(inArray(gameNightTeamMembers.teamId, oldTeams.map((team) => team.id)));
  }
  await getDatabase().delete(gameNightTeams).where(eq(gameNightTeams.gameNightId, gameNightId));

  const teams = Array.from({ length: settings.targetTeamCount }, (_, index) => ({
    id: crypto.randomUUID(),
    gameNightId,
    teamIndex: index + 1,
    name: `Team ${index + 1}`,
    source: settings.teamCreationMode === "manual" ? "manual" : "automatic",
    createdAt: now,
    updatedAt: now,
  }));
  await getDatabase().insert(gameNightTeams).values(teams);

  if (settings.teamCreationMode !== "manual") {
    const distributed = shuffled(checkedIn);
    const teamMembers: (typeof gameNightTeamMembers.$inferInsert)[] = [];
    distributed.forEach((player, index) => {
      const team = teams[index % teams.length];
      teamMembers.push({
        id: crypto.randomUUID(),
        teamId: team.id,
        leaguePlayerId: player.leaguePlayerId,
        slotIndex: Math.floor(index / teams.length),
        displayName: player.displayName,
        isDummy: false,
      });
    });

    if (settings.dummyPlayerMode === "fill" || settings.dummyPlayerMode === "balance") {
      const realPlayerCounts = teams.map(
        (team) =>
          teamMembers.filter(
            (member) => member.teamId === team.id && !member.isDummy,
          ).length,
      );
      const targetSize = dummyTargetSizeForTeams({
        mode: settings.dummyPlayerMode,
        realPlayerCounts,
        minTeamPlayers: settings.minTeamPlayers,
        maxTeamPlayers: settings.maxTeamPlayers,
      });

      for (const team of teams) {
        let count = teamMembers.filter((member) => member.teamId === team.id).length;
        while (count < targetSize) {
          teamMembers.push({
            id: crypto.randomUUID(),
            teamId: team.id,
            leaguePlayerId: null,
            slotIndex: count,
            displayName: `Dummy ${count + 1}`,
            isDummy: true,
          });
          count += 1;
        }
      }
    }
    if (teamMembers.length) await getDatabase().insert(gameNightTeamMembers).values(teamMembers);
  }

  await getDatabase().update(gameNights).set({ status: "checkin", updatedAt: now }).where(eq(gameNights.id, gameNightId));
  return getGameNightForUser(gameNightId, userId);
}

export async function assignGameNightPlayerToTeamForUser(
  gameNightId: string,
  leaguePlayerId: string,
  teamId: string | null,
  userId: string,
): Promise<GameNightSummary> {
  const context = await getGameNightContext(gameNightId);
  await requireLeagueAdmin(context.leagueId, userId);
  const [settingsRow] = await getDatabase().select().from(gameNightSettings).where(eq(gameNightSettings.gameNightId, gameNightId)).limit(1);
  if (!settingsRow) throw new Error("Game-night settings were not found.");
  const settings = settingsFromRow(settingsRow);
  if (settings.teamCreationMode === "automatic") {
    throw new Error("Automatic teams must be regenerated rather than manually edited.");
  }

  const [checkedIn] = await getDatabase()
    .select({ displayName: players.displayName })
    .from(gameNightAttendance)
    .innerJoin(leaguePlayers, eq(gameNightAttendance.leaguePlayerId, leaguePlayers.id))
    .innerJoin(players, eq(leaguePlayers.playerId, players.id))
    .where(
      and(
        eq(gameNightAttendance.gameNightId, gameNightId),
        eq(gameNightAttendance.leaguePlayerId, leaguePlayerId),
        eq(gameNightAttendance.status, "checked_in"),
      ),
    )
    .limit(1);
  if (!checkedIn) throw new Error("Player must be checked in before team assignment.");

  const teams = await getDatabase().select({ id: gameNightTeams.id }).from(gameNightTeams).where(eq(gameNightTeams.gameNightId, gameNightId));
  const teamIds = teams.map((team) => team.id);
  if (teamId && !teamIds.includes(teamId)) throw new Error("Team does not belong to this game night.");

  if (teamIds.length) {
    await getDatabase().delete(gameNightTeamMembers).where(
      and(
        inArray(gameNightTeamMembers.teamId, teamIds),
        eq(gameNightTeamMembers.leaguePlayerId, leaguePlayerId),
      ),
    );
  }
  if (teamId) {
    const currentMembers = await getDatabase().select().from(gameNightTeamMembers).where(eq(gameNightTeamMembers.teamId, teamId));
    const dummy = currentMembers.find((member) => member.isDummy);
    if (!dummy && currentMembers.length >= settings.maxTeamPlayers) throw new Error("That team is already at its maximum size.");
    if (dummy) await getDatabase().delete(gameNightTeamMembers).where(eq(gameNightTeamMembers.id, dummy.id));
    const remaining = dummy ? currentMembers.filter((member) => member.id !== dummy.id) : currentMembers;
    const nextSlot = remaining.length ? Math.max(...remaining.map((member) => member.slotIndex)) + 1 : 0;
    await getDatabase().insert(gameNightTeamMembers).values({
      id: crypto.randomUUID(),
      teamId,
      leaguePlayerId,
      slotIndex: dummy?.slotIndex ?? nextSlot,
      displayName: checkedIn.displayName,
      isDummy: false,
    });
  }

  await getDatabase().delete(gameNightBoardPairings).where(eq(gameNightBoardPairings.gameNightId, gameNightId));
  await getDatabase().update(gameNights).set({ status: "checkin", updatedAt: Date.now() }).where(eq(gameNights.id, gameNightId));
  return getGameNightForUser(gameNightId, userId);
}

export async function populateGameNightBoardsForUser(
  gameNightId: string,
  userId: string,
): Promise<GameNightSummary> {
  const context = await getGameNightContext(gameNightId);
  await requireLeagueAdmin(context.leagueId, userId);
  const [settingsRow] = await getDatabase().select().from(gameNightSettings).where(eq(gameNightSettings.gameNightId, gameNightId)).limit(1);
  if (!settingsRow) throw new Error("Game-night settings were not found.");
  const settings = settingsFromRow(settingsRow);
  const teams = await getDatabase().select().from(gameNightTeams).where(eq(gameNightTeams.gameNightId, gameNightId)).orderBy(asc(gameNightTeams.teamIndex));
  if (teams.length < 2) throw new Error("At least two teams are required before boards can be populated.");
  if (teams.length > settings.boardCount * 2) throw new Error("There are more teams than the configured boards can host in one round.");

  const membersByTeam = new Map<string, (typeof gameNightTeamMembers.$inferSelect)[]>();
  const realPlayerCounts: number[] = [];
  for (const team of teams) {
    const members = await getDatabase()
      .select()
      .from(gameNightTeamMembers)
      .where(eq(gameNightTeamMembers.teamId, team.id));
    membersByTeam.set(team.id, members);
    const realCount = members.filter((member) => !member.isDummy).length;
    realPlayerCounts.push(realCount);
    if (realCount > settings.maxTeamPlayers) {
      throw new Error(`${team.name} exceeds the maximum team size.`);
    }
    if (settings.dummyPlayerMode !== "balance" && members.length > settings.maxTeamPlayers) {
      throw new Error(`${team.name} exceeds the maximum team size.`);
    }
  }

  const targetSize = dummyTargetSizeForTeams({
    mode: settings.dummyPlayerMode,
    realPlayerCounts,
    minTeamPlayers: settings.minTeamPlayers,
    maxTeamPlayers: settings.maxTeamPlayers,
  });

  for (const team of teams) {
    let members = membersByTeam.get(team.id) ?? [];

    // Balance mode is a true normalization rule: if an earlier manual edit or
    // attendance change left stale extra dummies, remove only the excess dummy
    // slots before filling every team to the shared target size.
    if (settings.dummyPlayerMode === "balance") {
      while (members.length > targetSize) {
        const removableDummy = [...members]
          .filter((member) => member.isDummy)
          .sort((a, b) => b.slotIndex - a.slotIndex)[0];
        if (!removableDummy) break;
        await getDatabase()
          .delete(gameNightTeamMembers)
          .where(eq(gameNightTeamMembers.id, removableDummy.id));
        members = members.filter((member) => member.id !== removableDummy.id);
      }
    }

    const minimumForMode =
      settings.dummyPlayerMode === "balance" ? targetSize : settings.minTeamPlayers;
    if (members.length < minimumForMode) {
      if (settings.dummyPlayerMode === "none") {
        throw new Error(`${team.name} is below the minimum team size.`);
      }
      while (members.length < minimumForMode) {
        const slotIndex = members.length
          ? Math.max(...members.map((member) => member.slotIndex)) + 1
          : 0;
        const dummy = {
          id: crypto.randomUUID(),
          teamId: team.id,
          leaguePlayerId: null,
          slotIndex,
          displayName: `Dummy ${slotIndex + 1}`,
          isDummy: true,
        };
        await getDatabase().insert(gameNightTeamMembers).values(dummy);
        members = [...members, dummy];
      }
    }
  }

  const now = Date.now();
  const boards = await getDatabase().select().from(gameNightBoards).where(eq(gameNightBoards.gameNightId, gameNightId)).orderBy(asc(gameNightBoards.boardNumber));
  if (boards.length !== settings.boardCount) {
    await resetBoards(gameNightId, settings.boardCount, now);
  } else {
    await getDatabase().delete(gameNightBoardPairings).where(eq(gameNightBoardPairings.gameNightId, gameNightId));
  }
  const refreshedBoards = await getDatabase().select().from(gameNightBoards).where(eq(gameNightBoards.gameNightId, gameNightId)).orderBy(asc(gameNightBoards.boardNumber));

  const pairCount = Math.floor(teams.length / 2);
  if (pairCount > refreshedBoards.length) throw new Error("Not enough boards are available for the current teams.");
  if (pairCount) {
    const pairings = Array.from({ length: pairCount }, (_, index) => ({
      id: crypto.randomUUID(),
      gameNightId,
      boardId: refreshedBoards[index].id,
      roundNumber: 1,
      teamAId: teams[index * 2].id,
      teamBId: teams[index * 2 + 1].id,
      status: "scheduled",
      createdAt: now,
      updatedAt: now,
    }));
    await getDatabase().insert(gameNightBoardPairings).values(pairings);
    await getDatabase().insert(leagueMatchSessions).values(
      pairings.map((pairing) => ({
        id: crypto.randomUUID(),
        pairingId: pairing.id,
        gameNightId,
        boardId: pairing.boardId,
        teamAId: pairing.teamAId,
        teamBId: pairing.teamBId,
        status: "scheduled",
        startingScore: settings.startingScore,
        finishRule: settings.finishRule,
        legsPerMatch: settings.legsPerMatch,
        dummyScore: settings.dummyScore,
        winnerTeamId: null,
        startedAt: null,
        completedAt: null,
        createdAt: now,
        updatedAt: now,
      })),
    );
  }
  await getDatabase().update(gameNights).set({ status: "ready", updatedAt: now }).where(eq(gameNights.id, gameNightId));
  return getGameNightForUser(gameNightId, userId);
}

export async function setGameNightStatusForUser(
  gameNightId: string,
  userId: string,
  status: "active" | "completed" | "cancelled",
): Promise<GameNightSummary> {
  const context = await getGameNightContext(gameNightId);
  await requireLeagueAdmin(context.leagueId, userId);
  if (status === "active") {
    const [pairing] = await getDatabase().select({ id: gameNightBoardPairings.id }).from(gameNightBoardPairings).where(eq(gameNightBoardPairings.gameNightId, gameNightId)).limit(1);
    if (!pairing) throw new Error("Populate the boards before starting the game night.");
  }
  await getDatabase().update(gameNights).set({ status, updatedAt: Date.now() }).where(eq(gameNights.id, gameNightId));
  return getGameNightForUser(gameNightId, userId);
}
