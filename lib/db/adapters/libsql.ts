import type { DatabaseConfig } from "../config";
import { drizzle } from "drizzle-orm/libsql";
import * as appSchema from "../schema";
import * as authSchema from "../auth-schema";

/**
 * Current database implementation.
 *
 * libSQL deliberately covers both deployment shapes we care about today:
 * - `file:` URLs for local development and Docker/self-hosting.
 * - remote `libsql:`/HTTPS URLs for Turso on Vercel.
 *
 * Better Auth shares this same Drizzle connection and SQLite-compatible schema,
 * so moving from Vercel/Turso to local Docker does not change auth storage.
 */
export function createLibSqlDatabase(config: DatabaseConfig) {
  return drizzle({
    connection: {
      url: config.url,
      authToken: config.authToken,
    },
    schema: {
      ...appSchema,
      ...authSchema,
    },
  });
}

export type LibSqlAppDatabase = ReturnType<typeof createLibSqlDatabase>;
