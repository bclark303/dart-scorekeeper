import { FinishRule, Player, StartingScore, Turn } from "@/lib/scoring";

export type BestOfLegs = 1 | 3 | 5 | 7 | 9;

export type MatchType = "singles" | "doubles";

export type TeamSize = 1 | 2 | 3 | 4 | 5;

export type RotationMode = "independent" | "dummy";

export type MatchPlayer = Player & {
  legsWon: number;
};

export type TeamMember = {
  id: string;
  name: string;
  isDummy?: boolean;
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

  // Current team/side setup
  sideOneSize: TeamSize;
  sideTwoSize: TeamSize;
  rotationMode: RotationMode;
  dummyScore: number;
  teamOneName: string;
  teamTwoName: string;
  teamOneMemberNames?: string[];
  teamTwoMemberNames?: string[];

  // Current match state
  sides: MatchSide[];
  currentSideIndex: number;
  startingSideIndex: number;
  currentLegNumber: number;
  startingMemberIndexBySide: Record<string, number>;
  turnHistory: Turn[];
  completedLegs: CompletedLeg[];
  isLegComplete: boolean;
  isMatchComplete: boolean;
  message: string;

  // Legacy compatibility fields from older saved matches
  matchType?: MatchType;
  teamSize?: TeamSize;
  playerOneName?: string;
  playerTwoName?: string;
  teamOnePlayerTwoName?: string;
  teamTwoPlayerTwoName?: string;
  players?: MatchSide[];
  currentPlayerIndex?: number;
  startingPlayerIndex?: number;
};

export function createTeamSide(
  sideId: string,
  sideName: string,
  memberNames: string[],
  startingScore: number,
): MatchSide {
  const cleanedMemberNames = memberNames
    .map((name) => name.trim())
    .filter((name) => name.length > 0);

  const members =
    cleanedMemberNames.length > 0
      ? cleanedMemberNames.map((name, index) => ({
          id: `${sideId}-member-${index + 1}`,
          name,
          isDummy: false,
        }))
      : [
          {
            id: `${sideId}-member-1`,
            name: sideName,
            isDummy: false,
          },
        ];

  return {
    id: sideId,
    name: sideName,
    score: startingScore,
    legsWon: 0,
    members,
    currentMemberIndex: 0,
  };
}
