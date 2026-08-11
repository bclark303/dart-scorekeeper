"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useState } from "react";

import { authClient } from "@/lib/auth/client";
import type { LeagueListResponse, LeagueSummary } from "@/lib/league/contracts";
import type {
  BoardDeviceAdminResponse,
  BoardDeviceSummary,
} from "@/lib/league/boardDeviceContracts";

type DeviceDraft = { name: string; boardNumber: number };

function seenLabel(value: number | null) {
  if (!value) return "Never connected";
  return `Last seen ${new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value))}`;
}

export default function LeagueDevicesPage() {
  const { data: session, isPending: sessionPending } = authClient.useSession();
  const [leagues, setLeagues] = useState<LeagueSummary[]>([]);
  const [leagueId, setLeagueId] = useState("");
  const [devices, setDevices] = useState<BoardDeviceSummary[]>([]);
  const [drafts, setDrafts] = useState<Record<string, DeviceDraft>>({});
  const [newName, setNewName] = useState("Board 1 Scorer");
  const [newBoardNumber, setNewBoardNumber] = useState(1);
  const [issuedKey, setIssuedKey] = useState<string | null>(null);
  const [issuedDeviceName, setIssuedDeviceName] = useState("");
  const [working, setWorking] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [statusMessage, setStatusMessage] = useState("");

  const loadLeagues = useCallback(async () => {
    const response = await fetch("/api/leagues", { cache: "no-store" });
    const result = (await response.json()) as LeagueListResponse & { error?: string };
    if (!response.ok) throw new Error(result.error ?? "Could not load leagues.");
    setLeagues(result.leagues);
    setLeagueId((current) => current || result.leagues[0]?.id || "");
  }, []);

  const loadDevices = useCallback(async (selectedLeagueId: string) => {
    if (!selectedLeagueId) return;
    const response = await fetch(
      `/api/leagues/board-devices?leagueId=${encodeURIComponent(selectedLeagueId)}`,
      { cache: "no-store" },
    );
    const result = (await response.json()) as BoardDeviceAdminResponse;
    if (!response.ok || !result.devices) {
      throw new Error(result.error ?? "Could not load board devices.");
    }
    setDevices(result.devices);
    setDrafts(
      Object.fromEntries(
        result.devices.map((device) => [
          device.id,
          { name: device.name, boardNumber: device.boardNumber },
        ]),
      ),
    );
  }, []);

  useEffect(() => {
    if (!session?.user) return;
    const timeout = window.setTimeout(() => {
      void loadLeagues().catch((error) =>
        setErrorMessage(error instanceof Error ? error.message : "Could not load leagues."),
      );
    }, 0);
    return () => window.clearTimeout(timeout);
  }, [loadLeagues, session?.user]);

  useEffect(() => {
    if (!leagueId) return;
    const timeout = window.setTimeout(() => {
      void loadDevices(leagueId).catch((error) =>
        setErrorMessage(error instanceof Error ? error.message : "Could not load devices."),
      );
    }, 0);
    return () => window.clearTimeout(timeout);
  }, [leagueId, loadDevices]);

  async function registerDevice(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!leagueId) return;
    setWorking(true);
    setErrorMessage("");
    setStatusMessage("");
    try {
      const response = await fetch("/api/leagues/board-devices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ leagueId, name: newName, boardNumber: newBoardNumber }),
      });
      const result = (await response.json()) as BoardDeviceAdminResponse;
      if (!response.ok || !result.device || !result.deviceKey) {
        throw new Error(result.error ?? "Board device could not be registered.");
      }
      setIssuedKey(result.deviceKey);
      setIssuedDeviceName(result.device.name);
      setStatusMessage(`${result.device.name} registered. Save its one-time key now.`);
      await loadDevices(leagueId);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Board device could not be registered.");
    } finally {
      setWorking(false);
    }
  }

  async function patchDevice(body: object) {
    setWorking(true);
    setErrorMessage("");
    setStatusMessage("");
    try {
      const response = await fetch("/api/leagues/board-devices", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const result = (await response.json()) as BoardDeviceAdminResponse;
      if (!response.ok || !result.device) {
        throw new Error(result.error ?? "Board device update failed.");
      }
      if (result.deviceKey) {
        setIssuedKey(result.deviceKey);
        setIssuedDeviceName(result.device.name);
        setStatusMessage(`${result.device.name} key rotated. The old key is now invalid.`);
      } else {
        setStatusMessage(`${result.device.name} updated.`);
      }
      await loadDevices(leagueId);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Board device update failed.");
    } finally {
      setWorking(false);
    }
  }

  if (sessionPending) {
    return <main className="mx-auto max-w-6xl p-6 text-[var(--color-text-muted)]">Loading account…</main>;
  }

  if (!session?.user) {
    return (
      <main className="mx-auto max-w-3xl p-6">
        <Link href="/" className="text-sm font-semibold text-[var(--color-primary)]">← Back to scorekeeper</Link>
        <section className="mt-6 rounded-2xl border border-[var(--color-panel-border)] bg-[var(--color-panel)] p-6">
          <h1 className="text-3xl font-bold">Board Devices</h1>
          <p className="mt-2 text-[var(--color-text-muted)]">Sign in before registering league board devices.</p>
        </section>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-6xl p-4 sm:p-6">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link href="/game-nights" className="text-sm font-semibold text-[var(--color-primary)]">← Back to Game Nights</Link>
          <h1 className="mt-2 text-3xl font-bold">Board Devices</h1>
          <p className="mt-1 text-sm text-[var(--color-text-muted)]">
            Register one persistent scorer device for each physical board. Devices authenticate with their own key, not a human account.
          </p>
        </div>
        <Link href="/board-device" className="rounded-xl border border-[var(--color-panel-border)] px-4 py-2 text-sm font-bold">
          Open Device Client
        </Link>
      </div>

      {errorMessage && <div className="mb-4 rounded-xl border border-red-500/40 bg-red-500/10 p-4 text-sm text-red-100">{errorMessage}</div>}
      {statusMessage && <div className="mb-4 rounded-xl border border-emerald-500/40 bg-emerald-500/10 p-4 text-sm text-emerald-100">{statusMessage}</div>}

      {issuedKey && (
        <section className="mb-6 rounded-2xl border border-amber-500/40 bg-amber-500/10 p-5">
          <h2 className="text-xl font-bold text-amber-100">One-time key for {issuedDeviceName}</h2>
          <p className="mt-1 text-sm text-amber-100/80">
            This plaintext key is not stored on the server and will not be shown again. Enter it once on that board's device client.
          </p>
          <div className="mt-4 break-all rounded-xl border border-amber-500/40 bg-black/20 p-4 font-mono text-sm text-amber-50">{issuedKey}</div>
          <div className="mt-3 flex flex-wrap gap-2">
            <button type="button" onClick={() => void navigator.clipboard.writeText(issuedKey)} className="rounded-xl bg-amber-200 px-4 py-2 font-bold text-black">Copy Key</button>
            <button type="button" onClick={() => { setIssuedKey(null); setIssuedDeviceName(""); }} className="rounded-xl border border-amber-500/40 px-4 py-2 font-bold text-amber-100">I saved it</button>
          </div>
        </section>
      )}

      <section className="mb-6 rounded-2xl border border-[var(--color-panel-border)] bg-[var(--color-panel)] p-5">
        <label className="text-sm font-bold">League</label>
        <select value={leagueId} onChange={(event) => { setLeagueId(event.target.value); setIssuedKey(null); }} className="mt-2 w-full rounded-xl border border-[var(--color-panel-border)] bg-[var(--color-panel-soft)] px-3 py-3 sm:max-w-md">
          <option value="">Select a league</option>
          {leagues.map((league) => <option key={league.id} value={league.id}>{league.name}</option>)}
        </select>
      </section>

      {leagueId && (
        <section className="mb-6 rounded-2xl border border-[var(--color-panel-border)] bg-[var(--color-panel)] p-5">
          <h2 className="text-xl font-bold">Register a board</h2>
          <form onSubmit={registerDevice} className="mt-4 grid gap-3 sm:grid-cols-[1fr_160px_auto]">
            <input value={newName} onChange={(event) => setNewName(event.target.value)} maxLength={80} required placeholder="Board 1 Scorer" className="rounded-xl border border-[var(--color-panel-border)] bg-[var(--color-panel-soft)] px-3 py-3" />
            <label className="text-sm">Board number<input type="number" min={1} max={32} value={newBoardNumber} onChange={(event) => setNewBoardNumber(Number(event.target.value))} className="mt-1 w-full rounded-xl border border-[var(--color-panel-border)] bg-[var(--color-panel-soft)] px-3 py-2" /></label>
            <button disabled={working} className="self-end rounded-xl bg-[var(--color-primary)] px-4 py-3 font-bold text-white disabled:opacity-50">Register Device</button>
          </form>
          <p className="mt-2 text-xs text-[var(--color-text-muted)]">Board numbers map directly to the physical board numbers created by Game Nights.</p>
        </section>
      )}

      <section className="rounded-2xl border border-[var(--color-panel-border)] bg-[var(--color-panel)] p-5">
        <h2 className="text-xl font-bold">Registered Devices</h2>
        <div className="mt-4 space-y-3">
          {devices.map((device) => {
            const draft = drafts[device.id] ?? { name: device.name, boardNumber: device.boardNumber };
            return (
              <div key={device.id} className="rounded-xl border border-[var(--color-panel-border)] p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-bold">{device.name}</h3>
                      <span className={`rounded-full px-2 py-1 text-[10px] font-bold uppercase ${device.status === "active" ? "bg-emerald-500/20 text-emerald-100" : "bg-red-500/20 text-red-100"}`}>{device.status}</span>
                    </div>
                    <div className="mt-1 text-xs text-[var(--color-text-muted)]">Board {device.boardNumber} · {seenLabel(device.lastSeenAt)}</div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button type="button" disabled={working} onClick={() => void patchDevice({ action: "rotate", deviceId: device.id })} className="rounded-lg border border-[var(--color-panel-border)] px-3 py-2 text-sm font-bold disabled:opacity-50">Rotate Key</button>
                    <button type="button" disabled={working} onClick={() => void patchDevice({ action: "update", deviceId: device.id, status: device.status === "active" ? "disabled" : "active" })} className="rounded-lg border border-[var(--color-panel-border)] px-3 py-2 text-sm font-bold disabled:opacity-50">{device.status === "active" ? "Disable" : "Enable"}</button>
                  </div>
                </div>
                <div className="mt-4 grid gap-2 sm:grid-cols-[1fr_130px_auto]">
                  <input value={draft.name} onChange={(event) => setDrafts((current) => ({ ...current, [device.id]: { ...draft, name: event.target.value } }))} className="rounded-lg border border-[var(--color-panel-border)] bg-[var(--color-panel-soft)] px-3 py-2 text-sm" />
                  <input type="number" min={1} max={32} value={draft.boardNumber} onChange={(event) => setDrafts((current) => ({ ...current, [device.id]: { ...draft, boardNumber: Number(event.target.value) } }))} className="rounded-lg border border-[var(--color-panel-border)] bg-[var(--color-panel-soft)] px-3 py-2 text-sm" />
                  <button type="button" disabled={working} onClick={() => void patchDevice({ action: "update", deviceId: device.id, name: draft.name, boardNumber: draft.boardNumber })} className="rounded-lg bg-[var(--color-panel-soft)] px-3 py-2 text-sm font-bold disabled:opacity-50">Save</button>
                </div>
              </div>
            );
          })}
          {!devices.length && <p className="text-sm text-[var(--color-text-muted)]">No board devices registered for this league.</p>}
        </div>
      </section>
    </main>
  );
}
