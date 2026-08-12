import { and, asc, eq, inArray } from "drizzle-orm";

import {
  DEFAULT_GAME_NIGHT_SETTINGS,
  resolveGameNightSettings,
  type FixturePairingStrategy,
  type GameNightBoardPairingSummary,
  type GameNightPairingStatus,
  type GameNightRoundSummary,
  type GameNightSettingsSummary,
  type GameNightSummary,
  type GameNightTeamStatus,
  type ResolvedGameNightSettings,
} from "@/lib/league/gameNightContracts";
import {
  generateFixtureRound,
  type FixtureHistoryPairing,
  type FixtureRoundPairing,
} from "@/lib/league/fixtureEngine";
import { getDatabase } from "../client";
import {
  gameNightBoardPairings,
  gameNightBoards,
  gameNightSettings,
  gameNightTeams,
  gameNights,
} from "../game-night-schema";
import { leagueMatchSessions } from "../league-match-schema";
import { leagueMemberships, seasons } from "../schema";
import {
  createGameNightForUser as createBaseGameNightForUser,
  getGameNightForUser as getBaseGameNightForUser,
  listGameNightsForUser as listBaseGameNightsForUser,
  populateGameNightBoardsForUser as populateBaseGameNightBoardsForUser,
  updateGameNightSettingsForUser as updateBaseGameNightSettingsForUser,
  type CreateGameNightForUserInput,
  type UpdateGameNightSettingsForUserInput,
} from "./gameNights";
import { LeaguePermissionError } from "./leagues";

function asPairingStrategy(value: string): FixturePairingStrategy {
  if (value === "round_robin" || value === "swiss" || value === "manual") return value;
  return "random";
}

function parseIntermissionRounds(value: string, roundCount: number) {
  try {
    const parsed = JSON.parse(value) as unknown;
    if (!Array.isArray(parsed)) return [];
    return [...new Set(parsed)]
      .filter((round): round is number => Number.isInteger(round) && round >= 1 && round < roundCount)
      .sort((a, b) => a - b);
  } catch {
    return [];
  }
}

function resolvedSettingsFromRow(
  row: typeof gameNightSettings.$inferSelect,
): ResolvedGameNightSettings {
  const roundCount = Number.isInteger(row.roundCount) && row.roundCount >= 1 ? row.roundCount : 3;
  return {
    ...DEFAULT_GAME_NIGHT_SETTINGS,
    teamCreationMode:
      row.teamCreationMode === "manual" || row.teamCreationMode === "automatic"
        ? row.teamCreationMode
        : "hybrid",
    targetTeamCount: row.targetTeamCount,
    minTeamPlayers: row.minTeamPlayers,
    maxTeamPlayers: row.maxTeamPlayers,
    dummyPlayerMode:
      row.dummyPlayerMode === "none" || row.dummyPlayerMode === "allow"
        ? row.dummyPlayerMode
        : "fill",
    dummyScore: row.dummyScore,
    boardCount: row.boardCount,
    boardRotationType:
      row.boardRotationType === "fixed" || row.boardRotationType === "manual"
        ? row.boardRotationType
        : "rotate",
    roundCount,
    pairingStrategy: asPairingStrategy(row.pairingStrategy),
    roundAdvanceMode: row.roundAdvanceMode === "automatic" ? "automatic" : "manual",
    roundAdvanceDelaySeconds: Math.max(0, row.roundAdvanceDelaySeconds),
    intermissionAfterRounds: parseIntermissionRounds(
      row.intermissionAfterRoundsJson,
      roundCount,
    ),
    intermissionDurationMinutes: Math.max(0, row.intermissionDurationMinutes),
    legsPerMatch: row.legsPerMatch,
    startingScore: row.startingScore,
    finishRule: row.finishRule === "straight" ? "straight" : "double",
  };
}

async function getContext(gameNightId: string) {
  const [row] = await getDatabase()
    .select({
      gameNightId: gameNights.id,
      leagueId: seasons.leagueId,
      status: gameNights.status,
    })
    .from(gameNights)
    .innerJoin(seasons, eq(gameNights.seasonId, seasons.id))
    .where(eq(gameNights.id, gameNightId))
    .limit(1);
  if (!row) throw new Error("Game night was not found.");
  return row;
}

async function getLeagueRole(leagueId: string, userId: string) {
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

async function requireAdmin(gameNightId: string, userId: string) {
  const context = await getContext(gameNightId);
  const role = await getLeagueRole(context.leagueId, userId);
  if (role !== "owner" && role !== "admin") throw new LeaguePermissionError();
  return context;
}

async function getResolvedSettings(gameNightId: string) {
  const [row] = await getDatabase()
    .select()
    .from(gameNightSettings)
    .where(eq(gameNightSettings.gameNightId, gameNightId))
    .limit(1);
  if (!row) throw new Error("Game-night settings were not found.");
  return resolvedSettingsFromRow(row);
}

async function getPairingRows(gameNightId: string) {
  return getDatabase()
    .select()
    .from(gameNightBoardPairings)
    .where(eq(gameNightBoardPairings.gameNightId, gameNightId))
    .orderBy(asc(gameNightBoardPairings.roundNumber));
}

async function getSessionRows(gameNightId: string) {
  return getDatabase()
    .select()
    .from(leagueMatchSessions)
    .where(eq(leagueMatchSessions.gameNightId, gameNightId));
}

function pairingStatus(value: string): GameNightPairingStatus {
  if (value === "ready" || value === "active" || value === "completed") return value;
  return "draft";
}

function roundCompletedAt(
  roundPairings: GameNightBoardPairingSummary[],
  sessionByPairing: Map<string, typeof leagueMatchSessions.$inferSelect>,
) {
  if (!roundPairings.length || roundPairings.some((pairing) => pairing.matchStatus !== "completed")) {
    return null;
  }
  const completed = roundPairings
    .map((pairing) => sessionByPairing.get(pairing.id)?.completedAt ?? null)
    .filter((value): value is number => value !== null);
  return completed.length ? Math.max(...completed) : null;
}

function buildRounds(
  pairings: GameNightBoardPairingSummary[],
  activeTeamIds: string[],
  settings: ResolvedGameNightSettings,
  sessionByPairing: Map<string, typeof leagueMatchSessions.$inferSelect>,
  now = Date.now(),
): GameNightRoundSummary[] {
  const roundNumbers = [...new Set(pairings.map((pairing) => pairing.roundNumber))].sort((a, b) => a - b);
  return roundNumbers.map((roundNumber) => {
    const roundPairings = pairings.filter((pairing) => pairing.roundNumber === roundNumber);
    const paired = new Set(roundPairings.flatMap((pairing) => [pairing.teamAId, pairing.teamBId]));
    const byeTeamIds = activeTeamIds.filter((teamId) => !paired.has(teamId));
    const completedAt = roundCompletedAt(roundPairings, sessionByPairing);
    const intermissionScheduled =
      completedAt !== null && settings.intermissionAfterRounds.includes(roundNumber);
    const intermissionEndsAt = intermissionScheduled
      ? completedAt + settings.intermissionDurationMinutes * 60_000
      : null;

    let status: GameNightRoundSummary["status"] = "draft";
    if (roundPairings.every((pairing) => pairing.matchStatus === "completed")) {
      status = intermissionEndsAt && intermissionEndsAt > now ? "intermission" : "completed";
    } else if (
      roundPairings.some(
        (pairing) => pairing.status === "active" || pairing.matchStatus === "active",
      )
    ) {
      status = "active";
    } else if (roundPairings.some((pairing) => pairing.status === "ready")) {
      status = "ready";
    }

    return {
      roundNumber,
      status,
      pairings: roundPairings,
      byeTeamIds,
      completedAt,
      intermissionScheduled,
      intermissionEndsAt,
    };
  });
}

export async function getGameNightForUser(
  gameNightId: string,
  userId: string,
): Promise<GameNightSummary> {
  const base = await getBaseGameNightForUser(gameNightId, userId);
  const [settings, pairingRows, sessionRows, teamRows] = await Promise.all([
    getResolvedSettings(gameNightId),
    getPairingRows(gameNightId),
    getSessionRows(gameNightId),
    getDatabase()
      .select({ id: gameNightTeams.id, status: gameNightTeams.status })
      .from(gameNightTeams)
      .where(eq(gameNightTeams.gameNightId, gameNightId)),
  ]);

  const statusByTeam = new Map(teamRows.map((team) => [team.id, team.status]));
  const pairingStatusById = new Map(pairingRows.map((pairing) => [pairing.id, pairingStatus(pairing.status)]));
  const sessionByPairing = new Map(sessionRows.map((session) => [session.pairingId, session]));
  const pairings = base.pairings.map((pairing) => ({
    ...pairing,
    status: pairingStatusById.get(pairing.id) ?? "draft",
  }));
  const teams = base.teams.map((team) => ({
    ...team,
    status: statusByTeam.get(team.id) === "withdrawn" ? ("withdrawn" as const) : ("active" as const),
  }));
  const activeTeamIds = teams.filter((team) => team.status === "active").map((team) => team.id);
  const rounds = buildRounds(pairings, activeTeamIds, settings, sessionByPairing);
  const activeRound = rounds.find((round) => round.status === "ready" || round.status === "active") ?? null;
  const currentRoundNumber = rounds.length ? Math.max(...rounds.map((round) => round.roundNumber)) : 0;
  const currentRound = rounds.find((round) => round.roundNumber === currentRoundNumber) ?? null;

  return {
    ...base,
    settings,
    teams,
    pairings,
    rounds,
    currentRoundNumber,
    activeRoundNumber: activeRound?.roundNumber ?? null,
    completedRoundCount: rounds.filter((round) => round.completedAt !== null).length,
    unpairedTeamIds: currentRound?.byeTeamIds ?? activeTeamIds,
  };
}

export async function listGameNightsForUser(
  leagueId: string,
  userId: string,
): Promise<GameNightSummary[]> {
  const base = await listBaseGameNightsForUser(leagueId, userId);
  return Promise.all(base.map((night) => getGameNightForUser(night.id, userId)));
}

async function persistFixtureSettings(
  gameNightId: string,
  settingsInput: GameNightSettingsSummary,
  now = Date.now(),
) {
  const settings = resolveGameNightSettings(settingsInput);
  await getDatabase()
    .update(gameNightSettings)
    .set({
      roundCount: settings.roundCount,
      pairingStrategy: settings.pairingStrategy,
      roundAdvanceMode: settings.roundAdvanceMode,
      roundAdvanceDelaySeconds: settings.roundAdvanceDelaySeconds,
      intermissionAfterRoundsJson: JSON.stringify(settings.intermissionAfterRounds),
      intermissionDurationMinutes: settings.intermissionDurationMinutes,
      updatedAt: now,
    })
    .where(eq(gameNightSettings.gameNightId, gameNightId));
}

export async function createGameNightForUser(
  input: CreateGameNightForUserInput,
): Promise<GameNightSummary> {
  await createBaseGameNightForUser(input);
  await persistFixtureSettings(input.id, input.settings, input.now);
  return getGameNightForUser(input.id, input.userId);
}

export async function updateGameNightSettingsForUser(
  input: UpdateGameNightSettingsForUserInput,
): Promise<GameNightSummary> {
  await updateBaseGameNightSettingsForUser(input);
  await persistFixtureSettings(input.gameNightId, input.settings, input.now);
  return getGameNightForUser(input.gameNightId, input.userId);
}

async function createRoundRows(input: {
  gameNightId: string;
  roundNumber: number;
  pairings: FixtureRoundPairing[];
  settings: ResolvedGameNightSettings;
  pairingStatus?: GameNightPairingStatus;
  now?: number;
}) {
  const now = input.now ?? Date.now();
  if (!input.pairings.length) return;
  const pairingRows = input.pairings.map((pairing) => ({
    id: crypto.randomUUID(),
    gameNightId: input.gameNightId,
    boardId: pairing.boardId,
    roundNumber: input.roundNumber,
    teamAId: pairing.teamAId,
    teamBId: pairing.teamBId,
    status: input.pairingStatus ?? "draft",
    createdAt: now,
    updatedAt: now,
  }));
  await getDatabase().insert(gameNightBoardPairings).values(pairingRows);
  await getDatabase().insert(leagueMatchSessions).values(
    pairingRows.map((pairing) => ({
      id: crypto.randomUUID(),
      pairingId: pairing.id,
      gameNightId: input.gameNightId,
      boardId: pairing.boardId,
      teamAId: pairing.teamAId,
      teamBId: pairing.teamBId,
      status: "scheduled",
      startingScore: input.settings.startingScore,
      finishRule: input.settings.finishRule,
      legsPerMatch: input.settings.legsPerMatch,
      dummyScore: input.settings.dummyScore,
      winnerTeamId: null,
      startedAt: null,
      completedAt: null,
      createdAt: now,
      updatedAt: now,
    })),
  );
}

async function fixtureInputs(gameNightId: string) {
  const [settings, teams, boards, pairings, sessions] = await Promise.all([
    getResolvedSettings(gameNightId),
    getDatabase()
      .select()
      .from(gameNightTeams)
      .where(eq(gameNightTeams.gameNightId, gameNightId))
      .orderBy(asc(gameNightTeams.teamIndex)),
    getDatabase()
      .select()
      .from(gameNightBoards)
      .where(eq(gameNightBoards.gameNightId, gameNightId))
      .orderBy(asc(gameNightBoards.boardNumber)),
    getPairingRows(gameNightId),
    getSessionRows(gameNightId),
  ]);
  const sessionByPairing = new Map(sessions.map((session) => [session.pairingId, session]));
  const history: FixtureHistoryPairing[] = pairings.map((pairing) => ({
    roundNumber: pairing.roundNumber,
    boardId: pairing.boardId,
    teamAId: pairing.teamAId,
    teamBId: pairing.teamBId,
    winnerTeamId: sessionByPairing.get(pairing.id)?.winnerTeamId ?? null,
  }));
  return {
    settings,
    teams,
    boards,
    pairings,
    sessions,
    history,
    activeTeamIds: teams.filter((team) => team.status !== "withdrawn").map((team) => team.id),
  };
}

async function deleteDraftRound(gameNightId: string, roundNumber: number) {
  const pairings = await getDatabase()
    .select()
    .from(gameNightBoardPairings)
    .where(
      and(
        eq(gameNightBoardPairings.gameNightId, gameNightId),
        eq(gameNightBoardPairings.roundNumber, roundNumber),
      ),
    );
  if (!pairings.length) return;
  const sessions = await getDatabase()
    .select()
    .from(leagueMatchSessions)
    .where(inArray(leagueMatchSessions.pairingId, pairings.map((pairing) => pairing.id)));
  if (
    pairings.some((pairing) => pairing.status !== "draft") ||
    sessions.some((session) => session.status !== "scheduled")
  ) {
    throw new Error("A round can only be regenerated before it becomes playable.");
  }
  await getDatabase()
    .delete(gameNightBoardPairings)
    .where(
      and(
        eq(gameNightBoardPairings.gameNightId, gameNightId),
        eq(gameNightBoardPairings.roundNumber, roundNumber),
      ),
    );
}

async function generateRound(
  gameNightId: string,
  roundNumber: number,
  strategy?: FixturePairingStrategy,
) {
  const input = await fixtureInputs(gameNightId);
  if (input.activeTeamIds.length < 2) {
    throw new Error("At least two active teams are required to generate another round.");
  }
  const pairCount = Math.floor(input.activeTeamIds.length / 2);
  if (pairCount > input.boards.length) {
    throw new Error("There are not enough boards for every active team to play this synchronized round.");
  }
  const priorHistory = input.history.filter((pairing) => pairing.roundNumber < roundNumber);
  const plan = generateFixtureRound({
    teamIds: input.activeTeamIds,
    boardIds: input.boards.map((board) => board.id),
    roundNumber,
    strategy: strategy ?? input.settings.pairingStrategy,
    boardRotationType: input.settings.boardRotationType,
    history: priorHistory,
  });
  await createRoundRows({
    gameNightId,
    roundNumber,
    pairings: plan.pairings,
    settings: input.settings,
    pairingStatus: "draft",
  });
  return plan;
}

export async function populateGameNightBoardsForUser(
  gameNightId: string,
  userId: string,
): Promise<GameNightSummary> {
  await requireAdmin(gameNightId, userId);
  // Reuse the established team-size/dummy/board validation, then replace its
  // legacy ordered Round 1 with a fixture-engine-generated draft.
  await populateBaseGameNightBoardsForUser(gameNightId, userId);
  await getDatabase()
    .delete(gameNightBoardPairings)
    .where(eq(gameNightBoardPairings.gameNightId, gameNightId));
  await generateRound(gameNightId, 1);
  await getDatabase()
    .update(gameNights)
    .set({ status: "ready", updatedAt: Date.now() })
    .where(eq(gameNights.id, gameNightId));
  return getGameNightForUser(gameNightId, userId);
}

export async function regenerateGameNightRoundForUser(
  gameNightId: string,
  roundNumber: number,
  userId: string,
  strategy?: FixturePairingStrategy,
): Promise<GameNightSummary> {
  await requireAdmin(gameNightId, userId);
  await deleteDraftRound(gameNightId, roundNumber);
  await generateRound(gameNightId, roundNumber, strategy);
  return getGameNightForUser(gameNightId, userId);
}

export async function replaceGameNightRoundFixturesForUser(input: {
  gameNightId: string;
  roundNumber: number;
  userId: string;
  pairings: FixtureRoundPairing[];
}): Promise<GameNightSummary> {
  await requireAdmin(input.gameNightId, input.userId);
  const fixture = await fixtureInputs(input.gameNightId);
  const active = new Set(fixture.activeTeamIds);
  const boardIds = new Set(fixture.boards.map((board) => board.id));
  const usedTeams = new Set<string>();
  const usedBoards = new Set<string>();

  for (const pairing of input.pairings) {
    if (!boardIds.has(pairing.boardId)) throw new Error("A fixture references a board outside this Game Night.");
    if (!active.has(pairing.teamAId) || !active.has(pairing.teamBId)) {
      throw new Error("Only active teams can be assigned to a fixture.");
    }
    if (pairing.teamAId === pairing.teamBId) throw new Error("A team cannot play itself.");
    if (usedTeams.has(pairing.teamAId) || usedTeams.has(pairing.teamBId)) {
      throw new Error("Each team can appear only once in a synchronized round.");
    }
    if (usedBoards.has(pairing.boardId)) throw new Error("Each board can host only one match in a round.");
    usedTeams.add(pairing.teamAId);
    usedTeams.add(pairing.teamBId);
    usedBoards.add(pairing.boardId);
  }

  await deleteDraftRound(input.gameNightId, input.roundNumber);
  await createRoundRows({
    gameNightId: input.gameNightId,
    roundNumber: input.roundNumber,
    pairings: input.pairings,
    settings: fixture.settings,
    pairingStatus: "draft",
  });
  return getGameNightForUser(input.gameNightId, input.userId);
}

export async function activateGameNightRound(
  gameNightId: string,
  roundNumber: number,
) {
  const pairings = await getDatabase()
    .select()
    .from(gameNightBoardPairings)
    .where(
      and(
        eq(gameNightBoardPairings.gameNightId, gameNightId),
        eq(gameNightBoardPairings.roundNumber, roundNumber),
      ),
    );
  if (!pairings.length) throw new Error("Generate this round before starting it.");
  if (pairings.some((pairing) => pairing.status !== "draft")) {
    if (pairings.every((pairing) => pairing.status === "ready" || pairing.status === "active" || pairing.status === "completed")) {
      return;
    }
    throw new Error("This round is not in a startable state.");
  }
  await getDatabase()
    .update(gameNightBoardPairings)
    .set({ status: "ready", updatedAt: Date.now() })
    .where(
      and(
        eq(gameNightBoardPairings.gameNightId, gameNightId),
        eq(gameNightBoardPairings.roundNumber, roundNumber),
      ),
    );
}

export async function startNextGameNightRoundForUser(
  gameNightId: string,
  userId: string,
  options?: { endIntermissionEarly?: boolean },
): Promise<GameNightSummary> {
  await requireAdmin(gameNightId, userId);
  const night = await getGameNightForUser(gameNightId, userId);
  const settings = resolveGameNightSettings(night.settings);
  const rounds = night.rounds ?? [];
  if (!rounds.length) throw new Error("Populate the boards before starting rounds.");

  const draft = [...rounds].reverse().find((round) => round.status === "draft");
  if (!draft) throw new Error("There is no prepared round waiting to start.");
  const previous = rounds.find((round) => round.roundNumber === draft.roundNumber - 1) ?? null;
  if (previous && previous.completedAt === null) {
    throw new Error("All board matches in the current round must finish before the next round starts.");
  }
  if (
    previous?.intermissionEndsAt &&
    previous.intermissionEndsAt > Date.now() &&
    !options?.endIntermissionEarly
  ) {
    throw new Error("The scheduled intermission is still active.");
  }
  if (draft.roundNumber > settings.roundCount) throw new Error("The configured final round has already been reached.");
  await activateGameNightRound(gameNightId, draft.roundNumber);
  return getGameNightForUser(gameNightId, userId);
}

export async function prepareNextRoundAfterCompletion(gameNightId: string) {
  const fixture = await fixtureInputs(gameNightId);
  if (!fixture.pairings.length) return;
  const highest = Math.max(...fixture.pairings.map((pairing) => pairing.roundNumber));
  const current = fixture.pairings.filter((pairing) => pairing.roundNumber === highest);
  const sessionByPairing = new Map(fixture.sessions.map((session) => [session.pairingId, session]));
  const currentComplete = current.length > 0 && current.every((pairing) => sessionByPairing.get(pairing.id)?.status === "completed");
  if (!currentComplete || highest >= fixture.settings.roundCount) return;
  if (fixture.pairings.some((pairing) => pairing.roundNumber === highest + 1)) return;
  await generateRound(gameNightId, highest + 1);
}

export async function activateAutomaticRoundIfDue(gameNightId: string) {
  const fixture = await fixtureInputs(gameNightId);
  if (fixture.settings.roundAdvanceMode !== "automatic" || !fixture.pairings.length) return false;
  const rounds = [...new Set(fixture.pairings.map((pairing) => pairing.roundNumber))].sort((a, b) => a - b);
  const draftRound = rounds.find((roundNumber) =>
    fixture.pairings
      .filter((pairing) => pairing.roundNumber === roundNumber)
      .every((pairing) => pairing.status === "draft"),
  );
  if (!draftRound || draftRound === 1) return false;
  const previousNumber = draftRound - 1;
  const previousPairings = fixture.pairings.filter((pairing) => pairing.roundNumber === previousNumber);
  const sessionByPairing = new Map(fixture.sessions.map((session) => [session.pairingId, session]));
  if (!previousPairings.length || previousPairings.some((pairing) => sessionByPairing.get(pairing.id)?.status !== "completed")) return false;
  const completedTimes = previousPairings
    .map((pairing) => sessionByPairing.get(pairing.id)?.completedAt ?? null)
    .filter((value): value is number => value !== null);
  if (!completedTimes.length) return false;
  const completedAt = Math.max(...completedTimes);
  const waitMs = fixture.settings.intermissionAfterRounds.includes(previousNumber)
    ? fixture.settings.intermissionDurationMinutes * 60_000
    : fixture.settings.roundAdvanceDelaySeconds * 1_000;
  if (Date.now() < completedAt + waitMs) return false;
  await activateGameNightRound(gameNightId, draftRound);
  return true;
}

export async function setGameNightTeamStatusForUser(
  gameNightId: string,
  teamId: string,
  status: GameNightTeamStatus,
  userId: string,
): Promise<GameNightSummary> {
  await requireAdmin(gameNightId, userId);
  const fixture = await fixtureInputs(gameNightId);
  const team = fixture.teams.find((item) => item.id === teamId);
  if (!team) throw new Error("Team does not belong to this Game Night.");
  if (status === "withdrawn") {
    const blockingPairing = fixture.pairings.find(
      (pairing) =>
        (pairing.teamAId === teamId || pairing.teamBId === teamId) &&
        pairing.status !== "draft" &&
        pairing.status !== "completed",
    );
    if (blockingPairing) {
      throw new Error("Finish the team's current playable match before withdrawing it.");
    }
  }

  await getDatabase()
    .update(gameNightTeams)
    .set({ status, updatedAt: Date.now() })
    .where(and(eq(gameNightTeams.id, teamId), eq(gameNightTeams.gameNightId, gameNightId)));

  const draftRounds = [...new Set(fixture.pairings.filter((pairing) => pairing.status === "draft").map((pairing) => pairing.roundNumber))];
  for (const roundNumber of draftRounds) {
    await deleteDraftRound(gameNightId, roundNumber);
    await generateRound(gameNightId, roundNumber);
  }
  return getGameNightForUser(gameNightId, userId);
}
