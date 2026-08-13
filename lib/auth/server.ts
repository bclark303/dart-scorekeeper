import { betterAuth } from "better-auth";
import { drizzleAdapter } from "@better-auth/drizzle-adapter";

import { getDatabase } from "@/lib/db/client";
import { getRuntimeAuthSecret } from "@/lib/db/runtimeConfig";
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

function getAuthSecret() {
  return process.env.BETTER_AUTH_SECRET?.trim() || getRuntimeAuthSecret();
}

function createAuth() {
  return betterAuth({
    appName: "Dart Scorekeeper",
    baseURL: getAuthBaseUrl(),
    secret: getAuthSecret(),
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
      // Better Auth 1.6.x can issue a bodyless POST to /get-session when
      // deferred refresh is enabled. Next.js/Vercel rejects that request with
      // 415, so keep refresh synchronous until the upstream bug is fixed.
      deferSessionRefresh: false,
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

export function resetAuth() {
  authInstance = undefined;
}

export async function getRequestSession(request: Request) {
  return getAuth().api.getSession({
    headers: request.headers,
  });
}
