"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";

import { LeagueMatchScorer } from "@/components/LeagueMatchScorer";
import type { BoardDeviceConnectionResponse } from "@/lib/league/boardDeviceContracts";

const STORAGE_KEY = "dart-scorekeeper:board-device-key";

export default function BoardDevicePage() {
  const [deviceKey, setDeviceKey] = useState("");
  const [keyDraft, setKeyDraft] = useState("");
  const [initialized, setInitialized] = useState(false);
  const [connection, setConnection] = useState<BoardDeviceConnectionResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    const saved = window.localStorage.getItem(STORAGE_KEY) ?? "";
    setDeviceKey(saved);
    setKeyDraft(saved);
    setInitialized(true);
  }, []);

  const loadConnection = useCallback(async () => {
    if (!deviceKey) return;
    setLoading(true);
    try {
      const response = await fetch("/api/board-device", {
        cache: "no-store",
        headers: { Authorization: `Bearer ${deviceKey}` },
      });
      const result = (await response.json()) as BoardDeviceConnectionResponse;
      if (!response.ok || !result.device) {
        throw new Error(result.error ?? "Could not connect this board device.");
      }
      setConnection(result);
      setErrorMessage("");
    } catch (error) {
      setConnection(null);
      setErrorMessage(error instanceof Error ? error.message : "Could not connect this board device.");
    } finally {
      setLoading(false);
    }
  }, [deviceKey]);

  useEffect(() => {
    if (!deviceKey) return;
    const timeout = window.setTimeout(() => void loadConnection(), 0);
    const interval = window.setInterval(() => void loadConnection(), 5000);
    return () => {
      window.clearTimeout(timeout);
      window.clearInterval(interval);
    };
  }, [deviceKey, loadConnection]);

  function saveKey(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const value = keyDraft.trim();
    if (!value) return;
    window.localStorage.setItem(STORAGE_KEY, value);
    setDeviceKey(value);
    setConnection(null);
    setErrorMessage("");
  }

  function forgetKey() {
    window.localStorage.removeItem(STORAGE_KEY);
    setDeviceKey("");
    setKeyDraft("");
    setConnection(null);
    setErrorMessage("");
  }

  if (!initialized) {
    return <main className="mx-auto max-w-5xl p-6 text-[var(--color-text-muted)]">Loading board device…</main>;
  }

  if (!deviceKey) {
    return (
      <main className="mx-auto max-w-3xl p-6">
        <section className="rounded-2xl border border-[var(--color-panel-border)] bg-[var(--color-panel)] p-6">
          <div className="text-sm font-bold uppercase tracking-wide text-[var(--color-text-muted)]">Dart Scorekeeper</div>
          <h1 className="mt-2 text-3xl font-bold">Register this board device</h1>
          <p className="mt-2 text-[var(--color-text-muted)]">
            Enter the one-time device key created in League → Board Devices. The key is stored only in this browser and replaces human account sign-in for this scorer.
          </p>
          <form onSubmit={saveKey} className="mt-5">
            <textarea value={keyDraft} onChange={(event) => setKeyDraft(event.target.value)} rows={4} spellCheck={false} placeholder="dsk_..." className="w-full rounded-xl border border-[var(--color-panel-border)] bg-[var(--color-panel-soft)] p-4 font-mono text-sm" />
            <button className="mt-3 rounded-xl bg-[var(--color-primary)] px-5 py-3 font-bold text-white">Register Device</button>
          </form>
        </section>
      </main>
    );
  }

  if (connection?.assignment?.matchSessionId) {
    return (
      <LeagueMatchScorer
        matchId={connection.assignment.matchSessionId}
        authMode="device"
        deviceKey={deviceKey}
        backHref="/board-device"
        backLabel="← Device Status"
      />
    );
  }

  return (
    <main className="mx-auto max-w-4xl p-4 sm:p-6">
      <section className="rounded-2xl border border-[var(--color-panel-border)] bg-[var(--color-panel)] p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="text-sm font-bold uppercase tracking-wide text-[var(--color-text-muted)]">Board Device</div>
            <h1 className="mt-1 text-3xl font-bold">{connection?.device?.name ?? "Connecting…"}</h1>
            {connection?.device && <p className="mt-1 text-sm text-[var(--color-text-muted)]">{connection.device.leagueName} · Board {connection.device.boardNumber}</p>}
          </div>
          <div className="flex gap-2">
            <button type="button" disabled={loading} onClick={() => void loadConnection()} className="rounded-xl border border-[var(--color-panel-border)] px-4 py-2 text-sm font-bold disabled:opacity-50">Refresh</button>
            <button type="button" onClick={forgetKey} className="rounded-xl border border-[var(--color-panel-border)] px-4 py-2 text-sm font-bold">Forget Key</button>
          </div>
        </div>

        {errorMessage && <div className="mt-5 rounded-xl border border-red-500/40 bg-red-500/10 p-4 text-sm text-red-100">{errorMessage}</div>}

        {!errorMessage && connection?.assignment ? (
          <div className="mt-6 rounded-xl border border-[var(--color-panel-border)] bg-[var(--color-panel-soft)] p-5">
            <div className="text-sm uppercase tracking-wide text-[var(--color-text-muted)]">Current assignment</div>
            <h2 className="mt-1 text-2xl font-bold">{connection.assignment.gameNightName}</h2>
            <p className="mt-2 text-[var(--color-text-muted)]">
              {connection.assignment.teamAName && connection.assignment.teamBName
                ? `${connection.assignment.teamAName} vs ${connection.assignment.teamBName}`
                : "This board exists for the game night but has not been populated with a match yet."}
            </p>
            <p className="mt-2 text-sm text-[var(--color-text-muted)]">Game night: {connection.assignment.gameNightStatus} · Match: {connection.assignment.matchStatus ?? "not populated"}</p>
          </div>
        ) : !errorMessage ? (
          <div className="mt-6 rounded-xl border border-[var(--color-panel-border)] bg-[var(--color-panel-soft)] p-5">
            <h2 className="text-xl font-bold">Waiting for assignment</h2>
            <p className="mt-2 text-sm text-[var(--color-text-muted)]">
              This device is registered and checking the central server every five seconds. Populate its board in a ready/active Game Night and the scorer will open automatically.
            </p>
          </div>
        ) : null}
      </section>
    </main>
  );
}
