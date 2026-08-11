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
};

export type UndoLeagueMatchTurnRequest = {
  action: "undo";
  matchId: string;
};

export type LeagueMatchMutationRequest =
  | StartLeagueMatchRequest
  | ScoreLeagueMatchTurnRequest
  | UndoLeagueMatchTurnRequest;
