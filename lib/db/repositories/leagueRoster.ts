import { and, asc, eq, isNull } from "drizzle-orm";

import type { LeaguePlayerSummary, LeaguePlayerStatus } from "@/lib/league/rosterContracts";
import { getDatabase } from "../client";
import { leaguePlayers, seasonRosterEntries } from "../league-schema";
import { leagueMemberships, players, seasons } from "../schema";
import { LeaguePermissionError } from "./leagues";

export type CreateLeaguePlayerForUserInput = {
  playerId: string;
  leaguePlayerId: string;
  leagueId: string;
  userId: string;
  displayName: string;
  now?: number;
};

export type MutateSeasonRosterForUserInput = {
  rosterEntryId?: string;
  leagueId: string;
  seasonId: string;
  leaguePlayerId: string;
  userId: string;
  now?: number;
};

function asLeaguePlayerStatus(value: string): LeaguePlayerStatus {
  if (value === "active" || value === "archived") return value;
  throw new Error(`Unsupported league player status: ${value}`);
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
  if (!role) {
    throw new LeaguePermissionError("League membership is required.");
  }
  return role;
}

async function requireLeagueAdmin(leagueId: string, userId: string) {
  const role = await requireLeagueMember(leagueId, userId);
  if (role !== "owner" && role !== "admin") {
    throw new LeaguePermissionError();
  }
}

async function toLeaguePlayerSummary(
  leaguePlayerId: string,
): Promise<LeaguePlayerSummary> {
  const [row] = await getDatabase()
    .select({
      id: leaguePlayers.id,
      leagueId: leaguePlayers.leagueId,
      playerId: leaguePlayers.playerId,
      displayName: players.displayName,
      status: leaguePlayers.status,
      createdAt: leaguePlayers.createdAt,
      updatedAt: leaguePlayers.updatedAt,
    })
    .from(leaguePlayers)
    .innerJoin(players, eq(leaguePlayers.playerId, players.id))
    .where(eq(leaguePlayers.id, leaguePlayerId))
    .limit(1);

  if (!row) throw new Error("League player was not found.");

  const rosterRows = await getDatabase()
    .select({ seasonId: seasonRosterEntries.seasonId })
    .from(seasonRosterEntries)
    .where(
      and(
        eq(seasonRosterEntries.leaguePlayerId, leaguePlayerId),
        eq(seasonRosterEntries.status, "active"),
      ),
    );

  return {
    ...row,
    status: asLeaguePlayerStatus(row.status),
    seasonIds: rosterRows.map((entry) => entry.seasonId),
  };
}

export async function listLeaguePlayersForUser(
  leagueId: string,
  userId: string,
): Promise<LeaguePlayerSummary[]> {
  await requireLeagueMember(leagueId, userId);

  const rows = await getDatabase()
    .select({
      id: leaguePlayers.id,
      leagueId: leaguePlayers.leagueId,
      playerId: leaguePlayers.playerId,
      displayName: players.displayName,
      status: leaguePlayers.status,
      createdAt: leaguePlayers.createdAt,
      updatedAt: leaguePlayers.updatedAt,
    })
    .from(leaguePlayers)
    .innerJoin(players, eq(leaguePlayers.playerId, players.id))
    .where(
      and(
        eq(leaguePlayers.leagueId, leagueId),
        eq(leaguePlayers.status, "active"),
        isNull(players.archivedAt),
      ),
    )
    .orderBy(asc(players.displayName));

  const rosterRows = await getDatabase()
    .select({
      leaguePlayerId: seasonRosterEntries.leaguePlayerId,
      seasonId: seasonRosterEntries.seasonId,
    })
    .from(seasonRosterEntries)
    .innerJoin(seasons, eq(seasonRosterEntries.seasonId, seasons.id))
    .where(
      and(
        eq(seasons.leagueId, leagueId),
        eq(seasonRosterEntries.status, "active"),
      ),
    );

  const seasonIdsByPlayer = new Map<string, string[]>();
  for (const entry of rosterRows) {
    const current = seasonIdsByPlayer.get(entry.leaguePlayerId) ?? [];
    current.push(entry.seasonId);
    seasonIdsByPlayer.set(entry.leaguePlayerId, current);
  }

  return rows.map((row) => ({
    ...row,
    status: asLeaguePlayerStatus(row.status),
    seasonIds: seasonIdsByPlayer.get(row.id) ?? [],
  }));
}

export async function createLeaguePlayerForUser(
  input: CreateLeaguePlayerForUserInput,
): Promise<LeaguePlayerSummary> {
  await requireLeagueAdmin(input.leagueId, input.userId);
  const now = input.now ?? Date.now();
  const displayName = input.displayName.trim();

  await getDatabase().transaction(async (tx) => {
    await tx.insert(players).values({
      id: input.playerId,
      displayName,
      createdAt: now,
      updatedAt: now,
      archivedAt: null,
    });

    await tx.insert(leaguePlayers).values({
      id: input.leaguePlayerId,
      leagueId: input.leagueId,
      playerId: input.playerId,
      status: "active",
      createdAt: now,
      updatedAt: now,
    });
  });

  return {
    id: input.leaguePlayerId,
    leagueId: input.leagueId,
    playerId: input.playerId,
    displayName,
    status: "active",
    seasonIds: [],
    createdAt: now,
    updatedAt: now,
  };
}

async function verifyRosterTargets(leagueId: string, seasonId: string, leaguePlayerId: string) {
  const [[season], [leaguePlayer]] = await Promise.all([
    getDatabase()
      .select({ id: seasons.id })
      .from(seasons)
      .where(and(eq(seasons.id, seasonId), eq(seasons.leagueId, leagueId)))
      .limit(1),
    getDatabase()
      .select({ id: leaguePlayers.id })
      .from(leaguePlayers)
      .where(
        and(
          eq(leaguePlayers.id, leaguePlayerId),
          eq(leaguePlayers.leagueId, leagueId),
          eq(leaguePlayers.status, "active"),
        ),
      )
      .limit(1),
  ]);

  if (!season || !leaguePlayer) {
    throw new Error("Season and player must belong to the same league.");
  }
}

export async function addLeaguePlayerToSeasonForUser(
  input: MutateSeasonRosterForUserInput,
): Promise<LeaguePlayerSummary> {
  await requireLeagueAdmin(input.leagueId, input.userId);
  await verifyRosterTargets(input.leagueId, input.seasonId, input.leaguePlayerId);

  const now = input.now ?? Date.now();
  const [existing] = await getDatabase()
    .select({ id: seasonRosterEntries.id })
    .from(seasonRosterEntries)
    .where(
      and(
        eq(seasonRosterEntries.seasonId, input.seasonId),
        eq(seasonRosterEntries.leaguePlayerId, input.leaguePlayerId),
      ),
    )
    .limit(1);

  if (existing) {
    await getDatabase()
      .update(seasonRosterEntries)
      .set({ status: "active", updatedAt: now })
      .where(eq(seasonRosterEntries.id, existing.id));
  } else {
    if (!input.rosterEntryId) throw new Error("Roster entry ID is required.");
    await getDatabase().insert(seasonRosterEntries).values({
      id: input.rosterEntryId,
      seasonId: input.seasonId,
      leaguePlayerId: input.leaguePlayerId,
      status: "active",
      createdAt: now,
      updatedAt: now,
    });
  }

  return toLeaguePlayerSummary(input.leaguePlayerId);
}

export async function removeLeaguePlayerFromSeasonForUser(
  input: MutateSeasonRosterForUserInput,
): Promise<LeaguePlayerSummary> {
  await requireLeagueAdmin(input.leagueId, input.userId);
  await verifyRosterTargets(input.leagueId, input.seasonId, input.leaguePlayerId);

  await getDatabase()
    .update(seasonRosterEntries)
    .set({ status: "withdrawn", updatedAt: input.now ?? Date.now() })
    .where(
      and(
        eq(seasonRosterEntries.seasonId, input.seasonId),
        eq(seasonRosterEntries.leaguePlayerId, input.leaguePlayerId),
      ),
    );

  return toLeaguePlayerSummary(input.leaguePlayerId);
}
