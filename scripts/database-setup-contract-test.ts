import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { resetDatabaseConnection } from "@/lib/db/client";
import { getDatabaseConfig } from "@/lib/db/config";
import {
  getOrCreateSetupToken,
  readRuntimeConfig,
} from "@/lib/db/runtimeConfig";
import {
  getDatabaseSetupStatus,
  saveDatabaseDraft,
  testDatabaseDraft,
} from "@/lib/setup/databaseSetup";

async function run() {
  const root = mkdtempSync(join(tmpdir(), "dart-scorekeeper-setup-"));
  const configPath = join(root, "dart-scorekeeper.config.json");
  const bootstrapDb = `file:${join(root, "bootstrap.db")}`;
  const configuredDb = `file:${join(root, "configured.db")}`;

  process.env.NODE_ENV = "production";
  process.env.DART_SCOREKEEPER_SELF_HOSTED = "1";
  process.env.DART_SCOREKEEPER_CONFIG_FILE = configPath;
  process.env.DB_PROVIDER = "libsql";
  process.env.DATABASE_URL = bootstrapDb;
  process.env.DATABASE_AUTH_TOKEN = "";
  delete process.env.DART_SCOREKEEPER_SETUP_TOKEN;
  delete process.env.BETTER_AUTH_SECRET;

  try {
    const setupToken = getOrCreateSetupToken();
    assert.ok(setupToken);
    assert.ok(setupToken.length >= 24);

    const rejected = await testDatabaseDraft(
      { provider: "sqlite", fileUrl: configuredDb },
      "incorrect-token",
    );
    assert.equal(rejected.ok, false);
    assert.match(rejected.message, /setup token is invalid/i);

    const pathRejected = await testDatabaseDraft(
      { provider: "sqlite", fileUrl: "file:../outside.db" },
      setupToken,
    );
    assert.equal(pathRejected.ok, false);
    assert.match(pathRejected.message, /parent-directory/i);

    const tested = await testDatabaseDraft(
      { provider: "sqlite", fileUrl: configuredDb },
      setupToken,
    );
    assert.equal(tested.ok, true);

    const saved = await saveDatabaseDraft(
      { provider: "sqlite", fileUrl: configuredDb },
      setupToken,
    );
    assert.equal(saved.ok, true);
    assert.ok(saved.status);
    assert.equal(saved.status.current.healthy, true);
    assert.equal(saved.status.current.provider, "sqlite");
    assert.equal(saved.status.current.source, "runtime-file");
    assert.equal(saved.status.account.ready, true);

    const persisted = readRuntimeConfig();
    assert.ok(persisted);
    assert.equal(persisted.database.url, configuredDb);
    assert.equal(persisted.database.displayProvider, "sqlite");
    assert.ok(persisted.auth.secret.length >= 32);

    const fileMode = statSync(configPath).mode & 0o777;
    assert.equal(fileMode, 0o600);

    const selectedConfig = getDatabaseConfig();
    assert.equal(selectedConfig.url, configuredDb);
    assert.equal(selectedConfig.source, "runtime-file");

    const status = await getDatabaseSetupStatus();
    assert.equal(status.runtime, "self-hosted");
    assert.equal(status.capabilities.canPersistFromApp, true);
    assert.equal(status.capabilities.setupTokenRequired, true);
    assert.equal(status.account.ready, true);

    const rawConfig = readFileSync(configPath, "utf8");
    assert.equal(rawConfig.includes(setupToken), false);

    console.log("Self-hosted database setup contract test passed.");
  } finally {
    resetDatabaseConnection();
    rmSync(root, { recursive: true, force: true });
  }
}

run().catch((error) => {
  console.error("Self-hosted database setup contract test failed.", error);
  process.exitCode = 1;
});
