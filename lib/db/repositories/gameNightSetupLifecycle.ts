import type { GameNightSummary } from "@/lib/league/gameNightContracts";

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

async function requireSetupEditable(gameNightId: string, userId: string) {
  const gameNight = await getGameNightForUser(gameNightId, userId);
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
  await requireSetupEditable(input.gameNightId, input.userId);
  return updateFixtureGameNightSettingsForUser(input);
}

export async function updateGameNightAttendanceForUser(
  input: UpdateGameNightAttendanceForUserInput,
): Promise<GameNightSummary> {
  await requireSetupEditable(input.gameNightId, input.userId);
  await updateRawGameNightAttendanceForUser(input);
  return getGameNightForUser(input.gameNightId, input.userId);
}

export async function prepareGameNightTeamsForUser(
  gameNightId: string,
  userId: string,
): Promise<GameNightSummary> {
  await requireSetupEditable(gameNightId, userId);
  await prepareRawGameNightTeamsForUser(gameNightId, userId);
  return getGameNightForUser(gameNightId, userId);
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
  return getGameNightForUser(gameNightId, userId);
}
