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
  pingDatabase,
  savePlayer,
  saveX01MatchArchive,
  setAppMetadata,
  type SavePlayerInput,
} from "./repositories";
