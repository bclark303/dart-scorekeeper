export {
  getDatabaseConfig,
  getDatabaseConfigurationStatus,
} from "./config";

// Persistence callers should import repository operations from this public
// boundary rather than importing Drizzle, libSQL, or adapters directly.
export {
  addLeaguePlayerToSeasonForUser,
  archivePlayer,
  createLeagueForUser,
  createLeaguePlayerForUser,
  createSeasonForUser,
  getAppMetadata,
  getPlayerById,
  LeaguePermissionError,
  listLeaguePlayersForUser,
  listLeaguesForUser,
  listPlayers,
  listRecentX01MatchSummaries,
  listX01MatchArchivesForUser,
  MatchOwnershipError,
  pingDatabase,
  removeLeaguePlayerFromSeasonForUser,
  savePlayer,
  saveX01MatchArchive,
  saveX01MatchArchiveForUser,
  setAppMetadata,
  type CreateLeagueForUserInput,
  type CreateLeaguePlayerForUserInput,
  type CreateSeasonForUserInput,
  type MutateSeasonRosterForUserInput,
  type SavePlayerInput,
} from "./repositories";
