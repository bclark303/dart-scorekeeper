import { DartThrow, FinishRule, Player, StartingScore, Turn } from "@/lib/scoring";

/**
 * Match format options.
 * "Best of 3" means first side to 2 legs wins.
 */
export type BestOfLegs = 1 | 3 | 5 | 7 | 9;

/**
 * Legacy/simple match type.
 * This is mostly kept for older saved matches.
 * The newer setup uses sideOneSize/sideTwoSize instead.
 */
export type MatchType = "singles" | "doubles";

/** How competitors are organized for a casual match. */
export type CompetitionFormat = "individual" | "team";

/**
 * Number of active player slots on a side.
 * We currently cap this at 5 to keep the setup UI simple.
 */
export type TeamSize = 1 | 2 | 3 | 4 | 5;

/** How uneven teams rotate. */
export type RotationMode = "independent" | "dummy";

/** How scores are entered during a match. */
export type ScoreEntryMode = "turn" | "dart";

/** Visual theme options. */
export type ThemeName = "default" | "firehall";

/** Controls which tab the app opens after a browser refresh. */
export type RefreshBehavior = "score" | "last";

/** Preferred scoring layout when the app loads. */
export type DefaultScoreLayout = "compact" | "full";

/** Transient graphical-entry state required to resume a paused game exactly. */
export type ScoringViewSessionState = {
  currentDarts: DartThrow[];
  dartInputStyle: "board" | "numeric";
  numericMultiplier: 1 | 2 | 3 | null;
  isScoringView: boolean;
  showScorecard: boolean;
};

export type MatchPlayer = Player & { legsWon: number };

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
  scoreEntryMode: ScoreEntryMode;
  themeName: ThemeName;
  brandName: string;
  refreshBehavior: RefreshBehavior;
  defaultScoreLayout: DefaultScoreLayout;
  activeView?: "score" | "game" | "app" | "stats" | "history";
  isGameModeActive?: boolean;
  matchId?: string;
  matchCreatedAt?: number;

  competitionFormat?: CompetitionFormat;
  individualPlayerNames?: string[];

  sideOneSize: TeamSize;
  sideTwoSize: TeamSize;
  rotationMode: RotationMode;
  dummyScore: number;
  teamOneName: string;
  teamTwoName: string;
  teamOneMemberNames?: string[];
  teamTwoMemberNames?: string[];

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

  scoreInput?: string;
  pendingCheckoutTurn?: Turn | null;
  pendingDartsUsedTurn?: Turn | null;
  scoringViewSession?: ScoringViewSessionState | null;

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
