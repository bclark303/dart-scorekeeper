import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "@better-auth/drizzle-adapter";

// CLI-only Better Auth configuration.
//
// Keep this isolated from the runtime auth module so `npx auth generate` can
// create lib/db/auth-schema.ts before that generated file exists. The runtime
// module uses the application's normal database adapter after generation.
const client = createClient({
  url: process.env.DATABASE_URL ?? "file:./data/auth-schema.db",
  authToken: process.env.DATABASE_AUTH_TOKEN || undefined,
});

const db = drizzle(client);

export const auth = betterAuth({
  appName: "Dart Scorekeeper",
  database: drizzleAdapter(db, {
    provider: "sqlite",
  }),
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 8,
    maxPasswordLength: 128,
  },
  session: {
    expiresIn: 60 * 60 * 24 * 30,
    updateAge: 60 * 60 * 24,
    deferSessionRefresh: true,
  },
  advanced: {
    cookiePrefix: "dart-scorekeeper",
  },
});
