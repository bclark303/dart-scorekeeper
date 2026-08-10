import { getDatabaseConfig } from "../config";
import { createLibSqlDatabase } from "./libsql";

/**
 * Provider selection lives at the adapter boundary. Nothing above this file
 * should care whether persistence is Turso, a local SQLite file, or a future
 * Cloudflare D1 implementation.
 */
export function createDatabase() {
  const config = getDatabaseConfig();

  if (config.provider !== "libsql") {
    throw new Error(`Unsupported database provider: ${config.provider}`);
  }

  return createLibSqlDatabase(config);
}

export type AppDatabase = ReturnType<typeof createDatabase>;
