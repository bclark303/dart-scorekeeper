import {
  chmodSync,
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { dirname } from "node:path";
import { randomBytes, timingSafeEqual } from "node:crypto";

export type RuntimeDatabaseConfigFile = {
  version: 1;
  database: {
    provider: "libsql";
    displayProvider: "sqlite" | "turso";
    url: string;
    authToken?: string;
  };
  auth: {
    secret: string;
  };
  updatedAt: number;
};

const DEFAULT_SELF_HOSTED_CONFIG_PATH =
  "/data/dart-scorekeeper.config.json";

function isEnabledFlag(value: string | undefined) {
  return value === "1" || value?.toLowerCase() === "true";
}

export function isSelfHostedRuntime() {
  return (
    isEnabledFlag(process.env.DART_SCOREKEEPER_SELF_HOSTED) ||
    Boolean(process.env.DART_SCOREKEEPER_CONFIG_FILE?.trim())
  );
}

export function getRuntimeConfigPath(): string | null {
  const configuredPath = process.env.DART_SCOREKEEPER_CONFIG_FILE?.trim();
  if (configuredPath) {
    return configuredPath;
  }

  return isSelfHostedRuntime() ? DEFAULT_SELF_HOSTED_CONFIG_PATH : null;
}

function isRuntimeConfigFile(value: unknown): value is RuntimeDatabaseConfigFile {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as Partial<RuntimeDatabaseConfigFile>;
  const database = candidate.database as
    | Partial<RuntimeDatabaseConfigFile["database"]>
    | undefined;
  const auth = candidate.auth as
    | Partial<RuntimeDatabaseConfigFile["auth"]>
    | undefined;

  return (
    candidate.version === 1 &&
    database?.provider === "libsql" &&
    (database.displayProvider === "sqlite" ||
      database.displayProvider === "turso") &&
    typeof database.url === "string" &&
    database.url.length > 0 &&
    (database.authToken === undefined ||
      typeof database.authToken === "string") &&
    typeof auth?.secret === "string" &&
    auth.secret.length >= 32 &&
    typeof candidate.updatedAt === "number"
  );
}

export function readRuntimeConfig(): RuntimeDatabaseConfigFile | null {
  const configPath = getRuntimeConfigPath();
  if (!configPath || !existsSync(configPath)) {
    return null;
  }

  try {
    const parsed = JSON.parse(readFileSync(configPath, "utf8"));
    return isRuntimeConfigFile(parsed) ? parsed : null;
  } catch (error) {
    console.error("Could not read Dart Scorekeeper runtime configuration.", error);
    return null;
  }
}

export function writeRuntimeConfig(
  database: RuntimeDatabaseConfigFile["database"],
) {
  const configPath = getRuntimeConfigPath();
  if (!configPath) {
    throw new Error(
      "This deployment does not support persistent in-app configuration.",
    );
  }

  const existing = readRuntimeConfig();
  const config: RuntimeDatabaseConfigFile = {
    version: 1,
    database,
    auth: {
      secret: existing?.auth.secret ?? randomBytes(32).toString("base64url"),
    },
    updatedAt: Date.now(),
  };

  mkdirSync(dirname(configPath), { recursive: true });
  writeFileSync(configPath, `${JSON.stringify(config, null, 2)}\n`, {
    encoding: "utf8",
    mode: 0o600,
  });
  chmodSync(configPath, 0o600);

  return config;
}

function getSetupTokenPath() {
  const configPath = getRuntimeConfigPath();
  return configPath ? `${configPath}.setup-token` : null;
}

export function getOrCreateSetupToken(): string | null {
  const environmentToken = process.env.DART_SCOREKEEPER_SETUP_TOKEN?.trim();
  if (environmentToken) {
    return environmentToken;
  }

  const tokenPath = getSetupTokenPath();
  if (!tokenPath) {
    return null;
  }

  if (existsSync(tokenPath)) {
    return readFileSync(tokenPath, "utf8").trim();
  }

  const token = randomBytes(24).toString("base64url");
  mkdirSync(dirname(tokenPath), { recursive: true });
  writeFileSync(tokenPath, `${token}\n`, {
    encoding: "utf8",
    mode: 0o600,
  });
  chmodSync(tokenPath, 0o600);

  console.info(
    `[Dart Scorekeeper] Database setup token: ${token} (enter this token in App > Server Storage to change persistent database settings)`,
  );

  return token;
}

export function verifySetupToken(candidate: string | null | undefined) {
  const expected = getOrCreateSetupToken();
  if (!expected || !candidate) {
    return false;
  }

  const expectedBuffer = Buffer.from(expected);
  const candidateBuffer = Buffer.from(candidate);

  return (
    expectedBuffer.length === candidateBuffer.length &&
    timingSafeEqual(expectedBuffer, candidateBuffer)
  );
}

export function getRuntimeAuthSecret() {
  return readRuntimeConfig()?.auth.secret;
}
