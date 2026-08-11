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
export type GameNightAttendanceStatus = "absent" | "checked_in";
export type GameNightDuesStatus = "unpaid" | "paid" | "waived";
export type GameNightFinishRule = "straight" | "double";

export type GameNightSettingsSummary = {
  teamCreationMode: TeamCreationMode;
  targetTeamCount: number;
  minTeamPlayers: number;
  maxTeamPlayers: number;
  dummyPlayerMode: DummyPlayerMode;
  dummyScore: number;
  boardCount: number;
  boardRotationType: BoardRotationType;
  legsPerMatch: number;
  startingScore: number;
  finishRule: GameNightFinishRule;
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
  status: "scheduled" | "active" | "completed";
  matchSessionId: string | null;
  matchStatus: "scheduled" | "active" | "completed" | null;
  winnerTeamId: string | null;
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

export const DEFAULT_GAME_NIGHT_SETTINGS: GameNightSettingsSummary = {
  teamCreationMode: "hybrid",
  targetTeamCount: 4,
  minTeamPlayers: 2,
  maxTeamPlayers: 4,
  dummyPlayerMode: "fill",
  dummyScore: 0,
  boardCount: 2,
  boardRotationType: "rotate",
  legsPerMatch: 3,
  startingScore: 501,
  finishRule: "double",
};
