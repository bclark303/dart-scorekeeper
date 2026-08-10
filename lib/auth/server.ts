import { betterAuth } from "better-auth";
import { drizzleAdapter } from "@better-auth/drizzle-adapter";

import { getDatabase } from "@/lib/db/client";
import * as authSchema from "@/lib/db/auth-schema";

function getAuthBaseUrl() {
  const configuredUrl = process.env.BETTER_AUTH_URL?.trim();

  if (configuredUrl) {
    return configuredUrl;
  }

  return {
    allowedHosts: ["localhost:*", "127.0.0.1:*", "*.vercel.app"],
    protocol: "auto" as const,
  };
}

function createAuth() {
  return betterAuth({
    appName: "Dart Scorekeeper",
    baseURL: getAuthBaseUrl(),
    database: drizzleAdapter(getDatabase(), {
      provider: "sqlite",
      schema: authSchema,
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
}

export type DartScorekeeperAuth = ReturnType<typeof createAuth>;

let authInstance: DartScorekeeperAuth | undefined;

export function getAuth(): DartScorekeeperAuth {
  authInstance ??= createAuth();
  return authInstance;
}

export async function getRequestSession(request: Request) {
  return getAuth().api.getSession({
    headers: request.headers,
  });
}
