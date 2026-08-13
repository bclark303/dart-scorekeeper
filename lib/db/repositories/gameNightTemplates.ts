import { and, asc, desc, eq } from "drizzle-orm";

import {
  DEFAULT_GAME_NIGHT_SETTINGS,
  resolveGameNightSettings,
  type GameNightSettingsSummary,
  type ResolvedGameNightSettings,
} from "@/lib/league/gameNightContracts";
import { isValidResolvedGameNightSettings } from "@/lib/league/gameNightSettingsValidation";
import type { GameNightTemplateSummary } from "@/lib/league/gameNightTemplates";
import { getDatabase } from "../client";
import { gameNightTemplates } from "../game-night-schema";
import { leagueMemberships } from "../schema";
import { LeaguePermissionError } from "./leagues";

export type CreateGameNightTemplateForUserInput = {
  id: string;
  leagueId: string;
  userId: string;
  name: string;
  settings: GameNightSettingsSummary;
  isDefault?: boolean;
  now?: number;
};

export type UpdateGameNightTemplateForUserInput = {
  templateId: string;
  userId: string;
  name?: string;
  settings?: GameNightSettingsSummary;
  isDefault?: boolean;
  now?: number;
};

function normalizeSettings(settings: GameNightSettingsSummary): ResolvedGameNightSettings {
  const resolved = resolveGameNightSettings(settings);
  if (!isValidResolvedGameNightSettings(resolved)) {
    throw new Error("Game-night template rules are invalid.");
  }
  return resolved;
}

function parseSettings(value: string): ResolvedGameNightSettings {
  let parsed: unknown;
  try {
    parsed = JSON.parse(value);
  } catch {
    throw new Error("Game-night template rules could not be read.");
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("Game-night template rules could not be read.");
  }
  return normalizeSettings({
    ...DEFAULT_GAME_NIGHT_SETTINGS,
    ...(parsed as Partial<GameNightSettingsSummary>),
  });
}

function summaryFromRow(row: typeof gameNightTemplates.$inferSelect): GameNightTemplateSummary {
  return {
    id: row.id,
    leagueId: row.leagueId,
    name: row.name,
    isDefault: row.isDefault,
    settings: parseSettings(row.settingsJson),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

async function getRole(leagueId: string, userId: string) {
  const [membership] = await getDatabase()
    .select({ role: leagueMemberships.role })
    .from(leagueMemberships)
    .where(and(
      eq(leagueMemberships.leagueId, leagueId),
      eq(leagueMemberships.userId, userId),
      eq(leagueMemberships.status, "active"),
    ))
    .limit(1);
  return membership?.role ?? null;
}

async function requireMember(leagueId: string, userId: string) {
  const role = await getRole(leagueId, userId);
  if (!role) throw new LeaguePermissionError("League membership is required.");
  return role;
}

async function requireAdmin(leagueId: string, userId: string) {
  const role = await requireMember(leagueId, userId);
  if (role !== "owner" && role !== "admin") throw new LeaguePermissionError();
}

async function getRow(templateId: string) {
  const [row] = await getDatabase()
    .select()
    .from(gameNightTemplates)
    .where(eq(gameNightTemplates.id, templateId))
    .limit(1);
  if (!row) throw new Error("Game-night template was not found.");
  return row;
}

async function requireUniqueName(leagueId: string, name: string, exceptId?: string) {
  const [existing] = await getDatabase()
    .select({ id: gameNightTemplates.id })
    .from(gameNightTemplates)
    .where(and(eq(gameNightTemplates.leagueId, leagueId), eq(gameNightTemplates.name, name)))
    .limit(1);
  if (existing && existing.id !== exceptId) {
    throw new Error("A Game Night template with that name already exists.");
  }
}

export async function listGameNightTemplatesForUser(
  leagueId: string,
  userId: string,
): Promise<GameNightTemplateSummary[]> {
  await requireMember(leagueId, userId);
  const rows = await getDatabase()
    .select()
    .from(gameNightTemplates)
    .where(eq(gameNightTemplates.leagueId, leagueId))
    .orderBy(desc(gameNightTemplates.isDefault), asc(gameNightTemplates.name));
  return rows.map(summaryFromRow);
}

export async function getGameNightTemplateForUser(
  templateId: string,
  userId: string,
): Promise<GameNightTemplateSummary> {
  const row = await getRow(templateId);
  await requireMember(row.leagueId, userId);
  return summaryFromRow(row);
}

export async function getDefaultGameNightTemplateForUser(
  leagueId: string,
  userId: string,
): Promise<GameNightTemplateSummary | null> {
  await requireMember(leagueId, userId);
  const [row] = await getDatabase()
    .select()
    .from(gameNightTemplates)
    .where(and(eq(gameNightTemplates.leagueId, leagueId), eq(gameNightTemplates.isDefault, true)))
    .limit(1);
  return row ? summaryFromRow(row) : null;
}

export async function createGameNightTemplateForUser(
  input: CreateGameNightTemplateForUserInput,
): Promise<GameNightTemplateSummary> {
  await requireAdmin(input.leagueId, input.userId);
  const name = input.name.trim();
  if (!name) throw new Error("Template name is required.");
  await requireUniqueName(input.leagueId, name);
  const settings = normalizeSettings(input.settings);
  const now = input.now ?? Date.now();
  const [existing] = await getDatabase()
    .select({ id: gameNightTemplates.id })
    .from(gameNightTemplates)
    .where(eq(gameNightTemplates.leagueId, input.leagueId))
    .limit(1);
  const isDefault = input.isDefault === true || !existing;

  await getDatabase().transaction(async (tx) => {
    if (isDefault) {
      await tx.update(gameNightTemplates)
        .set({ isDefault: false, updatedAt: now })
        .where(eq(gameNightTemplates.leagueId, input.leagueId));
    }
    await tx.insert(gameNightTemplates).values({
      id: input.id,
      leagueId: input.leagueId,
      name,
      settingsJson: JSON.stringify(settings),
      isDefault,
      createdByUserId: input.userId,
      createdAt: now,
      updatedAt: now,
    });
  });
  return getGameNightTemplateForUser(input.id, input.userId);
}

export async function updateGameNightTemplateForUser(
  input: UpdateGameNightTemplateForUserInput,
): Promise<GameNightTemplateSummary> {
  const current = await getRow(input.templateId);
  await requireAdmin(current.leagueId, input.userId);
  const now = input.now ?? Date.now();
  const values: Partial<typeof gameNightTemplates.$inferInsert> = { updatedAt: now };

  if (input.name !== undefined) {
    const name = input.name.trim();
    if (!name) throw new Error("Template name is required.");
    await requireUniqueName(current.leagueId, name, current.id);
    values.name = name;
  }
  if (input.settings !== undefined) {
    values.settingsJson = JSON.stringify(normalizeSettings(input.settings));
  }
  if (input.isDefault !== undefined) values.isDefault = input.isDefault;

  await getDatabase().transaction(async (tx) => {
    if (input.isDefault === true) {
      await tx.update(gameNightTemplates)
        .set({ isDefault: false, updatedAt: now })
        .where(eq(gameNightTemplates.leagueId, current.leagueId));
    }
    await tx.update(gameNightTemplates)
      .set(values)
      .where(eq(gameNightTemplates.id, input.templateId));
  });
  return getGameNightTemplateForUser(input.templateId, input.userId);
}
