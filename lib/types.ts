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
 * Older player-shaped match participant.
 * Kept temporarily for migration from older localStorage saves.
 */
export type MatchPlayer = Player & {
  legsWon: number;
};

/**
 * A person/slot on a side.
 *
 * isDummy is used when a team is short a player but the missing
 * slot should still count as a turn with an automatic score.
 */
export type TeamMember = {
  id: string;
  name: string;
  isDummy?: boolean;
};

/**
 * A side is what actually competes in a match.
 *
 * In singles, a side has one member.
 * In doubles/team play, a side has multiple members.
 *
 * The side owns the score and legs won.
 * The members only determine who is throwing.
 */
export type MatchSide = {
  id: string;
  name: string;
  score: number;
  legsWon: number;
  members: TeamMember[];
  currentMemberIndex: number;
};

/**
 * Calculated stats for a side.
 *
 * These are not stored directly in match state.
 * They are calculated from turns whenever the UI needs them.
 */
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

/**
 * A completed leg snapshot.
 *
 * The active/current leg uses turnHistory in page.tsx.
 * Once a leg is won, those turns are copied here so the full match
 * history can survive when the next leg starts.
 */
export type CompletedLeg = {
  legNumber: number;
  winnerId: string;
  winnerName: string;
  turns: Turn[];
};

/**
 * Local browser save shape.
 *
 * This is what gets saved into localStorage so a match can survive
 * a refresh, browser close, or dev-server restart.
 */
export type SavedMatchState = {
  startingScore: StartingScore;
  finishRule: FinishRule;
  bestOfLegs: BestOfLegs;

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
  // Keep these optional so old localStorage saves do not break.
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

/**
 * Creates a match side from a side name and a list of member names.
 *
 * This is now the main helper for singles, doubles, and larger teams.
 * A singles side is just a team side with one member.
 */
export function createTeamSide(
  sideId: string,
  sideName: string,
  memberNames: string[],
  startingScore: number
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