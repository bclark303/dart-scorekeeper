import { and, asc, eq, inArray, isNull } from "drizzle-orm";

import type {
  LeagueRole,
  LeagueSeasonSummary,
  LeagueStatus,
  LeagueSummary,
  SeasonStatus,
} from "@/lib/league/contracts";
import { getDatabase } from "../client";
import { leagueMemberships, leagues, seasons } from "../schema";
import { leagueVenues, venues } from "../venue-schema";

export class LeaguePermissionError extends Error {
  constructor(message = "League administrator access is required.") {
    super(message);
    this.name = "LeaguePermissionError";
  }
}

export type CreateLeagueForUserInput = {
  id: string;
  membershipId: string;
  userId: string;
  name: string;
  firstSeason?: {
    id: string;
    name: string;
  };
  now?: number;
};

export type CreateSeasonForUserInput = {
  id: string;
  leagueId: string;
  userId: string;
  name: string;
  now?: number;
};

function asLeagueRole(value: string): LeagueRole {
  if (value === "owner" || value === "admin" || value === "member") {
    return value;
  }
  throw new Error(`Unsupported league role: ${value}`);
}

function asLeagueStatus(value: string): LeagueStatus {
  if (value === "active" || value === "archived") {
    return value;
  }
  throw new Error(`Unsupported league status: ${value}`);
}

function asSeasonStatus(value: string): SeasonStatus {
  if (
    value === "draft" ||
    value === "active" ||
    value === "completed" ||
    value === "archived"
  ) {
    return value;
  }
  throw new Error(`Unsupported season status: ${value}`);
}

function toSeasonSummary(row: typeof seasons.$inferSelect): LeagueSeasonSummary {
  return {
    id: row.id,
    leagueId: row.leagueId,
    name: row.name,
    status: asSeasonStatus(row.status),
    startsAt: row.startsAt,
    endsAt: row.endsAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

/**
 * Create the minimum durable league structure for an account.
 *
 * Auth account IDs grant league permissions, but they are deliberately not
 * dart-player IDs. A later roster can link league entries to player profiles
 * without making an account synonymous with a person who throws darts.
 */
export async function createLeagueForUser(
  input: CreateLeagueForUserInput,
): Promise<LeagueSummary> {
  const now = input.now ?? Date.now();
  const name = input.name.trim();
  const firstSeasonName = input.firstSeason?.name.trim();
  const venueId = crypto.randomUUID();

  return getDatabase().transaction(async (tx) => {
    await tx.insert(leagues).values({
      id: input.id,
      name,
      status: "active",
      createdByUserId: input.userId,
      createdAt: now,
      updatedAt: now,
      archivedAt: null,
    });

    await tx.insert(leagueMemberships).values({
      id: input.membershipId,
      leagueId: input.id,
      userId: input.userId,
      role: "owner",
      status: "active",
      createdAt: now,
      updatedAt: now,
    });

    await tx.insert(venues).values({
      id: venueId,
      name: `${name} Venue`,
      status: "active",
      createdByUserId: input.userId,
      createdAt: now,
      updatedAt: now,
    });
    await tx.insert(leagueVenues).values({
      id: crypto.randomUUID(),
      leagueId: input.id,
      venueId,
      createdAt: now,
    });

    const seasonSummaries: LeagueSeasonSummary[] = [];
    if (input.firstSeason && firstSeasonName) {
      await tx.insert(seasons).values({
        id: input.firstSeason.id,
        leagueId: input.id,
        name: firstSeasonName,
        status: "draft",
        startsAt: null,
        endsAt: null,
        createdAt: now,
        updatedAt: now,
      });

      seasonSummaries.push({
        id: input.firstSeason.id,
        leagueId: input.id,
        name: firstSeasonName,
        status: "draft",
        startsAt: null,
        endsAt: null,
        createdAt: now,
        updatedAt: now,
      });
    }

    return {
      id: input.id,
      name,
      status: "active",
      membershipRole: "owner",
      createdAt: now,
      updatedAt: now,
      seasons: seasonSummaries,
    };
  });
}

export async function listLeaguesForUser(
  userId: string,
): Promise<LeagueSummary[]> {
  const membershipRows = await getDatabase()
    .select({
      id: leagues.id,
      name: leagues.name,
      status: leagues.status,
      createdAt: leagues.createdAt,
      updatedAt: leagues.updatedAt,
      membershipRole: leagueMemberships.role,
    })
    .from(leagueMemberships)
    .innerJoin(leagues, eq(leagueMemberships.leagueId, leagues.id))
    .where(
      and(
        eq(leagueMemberships.userId, userId),
        eq(leagueMemberships.status, "active"),
        isNull(leagues.archivedAt),
      ),
    )
    .orderBy(asc(leagues.name));

  if (membershipRows.length === 0) {
    return [];
  }

  const leagueIds = membershipRows.map((row) => row.id);
  const seasonRows = await getDatabase()
    .select()
    .from(seasons)
    .where(inArray(seasons.leagueId, leagueIds))
    .orderBy(asc(seasons.startsAt), asc(seasons.name));

  const seasonsByLeague = new Map<string, LeagueSeasonSummary[]>();
  for (const row of seasonRows) {
    const current = seasonsByLeague.get(row.leagueId) ?? [];
    current.push(toSeasonSummary(row));
    seasonsByLeague.set(row.leagueId, current);
  }

  return membershipRows.map((row) => ({
    id: row.id,
    name: row.name,
    status: asLeagueStatus(row.status),
    membershipRole: asLeagueRole(row.membershipRole),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    seasons: seasonsByLeague.get(row.id) ?? [],
  }));
}

export async function createSeasonForUser(
  input: CreateSeasonForUserInput,
): Promise<LeagueSeasonSummary> {
  const [membership] = await getDatabase()
    .select({ role: leagueMemberships.role })
    .from(leagueMemberships)
    .where(
      and(
        eq(leagueMemberships.leagueId, input.leagueId),
        eq(leagueMemberships.userId, input.userId),
        eq(leagueMemberships.status, "active"),
      ),
    )
    .limit(1);

  if (!membership || (membership.role !== "owner" && membership.role !== "admin")) {
    throw new LeaguePermissionError();
  }

  const now = input.now ?? Date.now();
  const row = {
    id: input.id,
    leagueId: input.leagueId,
    name: input.name.trim(),
    status: "draft" as const,
    startsAt: null,
    endsAt: null,
    createdAt: now,
    updatedAt: now,
  };

  await getDatabase().insert(seasons).values(row);

  return row;
}
