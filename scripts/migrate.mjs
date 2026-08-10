import { existsSync, readFileSync } from "node:fs";
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { migrate } from "drizzle-orm/libsql/migrator";

function readRuntimeDatabase() {
  const explicitConfigPath = process.env.DART_SCOREKEEPER_CONFIG_FILE?.trim();
  const selfHosted =
    process.env.DART_SCOREKEEPER_SELF_HOSTED === "1" ||
    process.env.DART_SCOREKEEPER_SELF_HOSTED?.toLowerCase() === "true";
  const configPath =
    explicitConfigPath ||
    (selfHosted ? "/data/dart-scorekeeper.config.json" : undefined);

  if (!configPath || !existsSync(configPath)) {
    return null;
  }

  try {
    const parsed = JSON.parse(readFileSync(configPath, "utf8"));
    if (
      parsed?.version === 1 &&
      parsed?.database?.provider === "libsql" &&
      typeof parsed.database.url === "string" &&
      parsed.database.url.length > 0
    ) {
      return parsed.database;
    }
  } catch (error) {
    console.error("Could not read saved runtime database config.", error);
  }

  return null;
}

const runtimeDatabase = readRuntimeDatabase();
const configuredUrl = process.env.DATABASE_URL?.trim();
const url =
  runtimeDatabase?.url ||
  configuredUrl ||
  (process.env.NODE_ENV === "production"
    ? undefined
    : "file:./data/dart-scorekeeper.db");

if (!url) {
  throw new Error("DATABASE_URL is required for production migrations.");
}

const token =
  runtimeDatabase?.authToken ||
  process.env.DATABASE_AUTH_TOKEN?.trim() ||
  undefined;
const client = createClient({ url, authToken: token });
const db = drizzle(client);

try {
  await migrate(db, { migrationsFolder: "./drizzle" });
  console.log("Database migrations applied.");
} finally {
  client.close();
}
