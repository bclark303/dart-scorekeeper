export type DatabaseProvider = "libsql";
export type DatabaseTarget = "local" | "remote";

export type DatabaseConfig = {
  provider: DatabaseProvider;
  url: string;
  authToken?: string;
  target: DatabaseTarget;
};

export type DatabaseConfigurationStatus =
  | {
      configured: true;
      provider: DatabaseProvider;
      target: DatabaseTarget;
    }
  | {
      configured: false;
      provider: string;
      reason: string;
    };

const LOCAL_DEVELOPMENT_DATABASE_URL =
  "file:./data/dart-scorekeeper.db";

function readProvider() {
  return process.env.DB_PROVIDER?.trim() || "libsql";
}

function readDatabaseUrl() {
  const configuredUrl = process.env.DATABASE_URL?.trim();

  if (configuredUrl) {
    return configuredUrl;
  }

  // Development should work without requiring a hosted database. Production
  // must opt in explicitly so a Vercel deployment can never accidentally try
  // to treat its ephemeral filesystem as durable storage.
  if (process.env.NODE_ENV !== "production") {
    return LOCAL_DEVELOPMENT_DATABASE_URL;
  }

  return "";
}

function getDatabaseTarget(url: string): DatabaseTarget {
  return url === ":memory:" || url.startsWith("file:") ? "local" : "remote";
}

export function getDatabaseConfigurationStatus(): DatabaseConfigurationStatus {
  const provider = readProvider();

  if (provider !== "libsql") {
    return {
      configured: false,
      provider,
      reason: `Unsupported database provider: ${provider}`,
    };
  }

  const url = readDatabaseUrl();

  if (!url) {
    return {
      configured: false,
      provider,
      reason: "DATABASE_URL is not configured for this production deployment.",
    };
  }

  return {
    configured: true,
    provider,
    target: getDatabaseTarget(url),
  };
}

export function getDatabaseConfig(): DatabaseConfig {
  const status = getDatabaseConfigurationStatus();

  if (!status.configured) {
    throw new Error(status.reason);
  }

  const url = readDatabaseUrl();
  const authToken = process.env.DATABASE_AUTH_TOKEN?.trim() || undefined;

  return {
    provider: status.provider,
    url,
    authToken,
    target: status.target,
  };
}
