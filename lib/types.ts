import { FinishRule, Player, StartingScore, Turn } from "@/lib/scoring";

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

/**
 * Number of active player slots on a side.
 * We currently cap this at 5 to keep the setup UI simple.
 */
export type TeamSize = 1 | 2 | 3 | 4 | 5;

/**
 * How uneven teams rotate.
 *
 * independent:
 *   Each side rotates only through its actual listed members.
 *
 * dummy:
 *   The shorter side is padded with missing-player slots.
 *   Those dummy slots get an automatic score.
 */
export type RotationMode = "independent" | "dummy";

/**
 * How scores are entered during a match.
 *
 * turn:
 *   Enter one total score for the full turn.
 *
 * dart:
 *   Enter each dart individually on the graphical board.
 */
export type ScoreEntryMode = "turn" | "dart";

/** Visual theme options. */
export type ThemeName = "default" | "firehall";

/** Controls which tab the app opens after a browser refresh. */
export type RefreshBehavior = "score" | "last";

/** Preferred scoring layout when the app loads. */
export type DefaultScoreLayout = "compact" | "full";

/** Older player-shaped match participant kept for saved-match compatibility. */
export type MatchPlayer = Player & {
  legsWon: number;
};

/** A person/slot on a side. */
export type TeamMember = {
  id: string;
  name: string;
  isDummy?: boolean;
};

/** A side is what actually competes in a match. */
export type MatchSide = {
  id: string;
  name: string;
  score: number;
  legsWon: number;
  members: TeamMember[];
  currentMemberIndex: number;
};

/** Calculated stats for a side. */
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

/** A completed leg snapshot. */
export type CompletedLeg = {
  legNumber: number;
  winnerId: string;
  winnerName: string;
  turns: Turn[];
};

/**
 * Local browser save shape.
 *
 * matchId/matchCreatedAt are optional for compatibility with saves created
 * before persistent match identities were introduced. A future sync step can
 * assign them to an older save before archiving it.
 */
export type SavedMatchState = {
  startingScore: StartingScore;
  finishRule: FinishRule;
  bestOfLegs: BestOfLegs;
  scoreEntryMode: ScoreEntryMode;
  themeName: ThemeName;
  brandName: string;
  refreshBehavior: RefreshBehavior;
  defaultScoreLayout: DefaultScoreLayout;
  activeView?: "score" | "game" | "league" | "app" | "stats" | "history";
  isGameModeActive?: boolean;
  matchId?: string;
  matchCreatedAt?: number;

  // Current team/side setup.
  sideOneSize: TeamSize;
  sideTwoSize: TeamSize;
  rotationMode: RotationMode;
  dummyScore: number;
  teamOneName: string;
  teamTwoName: string;
  teamOneMemberNames?: string[];
  teamTwoMemberNames?: string[];

  // Current match state.
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

  // Legacy compatibility fields from older saved matches.
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

/** Creates a match side from a side name and a list of member names. */
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
