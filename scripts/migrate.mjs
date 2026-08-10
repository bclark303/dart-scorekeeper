import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { migrate } from "drizzle-orm/libsql/migrator";

const configuredUrl = process.env.DATABASE_URL?.trim();
const url =
  configuredUrl ||
  (process.env.NODE_ENV === "production"
    ? undefined
    : "file:./data/dart-scorekeeper.db");

if (!url) {
  throw new Error("DATABASE_URL is required for production migrations.");
}

const token = process.env.DATABASE_AUTH_TOKEN?.trim() || undefined;
const client = createClient({ url, authToken: token });
const db = drizzle(client);

try {
  await migrate(db, { migrationsFolder: "./drizzle" });
  console.log("Database migrations applied.");
} finally {
  client.close();
}
