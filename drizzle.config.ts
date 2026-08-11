import { defineConfig } from "drizzle-kit";

// Drizzle Kit uses the same libSQL/Turso dialect for a remote Turso database
// and for the local `file:` URL used by development/Docker. Keeping this
// configuration provider-neutral means schema generation and migrations do not
// depend on Vercel.
const databaseUrl =
  process.env.DATABASE_URL ?? "file:./data/dart-scorekeeper.db";

export default defineConfig({
  schema: [
    "./lib/db/schema.ts",
    "./lib/db/league-schema.ts",
    "./lib/db/game-night-schema.ts",
    "./lib/db/league-match-schema.ts",
    "./lib/db/board-device-schema.ts",
    "./lib/db/auth-schema.ts",
  ],
  out: "./drizzle",
  dialect: "turso",
  dbCredentials: {
    url: databaseUrl,
    authToken: process.env.DATABASE_AUTH_TOKEN,
  },
  strict: true,
  verbose: true,
});
