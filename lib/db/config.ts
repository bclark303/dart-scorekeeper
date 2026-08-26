import { readRuntimeConfig } from "./runtimeConfig";

export type DatabaseProvider = "libsql";
export type DatabaseTarget = "local" | "remote";
export type DatabaseConfigurationSource =
  | "runtime-file"
  | "environment"
  | "development-default"
  | "none";

export type DatabaseConfig = {
  provider: DatabaseProvider;
  url: string;
  authToken?: string;
  target: DatabaseTarget;
  source: Exclude<DatabaseConfigurationSource, "none">;
};

export type DatabaseConfigurationStatus =
  | {
      configured: true;
      provider: DatabaseProvider;
      target: DatabaseTarget;
      source: Exclude<DatabaseConfigurationSource, "none">;
    }
  | {
      configured: false;
      provider: string;
      source: "none";
      reason: string;
    };

const LOCAL_DEVELOPMENT_DATABASE_URL =
  "file:./data/dart-scorekeeper.db";

type DatabaseValues = {
  provider: string;
  url: string;
  authToken?: string;
  source: DatabaseConfigurationSource;
};

function readDatabaseValues(): DatabaseValues {
  // Self-hosted installations can override their boot-time environment through
  // a persisted server-side config file written by the setup UI. This is never
  // used on Vercel unless explicitly enabled with DART_SCOREKEEPER_CONFIG_FILE.
  const runtimeConfig = readRuntimeConfig();
  if (runtimeConfig) {
    return {
      provider: runtimeConfig.database.provider,
      url: runtimeConfig.database.url,
      authToken: runtimeConfig.database.authToken,
      source: "runtime-file",
    };
  }

  const provider = process.env.DB_PROVIDER?.trim() || "libsql";
  const configuredUrl = process.env.DATABASE_URL?.trim();
  if (configuredUrl) {
    return {
      provider,
      url: configuredUrl,
      authToken: process.env.DATABASE_AUTH_TOKEN?.trim() || undefined,
      source: "environment",
    };
  }

  // Development should work without requiring a hosted database. Production
  // must opt in explicitly so a Vercel deployment can never accidentally try
  // to treat its ephemeral filesystem as durable storage.
  if (process.env.NODE_ENV !== "production") {
    return {
      provider: "libsql",
      url: LOCAL_DEVELOPMENT_DATABASE_URL,
      source: "development-default",
    };
  }

  return {
    provider,
    url: "",
    source: "none",
  };
}

function getDatabaseTarget(url: string): DatabaseTarget {
  return url === ":memory:" || url.startsWith("file:") ? "local" : "remote";
}

export function getDatabaseConfigurationStatus(): DatabaseConfigurationStatus {
  const values = readDatabaseValues();

  if (values.provider !== "libsql") {
    return {
      configured: false,
      provider: values.provider,
      source: "none",
      reason: `Unsupported database provider: ${values.provider}`,
    };
  }

  if (!values.url) {
    return {
      configured: false,
      provider: values.provider,
      source: "none",
      reason: "DATABASE_URL is not configured for this production deployment.",
    };
  }

  return {
    configured: true,
    provider: values.provider,
    target: getDatabaseTarget(values.url),
    source: values.source as Exclude<DatabaseConfigurationSource, "none">,
  };
}

export function getDatabaseConfig(): DatabaseConfig {
  const status = getDatabaseConfigurationStatus();

  if (!status.configured) {
    throw new Error(status.reason);
  }

  const values = readDatabaseValues();

  return {
    provider: status.provider,
    url: values.url,
    authToken: values.authToken,
    target: status.target,
    source: status.source,
  };
}
