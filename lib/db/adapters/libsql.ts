import type { DatabaseConfig } from "../config";
import { drizzle } from "drizzle-orm/libsql";
import * as schema from "../schema";

/**
 * Current database implementation.
 *
 * libSQL deliberately covers both deployment shapes we care about today:
 * - `file:` URLs for local development and Docker/self-hosting.
 * - remote `libsql:`/HTTPS URLs for Turso on Vercel.
 *
 * If we later move to Cloudflare D1, that implementation belongs beside this
 * file and callers above the adapter layer should not need to change.
 */
export function createLibSqlDatabase(config: DatabaseConfig) {
  return drizzle({
    connection: {
      url: config.url,
      authToken: config.authToken,
    },
    schema,
  });
}

export type LibSqlAppDatabase = ReturnType<typeof createLibSqlDatabase>;
