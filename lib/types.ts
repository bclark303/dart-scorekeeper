import { FinishRule, Player, StartingScore, Turn } from "@/lib/scoring";

export type BestOfLegs = 1 | 3 | 5 | 7 | 9;

export type MatchPlayer = Player & {
  legsWon: number;
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