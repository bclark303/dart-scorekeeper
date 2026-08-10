export {
  getDatabaseConfig,
  getDatabaseConfigurationStatus,
} from "./config";

// Persistence callers should import repository operations from this public
// boundary rather than importing Drizzle, libSQL, or adapters directly.
export {
  archivePlayer,
  getAppMetadata,
  getPlayerById,
  listPlayers,
  listRecentX01MatchSummaries,
  listX01MatchArchivesForUser,
  MatchOwnershipError,
  pingDatabase,
  savePlayer,
  saveX01MatchArchive,
  saveX01MatchArchiveForUser,
  setAppMetadata,
  type SavePlayerInput,
} from "./repositories";
