import type { GameNightSummary } from "@/lib/league/gameNightContracts";
import { optimizeGameNightLayout } from "@/lib/league/gameNightLayout";

import {
  assignGameNightPlayerToTeamForUser as assignRawGameNightPlayerToTeamForUser,
  prepareGameNightTeamsForUser as prepareRawGameNightTeamsForUser,
  updateGameNightAttendanceForUser as updateRawGameNightAttendanceForUser,
  type UpdateGameNightAttendanceForUserInput,
  type UpdateGameNightSettingsForUserInput,
} from "./gameNights";
import {
  getGameNightForUser,
  updateGameNightSettingsForUser as updateFixtureGameNightSettingsForUser,
} from "./gameNightFixtures";
import {
  hydrateGameNightAutoLayout,
  syncAutomaticGameNightLayout,
} from "./gameNightAutoLayout";

async function requireSetupEditable(gameNightId: string, userId: string) {
  const gameNight = await hydrateGameNightAutoLayout(
    await getGameNightForUser(gameNightId, userId),
  );
  if (
    gameNight.status === "active" ||
    gameNight.status === "completed" ||
    gameNight.status === "cancelled"
  ) {
    throw new Error(
      "Game Night attendance, teams, and structural rules are locked after play starts.",
    );
  }
  return gameNight;
}

export async function updateGameNightSettingsForUser(
  input: UpdateGameNightSettingsForUserInput,
): Promise<GameNightSummary> {
  const gameNight = await requireSetupEditable(input.gameNightId, input.userId);
  const checkedInPlayerCount = gameNight.attendance.filter(
    (player) => player.status === "checked_in",
  ).length;
  const optimized = optimizeGameNightLayout(
    input.settings,
    checkedInPlayerCount,
  ).settings;
  const updated = await updateFixtureGameNightSettingsForUser({
    ...input,
    settings: optimized,
  });
  return hydrateGameNightAutoLayout(updated);
}

export async function updateGameNightAttendanceForUser(
  input: UpdateGameNightAttendanceForUserInput,
): Promise<GameNightSummary> {
  await requireSetupEditable(input.gameNightId, input.userId);
  await updateRawGameNightAttendanceForUser(input);
  const current = await hydrateGameNightAutoLayout(
    await getGameNightForUser(input.gameNightId, input.userId),
  );
  await syncAutomaticGameNightLayout(current);
  return hydrateGameNightAutoLayout(
    await getGameNightForUser(input.gameNightId, input.userId),
  );
}

export async function prepareGameNightTeamsForUser(
  gameNightId: string,
  userId: string,
): Promise<GameNightSummary> {
  const current = await requireSetupEditable(gameNightId, userId);
  await syncAutomaticGameNightLayout(current);
  await prepareRawGameNightTeamsForUser(gameNightId, userId);
  return hydrateGameNightAutoLayout(await getGameNightForUser(gameNightId, userId));
}

export async function assignGameNightPlayerToTeamForUser(
  gameNightId: string,
  leaguePlayerId: string,
  teamId: string | null,
  userId: string,
): Promise<GameNightSummary> {
  await requireSetupEditable(gameNightId, userId);
  await assignRawGameNightPlayerToTeamForUser(
    gameNightId,
    leaguePlayerId,
    teamId,
    userId,
  );
  return hydrateGameNightAutoLayout(await getGameNightForUser(gameNightId, userId));
}
