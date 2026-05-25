import { FinishRule, Player, StartingScore, Turn } from "@/lib/scoring";

export type BestOfLegs = 1 | 3 | 5 | 7 | 9;

export type MatchPlayer = Player & {
  legsWon: number;
};

export type TeamMember = {
  id: string;
  name: string;
};

export type MatchSide = {
  id: string;
  name: string;
  score: number;
  legsWon: number;
  members: TeamMember[];
  currentMemberIndex: number;
};

export type PlayerStats = {
  pointsScored: number;
  dartsThrown: number;
  threeDartAverage: number;
  highestCheckout: number;
  count180s: number;
  count140Plus: number;
  count100Plus: number;
  busts: number;
};

export type CompletedLeg = {
  legNumber: number;
  winnerId: string;
  winnerName: string;
  turns: Turn[];
};

export type SavedMatchState = {
  startingScore: StartingScore;
  finishRule: FinishRule;
  bestOfLegs: BestOfLegs;
  playerOneName: string;
  playerTwoName: string;
  players: MatchPlayer[];
  currentPlayerIndex: number;
  startingPlayerIndex: number;
  currentLegNumber: number;
  turnHistory: Turn[];
  completedLegs: CompletedLeg[];
  isLegComplete: boolean;
  isMatchComplete: boolean;
  message: string;
};

export function createSinglesSide(
  sideId: string,
  playerId: string,
  name: string,
  startingScore: number
): MatchSide {
  return {
    id: sideId,
    name,
    score: startingScore,
    legsWon: 0,
    members: [
      {
        id: playerId,
        name,
      },
    ],
    currentMemberIndex: 0,
  };
}

export function matchSideToMatchPlayer(side: MatchSide): MatchPlayer {
  return {
    id: side.id,
    name: side.name,
    score: side.score,
    legsWon: side.legsWon,
  };
}