export {
  getDatabaseConfig,
  getDatabaseConfigurationStatus,
} from "./config";

// Persistence callers should import repository operations from this public
// boundary rather than importing Drizzle, libSQL, or adapters directly.
export {
  archivePlayer,
  createLeagueForUser,
  createSeasonForUser,
  getAppMetadata,
  getPlayerById,
  LeaguePermissionError,
  listLeaguesForUser,
  listPlayers,
  listRecentX01MatchSummaries,
  listX01MatchArchivesForUser,
  MatchOwnershipError,
  pingDatabase,
  savePlayer,
  saveX01MatchArchive,
  saveX01MatchArchiveForUser,
  setAppMetadata,
  type CreateLeagueForUserInput,
  type CreateSeasonForUserInput,
  type SavePlayerInput,
} from "./repositories";
