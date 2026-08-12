import { and, desc, eq, inArray } from "drizzle-orm";

import type {
  BoardDeviceAssignmentSummary,
  BoardDeviceSummary,
} from "@/lib/league/boardDeviceContracts";
import type { LeagueMatchSummary } from "@/lib/league/matchContracts";
import { getDatabase } from "../client";
import {
  gameNightBoardPairings,
  gameNightBoards,
  gameNightTeams,
  gameNights,
} from "../game-night-schema";
import { leagueMatchSessions } from "../league-match-schema";
import { seasons } from "../schema";
import {
  authenticateBoardDeviceCredential,
  BoardDeviceAssignmentError,
} from "./boardDevices";
import {
  assertMatchRoundPlayable,
  activateAutomaticRoundsForLeague,
  discardFutureDraftRounds,
  getMatchRoundForUndo,
} from "./gameNightFixtureGuards";
import {
  getLeagueMatchAfterAuthorization,
  startLeagueMatchAfterAuthorization,
  undoLastLeagueMatchTurnAfterAuthorization,
} from "./leagueMatches";

export async function getBoardDeviceAssignment(
  device: BoardDeviceSummary,
): Promise<BoardDeviceAssignmentSummary | null> {
  // Registered boards poll this read path every few seconds, which makes it a
  // safe idempotent wake-up point for delayed automatic round activation.
  await activateAutomaticRoundsForLeague(device.leagueId);

  const rows = await getDatabase()
    .select({
      gameNightId: gameNights.id,
      gameNightName: gameNights.name,
      gameNightStatus: gameNights.status,
      scheduledAt: gameNights.scheduledAt,
      boardId: gameNightBoards.id,
      boardName: gameNightBoards.name,
      boardNumber: gameNightBoards.boardNumber,
      roundNumber: gameNightBoardPairings.roundNumber,
      pairingId: gameNightBoardPairings.id,
      teamAId: gameNightBoardPairings.teamAId,
      teamBId: gameNightBoardPairings.teamBId,
      pairingStatus: gameNightBoardPairings.status,
      matchSessionId: leagueMatchSessions.id,
      matchStatus: leagueMatchSessions.status,
    })
    .from(gameNights)
    .innerJoin(seasons, eq(gameNights.seasonId, seasons.id))
    .innerJoin(
      gameNightBoards,
      and(
        eq(gameNightBoards.gameNightId, gameNights.id),
        eq(gameNightBoards.boardNumber, device.boardNumber),
      ),
    )
    .leftJoin(
      gameNightBoardPairings,
      and(
        eq(gameNightBoardPairings.gameNightId, gameNights.id),
        eq(gameNightBoardPairings.boardId, gameNightBoards.id),
        inArray(gameNightBoardPairings.status, ["ready", "active", "completed"]),
      ),
    )
    .leftJoin(
      leagueMatchSessions,
      eq(leagueMatchSessions.pairingId, gameNightBoardPairings.id),
    )
    .where(
      and(
        eq(seasons.leagueId, device.leagueId),
        inArray(gameNights.status, ["ready", "active"]),
      ),
    )
    .orderBy(
      desc(gameNights.scheduledAt),
      desc(gameNightBoardPairings.roundNumber),
    );

  if (!rows.length) return null;
  const activeRows = rows.filter((item) => item.gameNightStatus === "active");
  const row =
    activeRows.find((item) => item.matchSessionId) ??
    activeRows[0] ??
    rows.find((item) => item.matchSessionId) ??
    rows[0];

  let teamAName: string | null = null;
  let teamBName: string | null = null;
  if (row.teamAId) {
    const [team] = await getDatabase()
      .select({ name: gameNightTeams.name })
      .from(gameNightTeams)
      .where(eq(gameNightTeams.id, row.teamAId))
      .limit(1);
    teamAName = team?.name ?? null;
  }
  if (row.teamBId) {
    const [team] = await getDatabase()
      .select({ name: gameNightTeams.name })
      .from(gameNightTeams)
      .where(eq(gameNightTeams.id, row.teamBId))
      .limit(1);
    teamBName = team?.name ?? null;
  }

  const matchStatus =
    row.matchStatus === "active" || row.matchStatus === "completed"
      ? row.matchStatus
      : row.matchSessionId
        ? "scheduled"
        : null;

  return {
    gameNightId: row.gameNightId,
    gameNightName: row.gameNightName,
    gameNightStatus: row.gameNightStatus,
    scheduledAt: row.scheduledAt,
    boardId: row.boardId,
    boardName: row.boardName,
    boardNumber: row.boardNumber,
    roundNumber: row.roundNumber ?? undefined,
    matchSessionId: row.matchSessionId,
    matchStatus,
    teamAName,
    teamBName,
  };
}

async function requireAssignedMatch(deviceKey: string, matchId: string) {
  const device = await authenticateBoardDeviceCredential(deviceKey);
  const assignment = await getBoardDeviceAssignment(device);
  if (!assignment?.matchSessionId) {
    throw new BoardDeviceAssignmentError(
      "This board does not currently have a match assignment.",
    );
  }
  if (assignment.matchSessionId !== matchId) {
    throw new BoardDeviceAssignmentError(
      "That match is not assigned to this board in the current round state.",
    );
  }
  return { device, assignment };
}

export async function getBoardDeviceConnectionForCredential(deviceKey: string): Promise<{
  device: BoardDeviceSummary;
  assignment: BoardDeviceAssignmentSummary | null;
  match: LeagueMatchSummary | null;
}> {
  const device = await authenticateBoardDeviceCredential(deviceKey);
  const assignment = await getBoardDeviceAssignment(device);
  const match = assignment?.matchSessionId
    ? await getLeagueMatchAfterAuthorization(assignment.matchSessionId)
    : null;
  return { device, assignment, match };
}

export async function getBoardDeviceMatchForCredential(
  deviceKey: string,
  matchId: string,
): Promise<LeagueMatchSummary> {
  await requireAssignedMatch(deviceKey, matchId);
  return getLeagueMatchAfterAuthorization(matchId);
}

export async function startBoardDeviceMatchForCredential(
  deviceKey: string,
  matchId: string,
): Promise<LeagueMatchSummary> {
  await requireAssignedMatch(deviceKey, matchId);
  await assertMatchRoundPlayable(matchId);
  return startLeagueMatchAfterAuthorization(matchId);
}

export async function undoBoardDeviceTurnForCredential(
  deviceKey: string,
  matchId: string,
): Promise<LeagueMatchSummary> {
  await requireAssignedMatch(deviceKey, matchId);
  const round = await getMatchRoundForUndo(matchId);
  const updated = await undoLastLeagueMatchTurnAfterAuthorization(matchId);
  await discardFutureDraftRounds(round.gameNightId, round.roundNumber);
  return updated;
}
