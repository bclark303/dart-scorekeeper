import { resetAuth } from "@/lib/auth/server";
import { resetDatabaseConnection } from "@/lib/db/client";
import {
  getDatabaseConfigurationStatus,
  pingDatabase,
} from "@/lib/db";
import {
  migrateLibSqlSetupConnection,
  testLibSqlSetupConnection,
} from "@/lib/db/adapters/libsqlSetup";
import {
  getOrCreateSetupToken,
  getRuntimeAuthSecret,
  isSelfHostedRuntime,
  verifySetupToken,
  writeRuntimeConfig,
} from "@/lib/db/runtimeConfig";
import type {
  DatabaseConnectionDraft,
  DatabaseSetupActionResponse,
  DatabaseSetupProvider,
  DatabaseSetupRuntime,
  DatabaseSetupStatus,
} from "./contracts";

function detectRuntime(): DatabaseSetupRuntime {
  if (process.env.VERCEL === "1") {
    return "vercel";
  }

  if (
    process.env.CF_PAGES === "1" ||
    process.env.CLOUDFLARE_WORKERS === "1" ||
    Boolean(process.env.WORKERS_RS_VERSION)
  ) {
    return "cloudflare";
  }

  if (isSelfHostedRuntime()) {
    return "self-hosted";
  }

  return "node";
}

function getDisplayedProvider(
  configured: boolean,
  provider: string,
  target?: "local" | "remote",
): DatabaseSetupProvider | "unknown" {
  if (provider === "d1") {
    return "d1";
  }

  if (configured && provider === "libsql") {
    return target === "local" ? "sqlite" : "turso";
  }

  return "unknown";
}

function hasAuthSecret() {
  return Boolean(
    process.env.BETTER_AUTH_SECRET?.trim() || getRuntimeAuthSecret(),
  );
}

export async function getDatabaseSetupStatus(): Promise<DatabaseSetupStatus> {
  const runtime = detectRuntime();
  const configuration = getDatabaseConfigurationStatus();
  let healthy = false;
  let message = configuration.configured
    ? "Database is configured."
    : configuration.reason;

  if (configuration.configured) {
    try {
      await pingDatabase();
      healthy = true;
      message = "Database connection is healthy.";
    } catch (error) {
      console.error("Database setup health check failed.", error);
      message = "Database is configured but the connection test failed.";
    }
  }

  // Creating the self-hosted bootstrap token here guarantees installers can
  // find it in container/server logs before any secret-changing action occurs.
  if (runtime === "self-hosted") {
    getOrCreateSetupToken();
  }

  const secretConfigured = hasAuthSecret();
  const provider = getDisplayedProvider(
    configuration.configured,
    configuration.provider,
    configuration.configured ? configuration.target : undefined,
  );

  return {
    runtime,
    current: {
      configured: configuration.configured,
      healthy,
      provider,
      target: configuration.configured ? configuration.target : null,
      source: configuration.configured ? configuration.source : "none",
      message,
    },
    account: {
      ready: healthy && secretConfigured,
      secretConfigured,
    },
    capabilities: {
      canPersistFromApp: runtime === "self-hosted",
      canUseLocalSqlite: runtime === "self-hosted" || runtime === "node",
      canUseTurso: runtime !== "cloudflare",
      canUseD1: runtime === "cloudflare",
      // D1 needs a Cloudflare-bound adapter rather than a URL/token. The UI
      // exposes that deployment shape now, but this preview does not pretend
      // the adapter exists before the Cloudflare runtime work is completed.
      d1AdapterAvailable: false,
      setupTokenRequired: runtime === "self-hosted",
    },
  };
}

function validateSqliteUrl(fileUrl: string) {
  const url = fileUrl.trim();
  if (!url.startsWith("file:")) {
    throw new Error("Local SQLite must use a file: URL.");
  }

  if (url.includes("..")) {
    throw new Error("Parent-directory paths are not allowed in database setup.");
  }

  return url;
}

function validateTursoUrl(rawUrl: string) {
  const url = rawUrl.trim();
  if (!url.startsWith("libsql://") && !url.startsWith("https://")) {
    throw new Error("Turso/libSQL must use a libsql:// or https:// URL.");
  }
  return url;
}

function requireSetupAuthorization(setupToken?: string) {
  const runtime = detectRuntime();

  if (runtime === "self-hosted") {
    if (!verifySetupToken(setupToken)) {
      throw new Error(
        "The setup token is invalid. Check the container/server logs for the current token.",
      );
    }
    return;
  }

  if (runtime === "node" && process.env.NODE_ENV !== "production") {
    return;
  }

  throw new Error(
    "This hosting platform does not allow the running app to persist its own deployment secrets.",
  );
}

function toLibSqlConnection(draft: DatabaseConnectionDraft) {
  switch (draft.provider) {
    case "sqlite":
      return {
        url: validateSqliteUrl(draft.fileUrl),
        authToken: undefined,
        displayProvider: "sqlite" as const,
      };
    case "turso":
      return {
        url: validateTursoUrl(draft.url),
        authToken: draft.authToken.trim() || undefined,
        displayProvider: "turso" as const,
      };
    case "d1":
      throw new Error(
        "Cloudflare D1 uses a Worker binding, not a database URL. The D1 adapter is not active in this preview yet.",
      );
  }
}

export async function testDatabaseDraft(
  draft: DatabaseConnectionDraft,
  setupToken?: string,
): Promise<DatabaseSetupActionResponse> {
  try {
    requireSetupAuthorization(setupToken);
    const connection = toLibSqlConnection(draft);
    await testLibSqlSetupConnection(connection);
    return {
      ok: true,
      message: `${connection.displayProvider === "sqlite" ? "Local SQLite" : "Turso/libSQL"} connection succeeded.`,
    };
  } catch (error) {
    return {
      ok: false,
      message:
        error instanceof Error ? error.message : "Database connection test failed.",
    };
  }
}

export async function saveDatabaseDraft(
  draft: DatabaseConnectionDraft,
  setupToken?: string,
): Promise<DatabaseSetupActionResponse> {
  try {
    requireSetupAuthorization(setupToken);

    if (detectRuntime() !== "self-hosted") {
      throw new Error(
        "Only self-hosted/Docker installations can save database credentials from inside the app.",
      );
    }

    const connection = toLibSqlConnection(draft);
    await testLibSqlSetupConnection(connection);
    await migrateLibSqlSetupConnection(connection);

    writeRuntimeConfig({
      provider: "libsql",
      displayProvider: connection.displayProvider,
      url: connection.url,
      authToken: connection.authToken,
    });

    resetDatabaseConnection();
    resetAuth();

    return {
      ok: true,
      message: "Database configuration saved and migrations applied.",
      status: await getDatabaseSetupStatus(),
    };
  } catch (error) {
    return {
      ok: false,
      message:
        error instanceof Error ? error.message : "Database configuration failed.",
    };
  }
}
