import { eq } from "drizzle-orm";

import {
  resolveGameNightSettings,
  type GameNightLayoutMode,
  type GameNightSettingsSummary,
  type GameNightSummary,
  type ResolvedGameNightSettings,
} from "@/lib/league/gameNightContracts";
import { optimizeGameNightLayout } from "@/lib/league/gameNightLayout";
import { getDatabase } from "../client";
import { gameNightSettings } from "../game-night-schema";

function asLayoutMode(value: string): GameNightLayoutMode {
  return value === "automatic" ? "automatic" : "manual";
}

export async function getGameNightLayoutModes(gameNightId: string) {
  const [row] = await getDatabase()
    .select({
      teamCountMode: gameNightSettings.teamCountMode,
      teamSizeMode: gameNightSettings.teamSizeMode,
      boardCountMode: gameNightSettings.boardCountMode,
    })
    .from(gameNightSettings)
    .where(eq(gameNightSettings.gameNightId, gameNightId))
    .limit(1);
  if (!row) throw new Error("Game-night settings were not found.");
  return {
    teamCountMode: asLayoutMode(row.teamCountMode),
    teamSizeMode: asLayoutMode(row.teamSizeMode),
    boardCountMode: asLayoutMode(row.boardCountMode),
  };
}

export async function hydrateGameNightAutoLayout(
  gameNight: GameNightSummary,
): Promise<GameNightSummary> {
  const modes = await getGameNightLayoutModes(gameNight.id);
  return {
    ...gameNight,
    settings: {
      ...gameNight.settings,
      ...modes,
    },
  };
}

export async function hydrateGameNightAutoLayouts(
  gameNights: GameNightSummary[],
): Promise<GameNightSummary[]> {
  return Promise.all(gameNights.map(hydrateGameNightAutoLayout));
}

export function optimizeSettingsForGameNight(
  settings: GameNightSettingsSummary,
  checkedInPlayerCount: number,
): ResolvedGameNightSettings {
  return optimizeGameNightLayout(settings, checkedInPlayerCount).settings;
}

export async function syncAutomaticGameNightLayout(
  gameNight: GameNightSummary,
): Promise<ResolvedGameNightSettings> {
  const modes = await getGameNightLayoutModes(gameNight.id);
  const settings = resolveGameNightSettings({
    ...gameNight.settings,
    ...modes,
  });
  const checkedInPlayerCount = gameNight.attendance.filter(
    (player) => player.status === "checked_in",
  ).length;
  const optimized = optimizeGameNightLayout(
    settings,
    checkedInPlayerCount,
  ).settings;

  const shouldPersist =
    modes.teamCountMode === "automatic" ||
    modes.teamSizeMode === "automatic" ||
    modes.boardCountMode === "automatic";

  if (shouldPersist) {
    await getDatabase()
      .update(gameNightSettings)
      .set({
        teamCountMode: optimized.teamCountMode,
        targetTeamCount: optimized.targetTeamCount,
        teamSizeMode: optimized.teamSizeMode,
        minTeamPlayers: optimized.minTeamPlayers,
        maxTeamPlayers: optimized.maxTeamPlayers,
        boardCountMode: optimized.boardCountMode,
        boardCount: optimized.boardCount,
        updatedAt: Date.now(),
      })
      .where(eq(gameNightSettings.gameNightId, gameNight.id));
  }

  return optimized;
}
