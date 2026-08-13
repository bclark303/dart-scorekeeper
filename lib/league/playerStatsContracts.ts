export type PlayerStatTotals = {
  turns: number;
  pointsScored: number;
  count100Plus: number;
  count140Plus: number;
  count180s: number;
  highestTurn: number;
  doubleOuts: number;
  highestCheckout: number;
};

export type PlayerSeasonStats = {
  seasonId: string;
  seasonName: string;
  totals: PlayerStatTotals;
};

export type PlayerLeagueStats = {
  leagueId: string;
  leagueName: string;
  totals: PlayerStatTotals;
  seasons: PlayerSeasonStats[];
};

export type PlayerCareerStats = {
  playerId: string;
  displayName: string;
  totals: PlayerStatTotals;
  leagues: PlayerLeagueStats[];
};

export type PlayerCareerStatsResponse = {
  player?: PlayerCareerStats;
  error?: string;
};
