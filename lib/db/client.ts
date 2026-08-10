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
