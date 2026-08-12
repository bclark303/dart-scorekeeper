export type LeagueMatchStatus = "scheduled" | "active" | "completed";
export type LeagueMatchFinishRule = "straight" | "double";

export type LeagueMatchMemberSummary = {
  id: string;
  leaguePlayerId: string | null;
  displayName: string;
  isDummy: boolean;
  slotIndex: number;
};

export type LeagueMatchTeamSummary = {
  id: string;
  name: string;
  legsWon: number;
  score: number;
  members: LeagueMatchMemberSummary[];
};

export type LeagueMatchDartInput = {
  id: string;
  segment: number | "outer-bull" | "bull" | "miss";
  multiplier: 0 | 1 | 2 | 3;
  score: number;
};

export type LeagueMatchTurnSummary = {
  id: string;
  turnIndex: number;
  legNumber: number;
  teamId: string;
  teamMemberId: string | null;
  leaguePlayerId: string | null;
  displayName: string;
  isDummy: boolean;
  scoreEntered: number;
  scoreBefore: number;
  scoreAfter: number;
  dartsThrown: number;
  isBust: boolean;
  isCheckout: boolean;
  darts: LeagueMatchDartInput[];
  createdAt: number;
};

export type LeagueMatchSummary = {
  id: string;
  pairingId: string;
  gameNightId: string;
  gameNightName: string;
  gameNightStatus: string;
  seasonName: string;
  scheduledAt: number;
  boardId: string;
  boardNumber: number;
  boardName: string;
  status: LeagueMatchStatus;
  startingScore: number;
  finishRule: LeagueMatchFinishRule;
  legsPerMatch: number;
  dummyScore: number;
  currentLegNumber: number;
  currentTeamId: string | null;
  currentMemberId: string | null;
  currentMemberName: string | null;
  winnerTeamId: string | null;
  teamA: LeagueMatchTeamSummary;
  teamB: LeagueMatchTeamSummary;
  turns: LeagueMatchTurnSummary[];
  canUndo: boolean;
  startedAt: number | null;
  completedAt: number | null;
  updatedAt: number;
};

export type LeagueMatchResponse = {
  match?: LeagueMatchSummary;
  error?: string;
};

/**
 * Optimistic concurrency fingerprint captured before a board queues a score.
 * Turn IDs remain the idempotency key; this fingerprint prevents a valid but
 * stale queued turn from being applied to a different server-side thrower.
 */
export type LeagueMatchExpectedState = {
  activeTurnCount: number;
  lastTurnId: string | null;
  currentLegNumber: number;
  currentTeamId: string;
  currentMemberId: string;
  scoreBefore: number;
};

export type StartLeagueMatchRequest = {
  action: "start";
  matchId: string;
};

export type ScoreLeagueMatchTurnRequest = {
  action: "score";
  matchId: string;
  turnId: string;
  scoreEntered: number;
  dartsThrown: 1 | 2 | 3;
  checkoutConfirmed?: boolean;
  darts?: LeagueMatchDartInput[];
  expectedState?: LeagueMatchExpectedState;
};

export type LeagueMatchScoreRequest = ScoreLeagueMatchTurnRequest;

export type UndoLeagueMatchTurnRequest = {
  action: "undo";
  matchId: string;
};

export type LeagueMatchMutationRequest =
  | StartLeagueMatchRequest
  | ScoreLeagueMatchTurnRequest
  | UndoLeagueMatchTurnRequest;
