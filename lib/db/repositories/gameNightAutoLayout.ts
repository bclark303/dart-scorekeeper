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
import {
  gameNightBoardPairings,
  gameNightBoards,
  gameNightSettings,
} from "../game-night-schema";

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

async function syncAutomaticBoards(
  gameNight: GameNightSummary,
  boardCount: number,
  now: number,
) {
  if (gameNight.boards.length === boardCount) return;

  // Setup-only lifecycle guards prevent this from running once play begins.
  // Rebuilding board rows here keeps the coordinator UI aligned with an Auto
  // board-count change immediately rather than waiting for Populate Boards.
  await getDatabase()
    .delete(gameNightBoardPairings)
    .where(eq(gameNightBoardPairings.gameNightId, gameNight.id));
  await getDatabase()
    .delete(gameNightBoards)
    .where(eq(gameNightBoards.gameNightId, gameNight.id));

  await getDatabase().insert(gameNightBoards).values(
    Array.from({ length: boardCount }, (_, index) => ({
      id: crypto.randomUUID(),
      gameNightId: gameNight.id,
      boardNumber: index + 1,
      name: `Board ${index + 1}`,
      createdAt: now,
    })),
  );
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
    const now = Date.now();
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
        updatedAt: now,
      })
      .where(eq(gameNightSettings.gameNightId, gameNight.id));

    if (modes.boardCountMode === "automatic") {
      await syncAutomaticBoards(gameNight, optimized.boardCount, now);
    }
  }

  return optimized;
}
