import { getRequestSession } from "@/lib/auth/server";
import {
  assignGameNightPlayerToTeamForUser,
  createGameNightForUser,
  getGameNightForUser,
  LeaguePermissionError,
  listGameNightsForUser,
  populateGameNightBoardsForUser,
  prepareGameNightTeamsForUser,
  regenerateGameNightRoundForUser,
  replaceGameNightRoundFixturesForUser,
  setGameNightStatusForUser,
  setGameNightTeamStatusForUser,
  startNextGameNightRoundForUser,
  updateGameNightAttendanceForUser,
  updateGameNightSettingsForUser,
} from "@/lib/db";
import {
  DEFAULT_GAME_NIGHT_SETTINGS,
  resolveGameNightSettings,
  type FixturePairingStrategy,
  type GameNightDuesStatus,
  type GameNightSettingsSummary,
  type GameNightTeamStatus,
  type ResolvedGameNightSettings,
} from "@/lib/league/gameNightContracts";
import type { FixtureRoundPairing } from "@/lib/league/fixtureEngine";
import { isSupportedBestOfLegs } from "@/lib/league/matchFormat";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function noStoreJson(body: unknown, init?: ResponseInit) {
  const headers = new Headers(init?.headers);
  headers.set("Cache-Control", "no-store");
  return Response.json(body, { ...init, headers });
}

async function getAuthenticatedUser(request: Request) {
  try {
    const session = await getRequestSession(request);
    return { user: session?.user ?? null, unavailable: false };
  } catch (error) {
    console.error("Authentication service unavailable during game-night request.", error);
    return { user: null, unavailable: true };
  }
}

function authFailureResponse(unavailable: boolean) {
  return unavailable
    ? noStoreJson({ error: "Account service is unavailable." }, { status: 503 })
    : noStoreJson({ error: "Authentication required." }, { status: 401 });
}

function validName(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0 && value.trim().length <= 80;
}

function validSettings(settings: ResolvedGameNightSettings) {
  return (
    ["manual", "automatic", "hybrid"].includes(settings.teamCreationMode) &&
    Number.isInteger(settings.targetTeamCount) &&
    settings.targetTeamCount >= 2 &&
    settings.targetTeamCount <= 64 &&
    Number.isInteger(settings.minTeamPlayers) &&
    settings.minTeamPlayers >= 1 &&
    settings.minTeamPlayers <= 16 &&
    Number.isInteger(settings.maxTeamPlayers) &&
    settings.maxTeamPlayers >= settings.minTeamPlayers &&
    settings.maxTeamPlayers <= 32 &&
    ["none", "allow", "fill"].includes(settings.dummyPlayerMode) &&
    Number.isInteger(settings.dummyScore) &&
    settings.dummyScore >= 0 &&
    settings.dummyScore <= 180 &&
    Number.isInteger(settings.boardCount) &&
    settings.boardCount >= 1 &&
    settings.boardCount <= 32 &&
    ["fixed", "rotate", "manual"].includes(settings.boardRotationType) &&
    Number.isInteger(settings.roundCount) &&
    settings.roundCount >= 1 &&
    settings.roundCount <= 32 &&
    ["random", "round_robin", "swiss", "manual"].includes(settings.pairingStrategy) &&
    ["manual", "automatic"].includes(settings.roundAdvanceMode) &&
    Number.isInteger(settings.roundAdvanceDelaySeconds) &&
    settings.roundAdvanceDelaySeconds >= 0 &&
    settings.roundAdvanceDelaySeconds <= 3600 &&
    Array.isArray(settings.intermissionAfterRounds) &&
    settings.intermissionAfterRounds.every(
      (round) => Number.isInteger(round) && round >= 1 && round < settings.roundCount,
    ) &&
    Number.isInteger(settings.intermissionDurationMinutes) &&
    settings.intermissionDurationMinutes >= 0 &&
    settings.intermissionDurationMinutes <= 180 &&
    isSupportedBestOfLegs(settings.legsPerMatch) &&
    [301, 501, 701].includes(settings.startingScore) &&
    ["straight", "double"].includes(settings.finishRule)
  );
}

function errorResponse(error: unknown) {
  if (error instanceof LeaguePermissionError) {
    return noStoreJson({ error: error.message }, { status: 403 });
  }
  const message = error instanceof Error ? error.message : "Game-night service is unavailable.";
  console.error("Game-night request failed.", error);
  return noStoreJson({ error: message }, { status: 400 });
}

export async function GET(request: Request) {
  const authState = await getAuthenticatedUser(request);
  if (!authState.user) return authFailureResponse(authState.unavailable);

  const url = new URL(request.url);
  const gameNightId = url.searchParams.get("gameNightId");
  const leagueId = url.searchParams.get("leagueId");
  try {
    if (gameNightId) {
      return noStoreJson({ gameNight: await getGameNightForUser(gameNightId, authState.user.id) });
    }
    if (!leagueId) return noStoreJson({ error: "leagueId is required." }, { status: 400 });
    return noStoreJson({ gameNights: await listGameNightsForUser(leagueId, authState.user.id) });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request) {
  const authState = await getAuthenticatedUser(request);
  if (!authState.user) return authFailureResponse(authState.unavailable);

  let input: {
    leagueId?: string;
    seasonId?: string;
    name?: string;
    scheduledAt?: number;
    settings?: Partial<GameNightSettingsSummary>;
  };
  try {
    input = await request.json();
  } catch {
    return noStoreJson({ error: "Invalid game-night request." }, { status: 400 });
  }

  if (!input.leagueId || !input.seasonId || !validName(input.name)) {
    return noStoreJson({ error: "League, season, and game-night name are required." }, { status: 400 });
  }
  if (typeof input.scheduledAt !== "number" || !Number.isFinite(input.scheduledAt)) {
    return noStoreJson({ error: "A valid scheduled date/time is required." }, { status: 400 });
  }
  const settings = resolveGameNightSettings({ ...DEFAULT_GAME_NIGHT_SETTINGS, ...input.settings });
  if (!validSettings(settings)) {
    return noStoreJson({ error: "Game-night rules are invalid." }, { status: 400 });
  }

  try {
    const gameNight = await createGameNightForUser({
      id: crypto.randomUUID(),
      leagueId: input.leagueId,
      seasonId: input.seasonId,
      userId: authState.user.id,
      name: input.name,
      scheduledAt: input.scheduledAt,
      settings,
    });
    return noStoreJson({ gameNight }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}

type PatchBody =
  | { action: "settings"; gameNightId: string; settings: GameNightSettingsSummary }
  | { action: "attendance"; gameNightId: string; leaguePlayerId: string; checkedIn: boolean; duesStatus: GameNightDuesStatus }
  | { action: "prepareTeams"; gameNightId: string }
  | { action: "assignTeam"; gameNightId: string; leaguePlayerId: string; teamId: string | null }
  | { action: "populateBoards"; gameNightId: string }
  | { action: "regenerateRound"; gameNightId: string; roundNumber: number; strategy?: FixturePairingStrategy }
  | { action: "replaceRoundFixtures"; gameNightId: string; roundNumber: number; pairings: FixtureRoundPairing[] }
  | { action: "startNextRound"; gameNightId: string; endIntermissionEarly?: boolean }
  | { action: "teamStatus"; gameNightId: string; teamId: string; status: GameNightTeamStatus }
  | { action: "status"; gameNightId: string; status: "active" | "completed" | "cancelled" };

export async function PATCH(request: Request) {
  const authState = await getAuthenticatedUser(request);
  if (!authState.user) return authFailureResponse(authState.unavailable);

  let input: PatchBody;
  try {
    input = (await request.json()) as PatchBody;
  } catch {
    return noStoreJson({ error: "Invalid game-night action." }, { status: 400 });
  }
  if (!input.gameNightId) return noStoreJson({ error: "gameNightId is required." }, { status: 400 });

  try {
    if (input.action === "settings") {
      const settings = resolveGameNightSettings(input.settings);
      if (!validSettings(settings)) return noStoreJson({ error: "Game-night settings are invalid." }, { status: 400 });
      return noStoreJson({ gameNight: await updateGameNightSettingsForUser({ gameNightId: input.gameNightId, userId: authState.user.id, settings }) });
    }
    if (input.action === "attendance") {
      if (!["unpaid", "paid", "waived"].includes(input.duesStatus)) return noStoreJson({ error: "Invalid dues status." }, { status: 400 });
      return noStoreJson({ gameNight: await updateGameNightAttendanceForUser({ attendanceId: crypto.randomUUID(), gameNightId: input.gameNightId, leaguePlayerId: input.leaguePlayerId, userId: authState.user.id, checkedIn: input.checkedIn, duesStatus: input.duesStatus }) });
    }
    if (input.action === "prepareTeams") {
      return noStoreJson({ gameNight: await prepareGameNightTeamsForUser(input.gameNightId, authState.user.id) });
    }
    if (input.action === "assignTeam") {
      return noStoreJson({ gameNight: await assignGameNightPlayerToTeamForUser(input.gameNightId, input.leaguePlayerId, input.teamId, authState.user.id) });
    }
    if (input.action === "populateBoards") {
      return noStoreJson({ gameNight: await populateGameNightBoardsForUser(input.gameNightId, authState.user.id) });
    }
    if (input.action === "regenerateRound") {
      if (!Number.isInteger(input.roundNumber) || input.roundNumber < 1) return noStoreJson({ error: "Invalid round number." }, { status: 400 });
      if (input.strategy && !["random", "round_robin", "swiss", "manual"].includes(input.strategy)) return noStoreJson({ error: "Invalid pairing strategy." }, { status: 400 });
      return noStoreJson({ gameNight: await regenerateGameNightRoundForUser(input.gameNightId, input.roundNumber, authState.user.id, input.strategy) });
    }
    if (input.action === "replaceRoundFixtures") {
      if (!Number.isInteger(input.roundNumber) || input.roundNumber < 1 || !Array.isArray(input.pairings) || input.pairings.length > 32) {
        return noStoreJson({ error: "Invalid round fixtures." }, { status: 400 });
      }
      return noStoreJson({ gameNight: await replaceGameNightRoundFixturesForUser({ gameNightId: input.gameNightId, roundNumber: input.roundNumber, userId: authState.user.id, pairings: input.pairings }) });
    }
    if (input.action === "startNextRound") {
      return noStoreJson({ gameNight: await startNextGameNightRoundForUser(input.gameNightId, authState.user.id, { endIntermissionEarly: input.endIntermissionEarly === true }) });
    }
    if (input.action === "teamStatus") {
      if (input.status !== "active" && input.status !== "withdrawn") return noStoreJson({ error: "Invalid team status." }, { status: 400 });
      return noStoreJson({ gameNight: await setGameNightTeamStatusForUser(input.gameNightId, input.teamId, input.status, authState.user.id) });
    }
    if (input.action === "status") {
      if (!["active", "completed", "cancelled"].includes(input.status)) return noStoreJson({ error: "Invalid game-night status." }, { status: 400 });
      return noStoreJson({ gameNight: await setGameNightStatusForUser(input.gameNightId, authState.user.id, input.status) });
    }
    return noStoreJson({ error: "Unknown game-night action." }, { status: 400 });
  } catch (error) {
    return errorResponse(error);
  }
}
