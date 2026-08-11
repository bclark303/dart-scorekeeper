export type LeagueRole = "owner" | "admin" | "member";
export type LeagueStatus = "active" | "archived";
export type LeagueMembershipStatus = "active" | "invited" | "removed";
export type SeasonStatus = "draft" | "active" | "completed" | "archived";

export type LeagueSeasonSummary = {
  id: string;
  leagueId: string;
  name: string;
  status: SeasonStatus;
  startsAt: number | null;
  endsAt: number | null;
  createdAt: number;
  updatedAt: number;
};

export type LeagueSummary = {
  id: string;
  name: string;
  status: LeagueStatus;
  membershipRole: LeagueRole;
  createdAt: number;
  updatedAt: number;
  seasons: LeagueSeasonSummary[];
};

export type LeagueListResponse = {
  leagues: LeagueSummary[];
};

export type CreateLeagueRequest = {
  name: string;
  firstSeasonName?: string;
};

export type CreateLeagueResponse = {
  league?: LeagueSummary;
  error?: string;
};

export type CreateSeasonRequest = {
  leagueId: string;
  name: string;
};

export type CreateSeasonResponse = {
  season?: LeagueSeasonSummary;
  error?: string;
};
