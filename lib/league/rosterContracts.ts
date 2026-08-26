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

export type PlayerDirectoryLeagueMembership = {
  leaguePlayerId: string;
  leagueId: string;
  leagueName: string;
  status: LeaguePlayerStatus;
  seasonIds: string[];
};

export type PlayerDirectoryPlayer = {
  playerId: string;
  displayName: string;
  memberships: PlayerDirectoryLeagueMembership[];
  createdAt: number;
  updatedAt: number;
};

export type PlayerDirectoryListResponse = {
  players?: PlayerDirectoryPlayer[];
  error?: string;
};

export type LeaguePlayerListResponse = {
  players?: LeaguePlayerSummary[];
  error?: string;
};

/**
 * Add a player to a league.
 *
 * Supplying playerId attaches an existing master-directory player. Supplying
 * displayName creates a new master player and its first league membership.
 * The UI should search the master directory before taking the create-new path.
 */
export type CreateLeaguePlayerRequest = {
  leagueId: string;
  playerId?: string;
  displayName?: string;
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
