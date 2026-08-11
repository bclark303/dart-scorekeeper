import { and, asc, desc, eq } from "drizzle-orm";

import type {
  LeagueMatchFinishRule,
  LeagueMatchMemberSummary,
  LeagueMatchStatus,
  LeagueMatchSummary,
  LeagueMatchTeamSummary,
} from "@/lib/league/matchContracts";
import { getDatabase } from "../client";
import {
  gameNightBoardPairings,
  gameNightBoards,
  gameNightTeamMembers,
  gameNightTeams,
  gameNights,
} from "../game-night-schema";
import { leagueMatchSessions, leagueMatchTurns } from "../league-match-schema";
import { leagueMemberships, seasons } from "../schema";
import { LeaguePermissionError } from "./leagues";

export class LeagueMatchStateError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "LeagueMatchStateError";
  }
}

type MatchContext = {
  session: typeof leagueMatchSessions.$inferSelect;
  leagueId: string;
  gameNightName: string;
  gameNightStatus: string;
  seasonName: string;
  scheduledAt: number;
  boardNumber: number;
  boardName: string;
};

type TeamContext = {
  id: string;
  name: string;
  members: LeagueMatchMemberSummary[];
};

type DerivedMatchState = {
  currentLegNumber: number;
  currentTeamId: string | null;
  currentMemberId: string | null;
  currentMemberName: string | null;
  teamAScore: number;
  teamBScore: number;
  teamALegs: number;
  teamBLegs: number;
  isComplete: boolean;
  winnerTeamId: string | null;
};

function asStatus(value: string): LeagueMatchStatus {
  if (value === "scheduled" || value === "active" || value === "completed") {
    return value;
  }
  throw new Error(`Unsupported league match status: ${value}`);
}

function asFinishRule(value: string): LeagueMatchFinishRule {
  if (value === "straight" || value === "double") return value;
  throw new Error(`Unsupported league match finish rule: ${value}`);
}

async function getMatchContext(matchId: string): Promise<MatchContext> {
  const [row] = await getDatabase()
    .select({
      session: leagueMatchSessions,
      leagueId: seasons.leagueId,
      gameNightName: gameNights.name,
      gameNightStatus: gameNights.status,
      seasonName: seasons.name,
      scheduledAt: gameNights.scheduledAt,
      boardNumber: gameNightBoards.boardNumber,
      boardName: gameNightBoards.name,
    })
    .from(leagueMatchSessions)
    .innerJoin(gameNights, eq(leagueMatchSessions.gameNightId, gameNights.id))
    .innerJoin(seasons, eq(gameNights.seasonId, seasons.id))
    .innerJoin(gameNightBoards, eq(leagueMatchSessions.boardId, gameNightBoards.id))
    .where(eq(leagueMatchSessions.id, matchId))
    .limit(1);

  if (!row) throw new LeagueMatchStateError("League match was not found.");
  return row;
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
  if (!role) throw new LeaguePermissionError("League membership is required.");
  return role;
}

async function requireLeagueAdmin(leagueId: string, userId: string) {
  const role = await requireLeagueMember(leagueId, userId);
  if (role !== "owner" && role !== "admin") throw new LeaguePermissionError();
}

async function getTeamContext(teamId: string): Promise<TeamContext> {
  const [team] = await getDatabase()
    .select({ id: gameNightTeams.id, name: gameNightTeams.name })
    .from(gameNightTeams)
    .where(eq(gameNightTeams.id, teamId))
    .limit(1);
  if (!team) throw new LeagueMatchStateError("Assigned team was not found.");

  const members = await getDatabase()
    .select({
      id: gameNightTeamMembers.id,
      leaguePlayerId: gameNightTeamMembers.leaguePlayerId,
      displayName: gameNightTeamMembers.displayName,
      isDummy: gameNightTeamMembers.isDummy,
      slotIndex: gameNightTeamMembers.slotIndex,
    })
    .from(gameNightTeamMembers)
    .where(eq(gameNightTeamMembers.teamId, teamId))
    .orderBy(asc(gameNightTeamMembers.slotIndex));

  if (!members.length) {
    throw new LeagueMatchStateError(`${team.name} has no players assigned.`);
  }
  return { ...team, members };
}

function startingMemberIndex(legNumber: number, members: LeagueMatchMemberSummary[]) {
  return (legNumber - 1) % members.length;
}

function deriveMatchState(
  context: MatchContext,
  teamA: TeamContext,
  teamB: TeamContext,
  turns: (typeof leagueMatchTurns.$inferSelect)[],
): DerivedMatchState {
  let currentLegNumber = 1;
  let teamAScore = context.session.startingScore;
  let teamBScore = context.session.startingScore;
  let teamALegs = 0;
  let teamBLegs = 0;
  let teamAMemberIndex = startingMemberIndex(1, teamA.members);
  let teamBMemberIndex = startingMemberIndex(1, teamB.members);
  let currentTeamId: string | null = teamA.id;
  let isComplete = false;

  for (const turn of turns.filter((item) => item.voidedAt === null)) {
    if (isComplete) break;

    if (turn.teamId === teamA.id) {
      teamAScore = turn.scoreAfter;
      teamAMemberIndex = (teamAMemberIndex + 1) % teamA.members.length;
    } else if (turn.teamId === teamB.id) {
      teamBScore = turn.scoreAfter;
      teamBMemberIndex = (teamBMemberIndex + 1) % teamB.members.length;
    } else {
      throw new LeagueMatchStateError("Stored turn references an unexpected team.");
    }

    if (turn.isCheckout) {
      if (turn.teamId === teamA.id) teamALegs += 1;
      else teamBLegs += 1;

      if (currentLegNumber >= context.session.legsPerMatch) {
        isComplete = true;
        currentTeamId = null;
        break;
      }

      currentLegNumber += 1;
      teamAScore = context.session.startingScore;
      teamBScore = context.session.startingScore;
      teamAMemberIndex = startingMemberIndex(currentLegNumber, teamA.members);
      teamBMemberIndex = startingMemberIndex(currentLegNumber, teamB.members);
      currentTeamId = currentLegNumber % 2 === 1 ? teamA.id : teamB.id;
      continue;
    }

    currentTeamId = turn.teamId === teamA.id ? teamB.id : teamA.id;
  }

  const currentMember =
    currentTeamId === teamA.id
      ? teamA.members[teamAMemberIndex]
      : currentTeamId === teamB.id
        ? teamB.members[teamBMemberIndex]
        : null;

  return {
    currentLegNumber,
    currentTeamId,
    currentMemberId: currentMember?.id ?? null,
    currentMemberName: currentMember?.displayName ?? null,
    teamAScore,
    teamBScore,
    teamALegs,
    teamBLegs,
    isComplete,
    winnerTeamId: isComplete
      ? teamALegs === teamBLegs
        ? null
        : teamALegs > teamBLegs
          ? teamA.id
          : teamB.id
      : null,
  };
}

async function loadMatchPieces(matchId: string) {
  const context = await getMatchContext(matchId);
  const [teamA, teamB, turns] = await Promise.all([
    getTeamContext(context.session.teamAId),
    getTeamContext(context.session.teamBId),
    getDatabase()
      .select()
      .from(leagueMatchTurns)
      .where(eq(leagueMatchTurns.matchSessionId, matchId))
      .orderBy(asc(leagueMatchTurns.turnIndex)),
  ]);
  return { context, teamA, teamB, turns };
}

function teamSummary(
  team: TeamContext,
  legsWon: number,
  score: number,
): LeagueMatchTeamSummary {
  return {
    id: team.id,
    name: team.name,
    legsWon,
    score,
    members: team.members,
  };
}

async function buildLeagueMatchSummary(matchId: string): Promise<LeagueMatchSummary> {
  const { context, teamA, teamB, turns } = await loadMatchPieces(matchId);
  const state = deriveMatchState(context, teamA, teamB, turns);
  const activeTurns = turns.filter((turn) => turn.voidedAt === null);
  const storedStatus = asStatus(context.session.status);
  const status: LeagueMatchStatus = state.isComplete
    ? "completed"
    : storedStatus === "scheduled"
      ? "scheduled"
      : "active";

  return {
    id: context.session.id,
    pairingId: context.session.pairingId,
    gameNightId: context.session.gameNightId,
    gameNightName: context.gameNightName,
    gameNightStatus: context.gameNightStatus,
    seasonName: context.seasonName,
    scheduledAt: context.scheduledAt,
    boardId: context.session.boardId,
    boardNumber: context.boardNumber,
    boardName: context.boardName,
    status,
    startingScore: context.session.startingScore,
    finishRule: asFinishRule(context.session.finishRule),
    legsPerMatch: context.session.legsPerMatch,
    dummyScore: context.session.dummyScore,
    currentLegNumber: state.currentLegNumber,
    currentTeamId: state.currentTeamId,
    currentMemberId: state.currentMemberId,
    currentMemberName: state.currentMemberName,
    winnerTeamId: state.winnerTeamId,
    teamA: teamSummary(teamA, state.teamALegs, state.teamAScore),
    teamB: teamSummary(teamB, state.teamBLegs, state.teamBScore),
    turns: [...activeTurns]
      .reverse()
      .map((turn) => ({
        id: turn.id,
        turnIndex: turn.turnIndex,
        legNumber: turn.legNumber,
        teamId: turn.teamId,
        teamMemberId: turn.teamMemberId,
        leaguePlayerId: turn.leaguePlayerId,
        displayName: turn.displayName,
        isDummy: turn.isDummy,
        scoreEntered: turn.scoreEntered,
        scoreBefore: turn.scoreBefore,
        scoreAfter: turn.scoreAfter,
        dartsThrown: turn.dartsThrown,
        isBust: turn.isBust,
        isCheckout: turn.isCheckout,
        createdAt: turn.createdAt,
      })),
    canUndo: activeTurns.length > 0,
    startedAt: context.session.startedAt,
    completedAt: state.isComplete ? context.session.completedAt : null,
    updatedAt: context.session.updatedAt,
  };
}

export async function getLeagueMatchForUser(
  matchId: string,
  userId: string,
): Promise<LeagueMatchSummary> {
  const context = await getMatchContext(matchId);
  await requireLeagueMember(context.leagueId, userId);
  return buildLeagueMatchSummary(matchId);
}

export async function startLeagueMatchForUser(
  matchId: string,
  userId: string,
): Promise<LeagueMatchSummary> {
  const context = await getMatchContext(matchId);
  await requireLeagueAdmin(context.leagueId, userId);
  if (context.gameNightStatus !== "active") {
    throw new LeagueMatchStateError("Start the game night before starting a board match.");
  }
  if (context.session.status === "completed") {
    throw new LeagueMatchStateError("This board match is already complete.");
  }
  if (context.session.status === "scheduled") {
    const now = Date.now();
    await getDatabase()
      .update(leagueMatchSessions)
      .set({ status: "active", startedAt: now, updatedAt: now })
      .where(eq(leagueMatchSessions.id, matchId));
    await getDatabase()
      .update(gameNightBoardPairings)
      .set({ status: "active", updatedAt: now })
      .where(eq(gameNightBoardPairings.id, context.session.pairingId));
  }
  return buildLeagueMatchSummary(matchId);
}

export async function submitLeagueMatchTurnForUser(input: {
  matchId: string;
  userId: string;
  turnId: string;
  scoreEntered: number;
  dartsThrown: 1 | 2 | 3;
  checkoutConfirmed?: boolean;
}): Promise<LeagueMatchSummary> {
  const context = await getMatchContext(input.matchId);
  await requireLeagueAdmin(context.leagueId, input.userId);

  const [existing] = await getDatabase()
    .select({ id: leagueMatchTurns.id })
    .from(leagueMatchTurns)
    .where(eq(leagueMatchTurns.id, input.turnId))
    .limit(1);
  if (existing) return buildLeagueMatchSummary(input.matchId);

  if (context.session.status !== "active") {
    throw new LeagueMatchStateError("Start this board match before entering scores.");
  }
  if (!Number.isInteger(input.scoreEntered) || input.scoreEntered < 0 || input.scoreEntered > 180) {
    throw new LeagueMatchStateError("Score must be a whole number from 0 to 180.");
  }
  if (![1, 2, 3].includes(input.dartsThrown)) {
    throw new LeagueMatchStateError("Darts thrown must be 1, 2, or 3.");
  }

  const { teamA, teamB, turns } = await loadMatchPieces(input.matchId);
  const state = deriveMatchState(context, teamA, teamB, turns);
  if (state.isComplete || !state.currentTeamId || !state.currentMemberId) {
    throw new LeagueMatchStateError("This board match is already complete.");
  }

  const currentTeam = state.currentTeamId === teamA.id ? teamA : teamB;
  const currentMember = currentTeam.members.find((member) => member.id === state.currentMemberId);
  if (!currentMember) throw new LeagueMatchStateError("Current thrower could not be resolved.");

  const scoreBefore = state.currentTeamId === teamA.id ? state.teamAScore : state.teamBScore;
  const calculatedScore = scoreBefore - input.scoreEntered;
  const finishRule = asFinishRule(context.session.finishRule);
  const bustForRemainder = calculatedScore < 0 || (finishRule === "double" && calculatedScore === 1);
  const reachedZero = calculatedScore === 0;
  const confirmedCheckout = reachedZero && (finishRule === "straight" || input.checkoutConfirmed === true);
  const isBust = bustForRemainder || (reachedZero && !confirmedCheckout);
  const isCheckout = reachedZero && !isBust;
  const scoreAfter = isBust ? scoreBefore : calculatedScore;
  const turnIndex = turns.length ? Math.max(...turns.map((turn) => turn.turnIndex)) + 1 : 1;
  const now = Date.now();

  await getDatabase().insert(leagueMatchTurns).values({
    id: input.turnId,
    matchSessionId: input.matchId,
    turnIndex,
    legNumber: state.currentLegNumber,
    teamId: currentTeam.id,
    teamMemberId: currentMember.id,
    leaguePlayerId: currentMember.leaguePlayerId,
    displayName: currentMember.displayName,
    isDummy: currentMember.isDummy,
    scoreEntered: input.scoreEntered,
    scoreBefore,
    scoreAfter,
    dartsThrown: input.dartsThrown,
    isBust,
    isCheckout,
    checkoutConfirmed: input.checkoutConfirmed === true,
    voidedAt: null,
    createdAt: now,
  });

  const updated = await buildLeagueMatchSummary(input.matchId);
  if (updated.status === "completed") {
    await getDatabase()
      .update(leagueMatchSessions)
      .set({
        status: "completed",
        winnerTeamId: updated.winnerTeamId,
        completedAt: now,
        updatedAt: now,
      })
      .where(eq(leagueMatchSessions.id, input.matchId));
    await getDatabase()
      .update(gameNightBoardPairings)
      .set({ status: "completed", updatedAt: now })
      .where(eq(gameNightBoardPairings.id, context.session.pairingId));
  } else {
    await getDatabase()
      .update(leagueMatchSessions)
      .set({ updatedAt: now })
      .where(eq(leagueMatchSessions.id, input.matchId));
  }

  return buildLeagueMatchSummary(input.matchId);
}

export async function undoLastLeagueMatchTurnForUser(
  matchId: string,
  userId: string,
): Promise<LeagueMatchSummary> {
  const context = await getMatchContext(matchId);
  await requireLeagueAdmin(context.leagueId, userId);
  if (context.session.status === "scheduled") {
    throw new LeagueMatchStateError("There is no scored turn to undo.");
  }

  const [lastTurn] = await getDatabase()
    .select({ id: leagueMatchTurns.id })
    .from(leagueMatchTurns)
    .where(
      and(
        eq(leagueMatchTurns.matchSessionId, matchId),
        eq(leagueMatchTurns.voidedAt, null),
      ),
    )
    .orderBy(desc(leagueMatchTurns.turnIndex))
    .limit(1);
  if (!lastTurn) throw new LeagueMatchStateError("There is no scored turn to undo.");

  const now = Date.now();
  await getDatabase()
    .update(leagueMatchTurns)
    .set({ voidedAt: now })
    .where(eq(leagueMatchTurns.id, lastTurn.id));
  await getDatabase()
    .update(leagueMatchSessions)
    .set({
      status: "active",
      winnerTeamId: null,
      completedAt: null,
      updatedAt: now,
    })
    .where(eq(leagueMatchSessions.id, matchId));
  await getDatabase()
    .update(gameNightBoardPairings)
    .set({ status: "active", updatedAt: now })
    .where(eq(gameNightBoardPairings.id, context.session.pairingId));

  return buildLeagueMatchSummary(matchId);
}
