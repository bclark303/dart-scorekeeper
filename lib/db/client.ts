import { createDatabase, type AppDatabase } from "./adapters";

let database: AppDatabase | undefined;

/**
 * Lazily create the server-side database connection. Keeping construction out
 * of module initialization means builds can succeed without production
 * credentials and routes only connect when persistence is actually used.
 */
export function getDatabase(): AppDatabase {
  database ??= createDatabase();
  return database;
}

/**
 * Drop the cached Drizzle wrapper after a self-hosted database configuration
 * change. The next request creates a connection from the new runtime config.
 */
export function resetDatabaseConnection() {
  database = undefined;
}
