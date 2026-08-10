"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import {
  DATABASE_SETUP_CHANGED_EVENT,
  type DatabaseConnectionDraft,
  type DatabaseSetupActionResponse,
  type DatabaseSetupProvider,
  type DatabaseSetupStatus,
} from "@/lib/setup/contracts";

type DatabaseSetupPanelProps = {
  onStatusChange?: (status: DatabaseSetupStatus | null) => void;
};

function providerLabel(provider: DatabaseSetupStatus["current"]["provider"]) {
  switch (provider) {
    case "sqlite":
      return "Local SQLite";
    case "turso":
      return "Turso / libSQL";
    case "d1":
      return "Cloudflare D1";
    default:
      return "Not configured";
  }
}

function runtimeLabel(runtime: DatabaseSetupStatus["runtime"]) {
  switch (runtime) {
    case "vercel":
      return "Vercel";
    case "cloudflare":
      return "Cloudflare";
    case "self-hosted":
      return "Self-hosted / Docker";
    default:
      return "Local Node";
  }
}

function sourceLabel(source: DatabaseSetupStatus["current"]["source"]) {
  switch (source) {
    case "runtime-file":
      return "Saved by app";
    case "environment":
      return "Host environment";
    case "development-default":
      return "Development default";
    default:
      return "None";
  }
}

export function DatabaseSetupPanel({
  onStatusChange,
}: DatabaseSetupPanelProps) {
  const [status, setStatus] = useState<DatabaseSetupStatus | null>(null);
  const [isLoadingStatus, setIsLoadingStatus] = useState(true);
  const [provider, setProvider] = useState<DatabaseSetupProvider>("turso");
  const [sqliteFileUrl, setSqliteFileUrl] = useState(
    "file:/data/dart-scorekeeper.db",
  );
  const [tursoUrl, setTursoUrl] = useState("");
  const [tursoToken, setTursoToken] = useState("");
  const [d1BindingName, setD1BindingName] = useState("DB");
  const [setupToken, setSetupToken] = useState("");
  const [isWorking, setIsWorking] = useState(false);
  const [actionMessage, setActionMessage] = useState("");
  const [actionError, setActionError] = useState("");

  const refreshStatus = useCallback(async () => {
    setIsLoadingStatus(true);
    try {
      const response = await fetch("/api/setup/database/status", {
        cache: "no-store",
      });
      const nextStatus = (await response.json()) as DatabaseSetupStatus;
      setStatus(nextStatus);
      onStatusChange?.(nextStatus);
      window.dispatchEvent(new Event(DATABASE_SETUP_CHANGED_EVENT));

      if (nextStatus.current.provider !== "unknown") {
        setProvider(nextStatus.current.provider);
      } else if (nextStatus.runtime === "cloudflare") {
        setProvider("d1");
      } else if (nextStatus.runtime === "self-hosted") {
        setProvider("sqlite");
      }
    } catch (error) {
      console.error("Could not load database setup status.", error);
      setStatus(null);
      onStatusChange?.(null);
      setActionError("Database setup status could not be loaded.");
    } finally {
      setIsLoadingStatus(false);
    }
  }, [onStatusChange]);

  useEffect(() => {
    void refreshStatus();
  }, [refreshStatus]);

  const draft = useMemo<DatabaseConnectionDraft>(() => {
    switch (provider) {
      case "sqlite":
        return { provider, fileUrl: sqliteFileUrl };
      case "turso":
        return { provider, url: tursoUrl, authToken: tursoToken };
      case "d1":
        return { provider, bindingName: d1BindingName };
    }
  }, [d1BindingName, provider, sqliteFileUrl, tursoToken, tursoUrl]);

  async function runSetupAction(action: "test" | "save") {
    setIsWorking(true);
    setActionMessage("");
    setActionError("");

    try {
      const response = await fetch(`/api/setup/database/${action}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ draft, setupToken }),
      });
      const result = (await response.json()) as DatabaseSetupActionResponse;

      if (!result.ok) {
        setActionError(result.message);
        return;
      }

      setActionMessage(result.message);
      if (result.status) {
        setStatus(result.status);
        onStatusChange?.(result.status);
        window.dispatchEvent(new Event(DATABASE_SETUP_CHANGED_EVENT));
      } else {
        await refreshStatus();
      }

      if (action === "save") {
        setTursoToken("");
      }
    } catch (error) {
      console.error("Database setup action failed.", error);
      setActionError("Database setup action failed.");
    } finally {
      setIsWorking(false);
    }
  }

  const currentHealthy = status?.current.healthy ?? false;
  const canPersistFromApp = status?.capabilities.canPersistFromApp ?? false;
  const setupTokenRequired = status?.capabilities.setupTokenRequired ?? false;

  return (
    <section className="mb-8 rounded-2xl border border-[var(--color-panel-border)] bg-[var(--color-panel)] p-6">
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold">Database Setup</h2>
          <p className="mt-1 max-w-2xl text-sm text-[var(--color-text-muted)]">
            Configure optional server storage without changing scoring code. The
            controls adapt to the hosting platform instead of treating Docker,
            Vercel, and Cloudflare as if they stored secrets the same way.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void refreshStatus()}
          disabled={isLoadingStatus}
          className="rounded-xl border border-[var(--color-panel-border)] bg-[var(--color-panel-soft)] px-3 py-2 text-sm font-bold hover:bg-[var(--color-panel-border)] disabled:opacity-60"
        >
          {isLoadingStatus ? "Checking…" : "Refresh status"}
        </button>
      </div>

      <div className="mb-5 grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-[var(--color-panel-border)] bg-[var(--color-panel-soft)] p-4">
          <div className="text-xs font-bold uppercase tracking-wide text-[var(--color-text-muted)]">
            Runtime
          </div>
          <div className="mt-1 font-bold">
            {status ? runtimeLabel(status.runtime) : "Checking…"}
          </div>
        </div>
        <div className="rounded-xl border border-[var(--color-panel-border)] bg-[var(--color-panel-soft)] p-4">
          <div className="text-xs font-bold uppercase tracking-wide text-[var(--color-text-muted)]">
            Current database
          </div>
          <div className="mt-1 font-bold">
            {status ? providerLabel(status.current.provider) : "Checking…"}
          </div>
          {status?.current.configured && (
            <div className="mt-1 text-xs text-[var(--color-text-muted)]">
              {sourceLabel(status.current.source)}
            </div>
          )}
        </div>
        <div
          className={`rounded-xl border p-4 ${
            currentHealthy
              ? "border-emerald-500/40 bg-emerald-500/10"
              : "border-amber-500/40 bg-amber-500/10"
          }`}
        >
          <div className="text-xs font-bold uppercase tracking-wide opacity-80">
            Connection
          </div>
          <div className="mt-1 font-bold">
            {currentHealthy ? "Ready" : "Not ready"}
          </div>
          <div className="mt-1 text-xs opacity-80">
            {status?.current.message ?? "Checking database status…"}
          </div>
        </div>
      </div>

      <div className="mb-5">
        <div className="mb-2 text-sm font-bold">Database provider</div>
        <div className="grid gap-2 sm:grid-cols-3">
          <button
            type="button"
            onClick={() => setProvider("sqlite")}
            disabled={status ? !status.capabilities.canUseLocalSqlite : false}
            className={`rounded-xl border p-3 text-left font-bold ${
              provider === "sqlite"
                ? "border-[var(--color-primary)] bg-[var(--color-primary)] text-white"
                : "border-[var(--color-panel-border)] bg-[var(--color-panel-soft)]"
            } disabled:cursor-not-allowed disabled:opacity-40`}
          >
            Local SQLite
            <span className="mt-1 block text-xs font-normal opacity-80">
              Best for Docker/self-hosting
            </span>
          </button>
          <button
            type="button"
            onClick={() => setProvider("turso")}
            disabled={status ? !status.capabilities.canUseTurso : false}
            className={`rounded-xl border p-3 text-left font-bold ${
              provider === "turso"
                ? "border-[var(--color-primary)] bg-[var(--color-primary)] text-white"
                : "border-[var(--color-panel-border)] bg-[var(--color-panel-soft)]"
            } disabled:cursor-not-allowed disabled:opacity-40`}
          >
            Turso / libSQL
            <span className="mt-1 block text-xs font-normal opacity-80">
              Hosted SQLite-compatible storage
            </span>
          </button>
          <button
            type="button"
            onClick={() => setProvider("d1")}
            disabled={status ? !status.capabilities.canUseD1 : false}
            className={`rounded-xl border p-3 text-left font-bold ${
              provider === "d1"
                ? "border-[var(--color-primary)] bg-[var(--color-primary)] text-white"
                : "border-[var(--color-panel-border)] bg-[var(--color-panel-soft)]"
            } disabled:cursor-not-allowed disabled:opacity-40`}
          >
            Cloudflare D1
            <span className="mt-1 block text-xs font-normal opacity-80">
              Worker database binding
            </span>
          </button>
        </div>
      </div>

      {provider === "sqlite" && (
        <div className="mb-5 rounded-xl border border-[var(--color-panel-border)] bg-[var(--color-panel-soft)] p-4">
          <label className="block">
            <span className="mb-2 block text-sm font-bold">SQLite file URL</span>
            <input
              value={sqliteFileUrl}
              onChange={(event) => setSqliteFileUrl(event.target.value)}
              placeholder="file:/data/dart-scorekeeper.db"
              className="w-full rounded-xl border border-[var(--color-panel-border)] bg-[var(--color-panel)] p-3 font-mono text-sm"
            />
          </label>
          <p className="mt-2 text-xs text-[var(--color-text-muted)]">
            Use a path on a persistent volume. Vercel local files are intentionally
            disabled because its runtime filesystem is not durable application storage.
          </p>
        </div>
      )}

      {provider === "turso" && (
        <div className="mb-5 grid gap-4 rounded-xl border border-[var(--color-panel-border)] bg-[var(--color-panel-soft)] p-4 sm:grid-cols-2">
          <label className="sm:col-span-2">
            <span className="mb-2 block text-sm font-bold">Database URL</span>
            <input
              value={tursoUrl}
              onChange={(event) => setTursoUrl(event.target.value)}
              placeholder="libsql://your-database.turso.io"
              autoComplete="off"
              className="w-full rounded-xl border border-[var(--color-panel-border)] bg-[var(--color-panel)] p-3 font-mono text-sm"
            />
          </label>
          <label className="sm:col-span-2">
            <span className="mb-2 block text-sm font-bold">Database auth token</span>
            <input
              type="password"
              value={tursoToken}
              onChange={(event) => setTursoToken(event.target.value)}
              autoComplete="new-password"
              className="w-full rounded-xl border border-[var(--color-panel-border)] bg-[var(--color-panel)] p-3 font-mono text-sm"
            />
          </label>
        </div>
      )}

      {provider === "d1" && (
        <div className="mb-5 rounded-xl border border-amber-500/40 bg-amber-500/10 p-4">
          <label className="block">
            <span className="mb-2 block text-sm font-bold">D1 binding name</span>
            <input
              value={d1BindingName}
              onChange={(event) => setD1BindingName(event.target.value)}
              placeholder="DB"
              className="w-full rounded-xl border border-amber-500/30 bg-[var(--color-panel)] p-3 font-mono text-sm"
            />
          </label>
          <p className="mt-3 text-sm text-amber-100/90">
            D1 is attached to a Cloudflare Worker as an environment binding rather
            than a URL/token. This preview shows the intended setup experience,
            but the D1 database adapter is not active yet.
          </p>
        </div>
      )}

      {status?.runtime === "vercel" && (
        <div className="mb-5 rounded-xl border border-sky-500/40 bg-sky-500/10 p-4">
          <div className="font-bold text-sky-100">Vercel deployment secrets</div>
          <p className="mt-1 text-sm text-sky-100/80">
            For security, Dart Scorekeeper will not keep a Vercel management token
            just to rewrite its own environment. Configure these server-side values
            in the Vercel project, then redeploy:
          </p>
          <pre className="mt-3 overflow-x-auto rounded-lg bg-black/20 p-3 text-xs text-sky-50">{`DB_PROVIDER=libsql\nDATABASE_URL=libsql://...\nDATABASE_AUTH_TOKEN=...\nBETTER_AUTH_SECRET=<strong random secret>\nBETTER_AUTH_URL=https://dart-scorekeeper.vercel.app`}</pre>
        </div>
      )}

      {status?.runtime === "cloudflare" && (
        <div className="mb-5 rounded-xl border border-sky-500/40 bg-sky-500/10 p-4">
          <div className="font-bold text-sky-100">Cloudflare deployment binding</div>
          <p className="mt-1 text-sm text-sky-100/80">
            Bind the D1 database to the Worker using the binding name above. The
            binding stays in Cloudflare deployment configuration; no D1 secret is
            stored in the browser.
          </p>
        </div>
      )}

      {canPersistFromApp && (
        <div className="mb-5 rounded-xl border border-[var(--color-panel-border)] bg-[var(--color-panel-soft)] p-4">
          {setupTokenRequired && (
            <label className="block">
              <span className="mb-2 block text-sm font-bold">Server setup token</span>
              <input
                type="password"
                value={setupToken}
                onChange={(event) => setSetupToken(event.target.value)}
                autoComplete="off"
                className="w-full rounded-xl border border-[var(--color-panel-border)] bg-[var(--color-panel)] p-3 font-mono text-sm"
              />
              <span className="mt-2 block text-xs text-[var(--color-text-muted)]">
                Find the token in the Dart Scorekeeper container/server logs. It
                is stored on the persistent volume and is never returned by this page.
              </span>
            </label>
          )}

          <div className="mt-4 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => void runSetupAction("test")}
              disabled={isWorking || provider === "d1"}
              className="rounded-xl border border-[var(--color-panel-border)] bg-[var(--color-panel)] px-4 py-2.5 font-bold hover:bg-[var(--color-panel-border)] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isWorking ? "Working…" : "Test connection"}
            </button>
            <button
              type="button"
              onClick={() => void runSetupAction("save")}
              disabled={isWorking || provider === "d1"}
              className="rounded-xl bg-[var(--color-primary)] px-4 py-2.5 font-bold text-white hover:bg-[var(--color-primary-hover)] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isWorking ? "Working…" : "Initialize & save"}
            </button>
          </div>
          <p className="mt-3 text-xs text-[var(--color-text-muted)]">
            Initialize & save tests the connection, applies committed migrations,
            stores server-only configuration on the persistent volume, and creates
            an auth secret if one does not already exist.
          </p>
        </div>
      )}

      {status && !canPersistFromApp && status.runtime === "node" && (
        <div className="mb-5 rounded-xl border border-[var(--color-panel-border)] bg-[var(--color-panel-soft)] p-4 text-sm text-[var(--color-text-muted)]">
          Local development continues to use environment variables or the default
          development SQLite file. Persistent in-app secret storage is enabled only
          for explicitly self-hosted installations.
        </div>
      )}

      {actionMessage && !actionError && (
        <div className="rounded-xl border border-emerald-500/40 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100">
          {actionMessage}
        </div>
      )}
      {actionError && (
        <div className="rounded-xl border border-rose-500/40 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">
          {actionError}
        </div>
      )}
    </section>
  );
}
