export type GameNightStatus =
  | "draft"
  | "checkin"
  | "ready"
  | "active"
  | "completed"
  | "cancelled";

export type TeamCreationMode = "manual" | "automatic" | "hybrid";
export type DummyPlayerMode = "none" | "allow" | "fill";
export type BoardRotationType = "fixed" | "rotate" | "manual";
export type FixturePairingStrategy = "random" | "round_robin" | "swiss" | "manual";
export type RoundAdvanceMode = "manual" | "automatic";
export type GameNightAttendanceStatus = "absent" | "checked_in";
export type GameNightDuesStatus = "unpaid" | "paid" | "waived";
export type GameNightFinishRule = "straight" | "double";
export type GameNightTeamStatus = "active" | "withdrawn";
export type GameNightPairingStatus = "draft" | "ready" | "active" | "completed";
export type GameNightRoundStatus =
  | "draft"
  | "ready"
  | "active"
  | "completed"
  | "intermission";

/**
 * The fixture fields are optional at the type boundary so repositories can
 * still hydrate databases created before the multi-round migration. Public
 * fixture-aware read models normalize them to DEFAULT_GAME_NIGHT_SETTINGS.
 */
export type GameNightSettingsSummary = {
  teamCreationMode: TeamCreationMode;
  targetTeamCount: number;
  minTeamPlayers: number;
  maxTeamPlayers: number;
  dummyPlayerMode: DummyPlayerMode;
  dummyScore: number;
  boardCount: number;
  boardRotationType: BoardRotationType;
  roundCount?: number;
  pairingStrategy?: FixturePairingStrategy;
  roundAdvanceMode?: RoundAdvanceMode;
  roundAdvanceDelaySeconds?: number;
  intermissionAfterRounds?: number[];
  intermissionDurationMinutes?: number;
  legsPerMatch: number;
  startingScore: number;
  finishRule: GameNightFinishRule;
};

export type ResolvedGameNightSettings = GameNightSettingsSummary & {
  roundCount: number;
  pairingStrategy: FixturePairingStrategy;
  roundAdvanceMode: RoundAdvanceMode;
  roundAdvanceDelaySeconds: number;
  intermissionAfterRounds: number[];
  intermissionDurationMinutes: number;
};

export type GameNightAttendanceSummary = {
  leaguePlayerId: string;
  displayName: string;
  status: GameNightAttendanceStatus;
  duesStatus: GameNightDuesStatus;
  checkedInAt: number | null;
};

export type GameNightTeamMemberSummary = {
  id: string;
  leaguePlayerId: string | null;
  displayName: string;
  isDummy: boolean;
  slotIndex: number;
};

export type GameNightTeamSummary = {
  id: string;
  teamIndex: number;
  name: string;
  source: "manual" | "automatic";
  status?: GameNightTeamStatus;
  members: GameNightTeamMemberSummary[];
};

export type GameNightBoardSummary = {
  id: string;
  boardNumber: number;
  name: string;
};

export type GameNightBoardPairingSummary = {
  id: string;
  boardId: string;
  boardNumber: number;
  roundNumber: number;
  teamAId: string;
  teamBId: string;
  status: GameNightPairingStatus;
  matchSessionId: string | null;
  matchStatus: "scheduled" | "active" | "completed" | null;
  winnerTeamId: string | null;
};

export type GameNightRoundSummary = {
  roundNumber: number;
  status: GameNightRoundStatus;
  pairings: GameNightBoardPairingSummary[];
  byeTeamIds: string[];
  completedAt: number | null;
  intermissionScheduled: boolean;
  intermissionEndsAt: number | null;
};

export type GameNightSummary = {
  id: string;
  leagueId: string;
  seasonId: string;
  seasonName: string;
  name: string;
  scheduledAt: number;
  status: GameNightStatus;
  settings: GameNightSettingsSummary;
  attendance: GameNightAttendanceSummary[];
  teams: GameNightTeamSummary[];
  boards: GameNightBoardSummary[];
  pairings: GameNightBoardPairingSummary[];
  rounds?: GameNightRoundSummary[];
  currentRoundNumber?: number;
  activeRoundNumber?: number | null;
  completedRoundCount?: number;
  unpairedTeamIds: string[];
  createdAt: number;
  updatedAt: number;
};

export type CreateGameNightRequest = {
  leagueId: string;
  seasonId: string;
  name: string;
  scheduledAt: number;
  settings?: Partial<GameNightSettingsSummary>;
};

export type UpdateGameNightSettingsRequest = {
  gameNightId: string;
  settings: GameNightSettingsSummary;
};

export type UpdateGameNightAttendanceRequest = {
  gameNightId: string;
  leaguePlayerId: string;
  checkedIn: boolean;
  duesStatus: GameNightDuesStatus;
};

export type PrepareGameNightTeamsRequest = {
  gameNightId: string;
};

export type AssignGameNightTeamRequest = {
  gameNightId: string;
  leaguePlayerId: string;
  teamId: string | null;
};

export type PopulateGameNightBoardsRequest = {
  gameNightId: string;
};

export type GameNightListResponse = {
  gameNights?: GameNightSummary[];
  gameNight?: GameNightSummary;
  error?: string;
};

export const DEFAULT_GAME_NIGHT_SETTINGS: ResolvedGameNightSettings = {
  teamCreationMode: "hybrid",
  targetTeamCount: 4,
  minTeamPlayers: 2,
  maxTeamPlayers: 4,
  dummyPlayerMode: "fill",
  dummyScore: 0,
  boardCount: 2,
  boardRotationType: "rotate",
  roundCount: 3,
  pairingStrategy: "random",
  roundAdvanceMode: "manual",
  roundAdvanceDelaySeconds: 60,
  intermissionAfterRounds: [],
  intermissionDurationMinutes: 10,
  legsPerMatch: 3,
  startingScore: 501,
  finishRule: "double",
};

export function resolveGameNightSettings(
  settings: GameNightSettingsSummary,
): ResolvedGameNightSettings {
  return {
    ...DEFAULT_GAME_NIGHT_SETTINGS,
    ...settings,
    intermissionAfterRounds: settings.intermissionAfterRounds ?? [],
  };
}
