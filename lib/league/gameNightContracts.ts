export type GameNightStatus =
  | "draft"
  | "checkin"
  | "ready"
  | "active"
  | "completed"
  | "cancelled";

export type TeamCreationMode = "manual" | "automatic" | "hybrid";
export type DummyPlayerMode = "none" | "allow" | "fill" | "balance";
export type BoardRotationType = "fixed" | "rotate" | "manual";
export type FixturePairingStrategy = "random" | "round_robin" | "swiss" | "manual";
export type RoundAdvanceMode = "manual" | "automatic";
export type GameNightLayoutMode = "manual" | "automatic";
export type GameNightAttendanceStatus = "absent" | "checked_in";
export type GameNightDuesStatus = "unpaid" | "paid" | "waived";
export type GameNightFinishRule = "straight" | "double";
export type GameNightTeamStatus = "active" | "withdrawn";
export type GameNightPairingStatus =
  | "scheduled"
  | "draft"
  | "ready"
  | "active"
  | "completed";
export type GameNightRoundStatus =
  | "draft"
  | "ready"
  | "active"
  | "completed"
  | "intermission";

/**
 * Newer structural fields remain optional at the type boundary so repositories
 * can still hydrate databases created before the corresponding migrations.
 * Public read models normalize them to DEFAULT_GAME_NIGHT_SETTINGS.
 */
export type GameNightSettingsSummary = {
  teamCreationMode: TeamCreationMode;
  teamCountMode?: GameNightLayoutMode;
  targetTeamCount: number;
  teamSizeMode?: GameNightLayoutMode;
  minTeamPlayers: number;
  maxTeamPlayers: number;
  dummyPlayerMode: DummyPlayerMode;
  dummyScore: number;
  boardCountMode?: GameNightLayoutMode;
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
  teamCountMode: GameNightLayoutMode;
  teamSizeMode: GameNightLayoutMode;
  boardCountMode: GameNightLayoutMode;
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
  /** Permanent venue board; null only while upgrading legacy rows. */
  physicalBoardId: string | null;
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
  venueId: string | null;
  venueName: string | null;
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
  teamCountMode: "manual",
  targetTeamCount: 4,
  teamSizeMode: "manual",
  minTeamPlayers: 2,
  maxTeamPlayers: 4,
  dummyPlayerMode: "fill",
  dummyScore: 0,
  boardCountMode: "manual",
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
    teamCountMode: settings.teamCountMode ?? "manual",
    teamSizeMode: settings.teamSizeMode ?? "manual",
    boardCountMode: settings.boardCountMode ?? "manual",
    intermissionAfterRounds: settings.intermissionAfterRounds ?? [],
  };
}
