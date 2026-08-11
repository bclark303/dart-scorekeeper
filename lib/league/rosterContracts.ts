export type LeaguePlayerStatus = "active" | "archived";

export type LeaguePlayerSummary = {
  id: string;
  leagueId: string;
  playerId: string;
  displayName: string;
  status: LeaguePlayerStatus;
  seasonIds: string[];
  createdAt: number;
  updatedAt: number;
};

export type LeaguePlayerListResponse = {
  players?: LeaguePlayerSummary[];
  error?: string;
};

export type CreateLeaguePlayerRequest = {
  leagueId: string;
  displayName: string;
};

export type CreateLeaguePlayerResponse = {
  player?: LeaguePlayerSummary;
  error?: string;
};

export type SeasonRosterMutationRequest = {
  leagueId: string;
  seasonId: string;
  leaguePlayerId: string;
};

export type SeasonRosterMutationResponse = {
  player?: LeaguePlayerSummary;
  error?: string;
};
