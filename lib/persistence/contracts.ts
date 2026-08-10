import type { FinishRule, StartingScore } from "@/lib/scoring";
import type {
  BestOfLegs,
  RotationMode,
  ScoreEntryMode,
} from "@/lib/types";

export type PersistedMatchStatus = "in_progress" | "complete" | "abandoned";

export type PersistedPlayer = {
  id: string;
  displayName: string;
  createdAt: number;
  updatedAt: number;
  archivedAt: number | null;
};

export type X01ArchiveDart = {
  id: string;
  dartIndex: number;
  segment: string;
  multiplier: number;
  score: number;
};

export type X01ArchiveTurn = {
  id: string;
  sideId: string;
  participantId: string | null;
  turnNumber: number;
  scoreEntered: number;
  scoreBefore: number;
  scoreAfter: number;
  dartsThrown: number;
  isBust: boolean;
  isCheckout: boolean;
  finishRule: FinishRule;
  recordedAt: number | null;
  darts: X01ArchiveDart[];
};

export type X01ArchiveLeg = {
  id: string;
  legNumber: number;
  startingSideId: string;
  winnerSideId: string;
  startedAt: number | null;
  completedAt: number | null;
  turns: X01ArchiveTurn[];
};

export type X01ArchiveParticipant = {
  id: string;
  playerId: string | null;
  slotIndex: number;
  displayName: string;
  isDummy: boolean;
};

export type X01ArchiveSide = {
  id: string;
  sideIndex: number;
  name: string;
  participants: X01ArchiveParticipant[];
};

export type X01MatchArchive = {
  id: string;
  status: PersistedMatchStatus;
  winnerSideId: string | null;
  createdAt: number;
  startedAt: number | null;
  updatedAt: number;
  completedAt: number | null;
  settings: {
    startingScore: StartingScore;
    finishRule: FinishRule;
    bestOfLegs: BestOfLegs;
    scoreEntryMode: ScoreEntryMode;
    rotationMode: RotationMode;
    dummyScore: number;
  };
  sides: X01ArchiveSide[];
  legs: X01ArchiveLeg[];
};

export type X01MatchSummary = {
  id: string;
  status: string;
  winnerSideId: string | null;
  startingScore: number;
  finishRule: string;
  bestOfLegs: number;
  createdAt: number;
  completedAt: number | null;
};
