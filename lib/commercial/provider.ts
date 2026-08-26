import { createPreviewLeagueAccess, type LeagueAccessSnapshot } from "./access";

/**
 * Adapter boundary between the app and whatever eventually determines paid
 * access. Implementations may read a local table, billing projection, trial
 * service, promotion grant, or another source.
 */
export interface LeagueAccessProvider {
  getLeagueAccess(leagueId: string): Promise<LeagueAccessSnapshot | null>;
}

/**
 * Current provider used during development: every league is entitled so no
 * unfinished billing system can block league testing.
 */
export class PreviewLeagueAccessProvider implements LeagueAccessProvider {
  async getLeagueAccess(leagueId: string): Promise<LeagueAccessSnapshot> {
    return createPreviewLeagueAccess(leagueId);
  }
}
