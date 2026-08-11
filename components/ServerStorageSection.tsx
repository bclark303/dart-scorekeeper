"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { AccountSyncPanel } from "@/components/AccountSyncPanel";
import { DatabaseSetupPanel } from "@/components/DatabaseSetupPanel";
import {
  readServerStorageMode,
  SERVER_STORAGE_MODE_CHANGED_EVENT,
  type ServerStorageMode,
  writeServerStorageMode,
} from "@/lib/serverStorageMode";
import type { DatabaseSetupStatus } from "@/lib/setup/contracts";

export function ServerStorageSection() {
  const [mode, setMode] = useState<ServerStorageMode>("local");
  const [setupStatus, setSetupStatus] = useState<DatabaseSetupStatus | null>(null);

  useEffect(() => {
    const syncMode = () => setMode(readServerStorageMode());
    syncMode();
    window.addEventListener(SERVER_STORAGE_MODE_CHANGED_EVENT, syncMode);
    return () => {
      window.removeEventListener(SERVER_STORAGE_MODE_CHANGED_EVENT, syncMode);
    };
  }, []);

  function chooseMode(nextMode: ServerStorageMode) {
    setMode(nextMode);
    writeServerStorageMode(nextMode);
  }

  return (
    <>
      <section className="mb-8 rounded-2xl border border-[var(--color-panel-border)] bg-[var(--color-panel)] p-6">
        <div className="mb-5">
          <h2 className="text-2xl font-bold">Server Storage</h2>
          <p className="mt-1 max-w-2xl text-sm text-[var(--color-text-muted)]">
            Choose whether this browser should stay completely local or use an
            optional server database for accounts, backup, and cross-device history.
            Scoring itself remains local-first in both modes.
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <button
            type="button"
            onClick={() => chooseMode("local")}
            className={`rounded-2xl border p-5 text-left transition ${
              mode === "local"
                ? "border-[var(--color-primary)] bg-[var(--color-primary)] text-white"
                : "border-[var(--color-panel-border)] bg-[var(--color-panel-soft)] hover:bg-[var(--color-panel-border)]"
            }`}
          >
            <div className="text-lg font-bold">Local Only</div>
            <div className="mt-1 text-sm opacity-80">
              No account checks or server sync. Matches stay on this device.
            </div>
          </button>

          <button
            type="button"
            onClick={() => chooseMode("connected")}
            className={`rounded-2xl border p-5 text-left transition ${
              mode === "connected"
                ? "border-[var(--color-primary)] bg-[var(--color-primary)] text-white"
                : "border-[var(--color-panel-border)] bg-[var(--color-panel-soft)] hover:bg-[var(--color-panel-border)]"
            }`}
          >
            <div className="text-lg font-bold">Connected Storage</div>
            <div className="mt-1 text-sm opacity-80">
              Enable database setup, accounts, backup, and cross-device history.
            </div>
          </button>
        </div>

        {mode === "local" && (
          <div className="mt-4 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-sm text-emerald-100/90">
            Local Only is the safe default. Existing browser scoring, saved-match
            resume, and completed-match history continue to work without contacting
            the account or synchronization service.
          </div>
        )}
      </section>

      {mode === "connected" && (
        <>
          <DatabaseSetupPanel onStatusChange={setSetupStatus} />

          {setupStatus?.account.ready ? (
            <>
              <AccountSyncPanel />
              <section className="mb-8 rounded-2xl border border-[var(--color-panel-border)] bg-[var(--color-panel)] p-5">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <h2 className="text-xl font-bold">League framework</h2>
                    <p className="mt-1 text-sm text-[var(--color-text-muted)]">
                      Signed-in accounts can create leagues and seasons. Rosters,
                      fixtures, standings, and league-match assignment come next.
                    </p>
                  </div>
                  <Link
                    href="/leagues"
                    className="w-fit rounded-xl bg-[var(--color-primary)] px-4 py-2.5 font-bold text-white hover:bg-[var(--color-primary-hover)]"
                  >
                    Open League Center
                  </Link>
                </div>
              </section>
            </>
          ) : (
            <section className="mb-8 rounded-2xl border border-amber-500/40 bg-amber-500/10 p-5">
              <h2 className="text-xl font-bold text-amber-100">
                Account & Sync waiting for database
              </h2>
              <p className="mt-1 text-sm text-amber-100/80">
                Finish the database setup above first. Until then, completed
                matches continue to stay safely in this browser and scoring is
                unaffected.
              </p>
            </section>
          )}
        </>
      )}
    </>
  );
}
