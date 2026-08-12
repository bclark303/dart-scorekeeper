import type {
  LeagueMatchExpectedState,
  LeagueMatchMutationRequest,
  LeagueMatchScoreRequest,
  LeagueMatchSummary,
  LeagueMatchTeamSummary,
} from "@/lib/league/matchContracts";
import { legsNeededToWin } from "@/lib/league/matchFormat";
import { evaluateX01Turn } from "@/lib/x01Engine";

function startingMemberIndex(legNumber: number, team: LeagueMatchTeamSummary) {
  return (legNumber - 1) % team.members.length;
}

function currentMemberForTeam(
  team: LeagueMatchTeamSummary,
  legNumber: number,
  turns: LeagueMatchSummary["turns"],
) {
  const turnsTaken = turns.filter(
    (turn) => turn.legNumber === legNumber && turn.teamId === team.id,
  ).length;
  const index = (startingMemberIndex(legNumber, team) + turnsTaken) % team.members.length;
  return team.members[index] ?? null;
}

export function expectedStateForLeagueMatch(
  match: LeagueMatchSummary,
): LeagueMatchExpectedState {
  if (!match.currentTeamId || !match.currentMemberId) {
    throw new Error("The match does not have a current thrower.");
  }
  const currentTeam =
    match.currentTeamId === match.teamA.id
      ? match.teamA
      : match.currentTeamId === match.teamB.id
        ? match.teamB
        : null;
  if (!currentTeam) throw new Error("The current team could not be resolved.");

  return {
    activeTurnCount: match.turns.length,
    lastTurnId: match.turns[0]?.id ?? null,
    currentLegNumber: match.currentLegNumber,
    currentTeamId: match.currentTeamId,
    currentMemberId: match.currentMemberId,
    scoreBefore: currentTeam.score,
  };
}

function applyStart(match: LeagueMatchSummary, now: number): LeagueMatchSummary {
  if (match.status === "completed") {
    throw new Error("This board match is already complete.");
  }
  if (match.status === "active") return match;
  if (match.gameNightStatus !== "active") {
    throw new Error("The Game Night must be active before this board can start offline.");
  }
  return {
    ...match,
    status: "active",
    startedAt: match.startedAt ?? now,
    updatedAt: now,
  };
}

function applyScore(
  match: LeagueMatchSummary,
  request: LeagueMatchScoreRequest,
  now: number,
): LeagueMatchSummary {
  if (match.status !== "active") {
    throw new Error("Start this board match before entering scores.");
  }
  if (!match.currentTeamId || !match.currentMemberId) {
    throw new Error("This board match is already complete.");
  }

  const currentTeamIsA = match.currentTeamId === match.teamA.id;
  const currentTeam = currentTeamIsA ? match.teamA : match.teamB;
  const otherTeam = currentTeamIsA ? match.teamB : match.teamA;
  const currentMember = currentTeam.members.find(
    (member) => member.id === match.currentMemberId,
  );
  if (!currentMember) throw new Error("Current thrower could not be resolved.");

  const evaluation = evaluateX01Turn({
    scoreBefore: currentTeam.score,
    scoreEntered: request.scoreEntered,
    finishRule: match.finishRule === "double" ? "double_out" : "straight_out",
    dartsThrown: request.dartsThrown,
    darts: request.darts,
    checkoutConfirmed:
      request.darts === undefined ? request.checkoutConfirmed === true : undefined,
  });

  const turnIndex = match.turns.length
    ? Math.max(...match.turns.map((turn) => turn.turnIndex)) + 1
    : 1;
  const newTurn: LeagueMatchSummary["turns"][number] = {
    id: request.turnId,
    turnIndex,
    legNumber: match.currentLegNumber,
    teamId: currentTeam.id,
    teamMemberId: currentMember.id,
    leaguePlayerId: currentMember.leaguePlayerId,
    displayName: currentMember.displayName,
    isDummy: currentMember.isDummy,
    scoreEntered: request.scoreEntered,
    scoreBefore: currentTeam.score,
    scoreAfter: evaluation.scoreAfter,
    dartsThrown: request.dartsThrown,
    isBust: evaluation.isBust,
    isCheckout: evaluation.isCheckout,
    darts: request.darts ?? [],
    createdAt: now,
  };
  const turns = [newTurn, ...match.turns];

  let teamA: LeagueMatchTeamSummary = currentTeamIsA
    ? { ...match.teamA, score: evaluation.scoreAfter }
    : { ...match.teamA };
  let teamB: LeagueMatchTeamSummary = currentTeamIsA
    ? { ...match.teamB }
    : { ...match.teamB, score: evaluation.scoreAfter };

  if (evaluation.isCheckout) {
    if (currentTeamIsA) teamA = { ...teamA, legsWon: teamA.legsWon + 1 };
    else teamB = { ...teamB, legsWon: teamB.legsWon + 1 };

    const legsRequired = legsNeededToWin(match.legsPerMatch);
    const complete = teamA.legsWon >= legsRequired || teamB.legsWon >= legsRequired;
    if (complete) {
      return {
        ...match,
        status: "completed",
        currentTeamId: null,
        currentMemberId: null,
        currentMemberName: null,
        winnerTeamId: teamA.legsWon > teamB.legsWon ? teamA.id : teamB.id,
        teamA,
        teamB,
        turns,
        canUndo: true,
        completedAt: now,
        updatedAt: now,
      };
    }

    const currentLegNumber = match.currentLegNumber + 1;
    teamA = { ...teamA, score: match.startingScore };
    teamB = { ...teamB, score: match.startingScore };
    const nextTeam = currentLegNumber % 2 === 1 ? teamA : teamB;
    const nextMember = nextTeam.members[startingMemberIndex(currentLegNumber, nextTeam)] ?? null;
    return {
      ...match,
      status: "active",
      currentLegNumber,
      currentTeamId: nextTeam.id,
      currentMemberId: nextMember?.id ?? null,
      currentMemberName: nextMember?.displayName ?? null,
      winnerTeamId: null,
      teamA,
      teamB,
      turns,
      canUndo: true,
      completedAt: null,
      updatedAt: now,
    };
  }

  const nextTeam = otherTeam.id === teamA.id ? teamA : teamB;
  const nextMember = currentMemberForTeam(nextTeam, match.currentLegNumber, turns);
  return {
    ...match,
    status: "active",
    currentTeamId: nextTeam.id,
    currentMemberId: nextMember?.id ?? null,
    currentMemberName: nextMember?.displayName ?? null,
    teamA,
    teamB,
    turns,
    canUndo: true,
    updatedAt: now,
  };
}

export function applyOfflineLeagueMatchMutation(
  match: LeagueMatchSummary,
  request: LeagueMatchMutationRequest,
  now = Date.now(),
): LeagueMatchSummary {
  if (request.action === "start") return applyStart(match, now);
  if (request.action === "score") return applyScore(match, request, now);
  throw new Error("Server-synced Undo cannot be projected offline.");
}

export function rebuildOfflineLeagueMatch(
  checkpoint: LeagueMatchSummary,
  queuedRequests: LeagueMatchMutationRequest[],
): LeagueMatchSummary {
  return queuedRequests.reduce(
    (match, request, index) =>
      applyOfflineLeagueMatchMutation(match, request, checkpoint.updatedAt + index + 1),
    checkpoint,
  );
}
