"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";

import { authClient } from "@/lib/auth/client";
import type { LeagueListResponse, LeagueSummary } from "@/lib/league/contracts";
import type {
  BoardDeviceAdminResponse,
  BoardDeviceSummary,
} from "@/lib/league/boardDeviceContracts";

type DeviceDraft = { name: string; boardNumber: number };

type Pairing = {
  deviceId: string;
  deviceName: string;
  code: string;
  expiresAt: number;
  url: string;
};

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
  const [pairing, setPairing] = useState<Pairing | null>(null);
  const [registering, setRegistering] = useState(false);
  const [pairingDeviceId, setPairingDeviceId] = useState<string | null>(null);
  const [savingDeviceIds, setSavingDeviceIds] = useState<Set<string>>(() => new Set());
  const [errorMessage, setErrorMessage] = useState("");
  const [statusMessage, setStatusMessage] = useState("");
  const activeLeagueIdRef = useRef("");

  useEffect(() => {
    activeLeagueIdRef.current = leagueId;
  }, [leagueId]);

  const pairingExpiryLabel = useMemo(() => {
    if (!pairing) return "";
    return new Intl.DateTimeFormat(undefined, {
      hour: "numeric",
      minute: "2-digit",
      second: "2-digit",
    }).format(new Date(pairing.expiresAt));
  }, [pairing]);

  const loadLeagues = useCallback(async () => {
    const response = await fetch("/api/leagues", { cache: "no-store" });
    const result = (await response.json()) as LeagueListResponse & {
      error?: string;
    };
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
        setErrorMessage(
          error instanceof Error ? error.message : "Could not load leagues.",
        ),
      );
    }, 0);
    return () => window.clearTimeout(timeout);
  }, [loadLeagues, session?.user]);

  useEffect(() => {
    if (!leagueId) return;
    const timeout = window.setTimeout(() => {
      void loadDevices(leagueId).catch((error) =>
        setErrorMessage(
          error instanceof Error ? error.message : "Could not load devices.",
        ),
      );
    }, 0);
    return () => window.clearTimeout(timeout);
  }, [leagueId, loadDevices]);

  async function createPairing(device: BoardDeviceSummary) {
    const response = await fetch("/api/leagues/board-devices/pairing", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ deviceId: device.id }),
    });
    const result = (await response.json()) as {
      code?: string;
      expiresAt?: number;
      error?: string;
    };
    if (!response.ok || !result.code || !result.expiresAt) {
      throw new Error(result.error ?? "Could not create a pairing code.");
    }

    setPairing({
      deviceId: device.id,
      deviceName: device.name,
      code: result.code,
      expiresAt: result.expiresAt,
      url: `${window.location.origin}/board-device#pair=${result.code}`,
    });
    setStatusMessage(
      `${device.name} is ready to pair. The code expires in ten minutes.`,
    );
  }

  function markDeviceSaving(deviceId: string, saving: boolean) {
    setSavingDeviceIds((current) => {
      const next = new Set(current);
      if (saving) next.add(deviceId);
      else next.delete(deviceId);
      return next;
    });
  }

  function replaceDevice(updated: BoardDeviceSummary) {
    setDevices((current) =>
      current
        .map((device) => (device.id === updated.id ? updated : device))
        .sort((a, b) => a.boardNumber - b.boardNumber),
    );
  }

  async function requestDeviceUpdate(body: object) {
    const response = await fetch("/api/leagues/board-devices", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const result = (await response.json()) as BoardDeviceAdminResponse;
    if (!response.ok || !result.device) {
      throw new Error(result.error ?? "Board device update failed.");
    }
    return result.device;
  }

  async function registerDevice(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!leagueId) return;
    const targetLeagueId = leagueId;
    setRegistering(true);
    setErrorMessage("");
    setStatusMessage("");
    setPairing(null);
    try {
      const response = await fetch("/api/leagues/board-devices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          leagueId: targetLeagueId,
          name: newName,
          boardNumber: newBoardNumber,
        }),
      });
      const result = (await response.json()) as BoardDeviceAdminResponse;
      if (!response.ok || !result.device) {
        throw new Error(
          result.error ?? "Board device could not be registered.",
        );
      }
      if (activeLeagueIdRef.current === targetLeagueId) {
        setDevices((current) =>
          [...current.filter((device) => device.id !== result.device?.id), result.device!]
            .sort((a, b) => a.boardNumber - b.boardNumber),
        );
        setDrafts((current) => ({
          ...current,
          [result.device!.id]: {
            name: result.device!.name,
            boardNumber: result.device!.boardNumber,
          },
        }));
        await createPairing(result.device);
      }
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Board device could not be registered.",
      );
    } finally {
      setRegistering(false);
    }
  }

  async function saveDevice(device: BoardDeviceSummary, draft: DeviceDraft) {
    const targetLeagueId = leagueId;
    markDeviceSaving(device.id, true);
    setErrorMessage("");
    setStatusMessage("");
    try {
      const updated = await requestDeviceUpdate({
        action: "update",
        deviceId: device.id,
        name: draft.name,
        boardNumber: draft.boardNumber,
      });
      if (activeLeagueIdRef.current === targetLeagueId) {
        replaceDevice(updated);
        setDrafts((current) => ({
          ...current,
          [updated.id]: { name: updated.name, boardNumber: updated.boardNumber },
        }));
        setStatusMessage(`${updated.name} updated.`);
      }
    } catch (error) {
      if (activeLeagueIdRef.current === targetLeagueId) {
        setErrorMessage(
          error instanceof Error ? error.message : "Board device update failed.",
        );
      }
    } finally {
      markDeviceSaving(device.id, false);
    }
  }

  async function toggleDeviceStatus(device: BoardDeviceSummary) {
    const targetLeagueId = leagueId;
    const previousStatus = device.status;
    const nextStatus = device.status === "active" ? "disabled" : "active";
    markDeviceSaving(device.id, true);
    setErrorMessage("");
    setStatusMessage("");
    setDevices((current) =>
      current.map((item) =>
        item.id === device.id ? { ...item, status: nextStatus } : item,
      ),
    );

    try {
      const updated = await requestDeviceUpdate({
        action: "update",
        deviceId: device.id,
        status: nextStatus,
      });
      if (activeLeagueIdRef.current === targetLeagueId) {
        replaceDevice(updated);
        setStatusMessage(`${updated.name} ${nextStatus === "active" ? "enabled" : "disabled"}.`);
      }
    } catch (error) {
      if (activeLeagueIdRef.current === targetLeagueId) {
        setDevices((current) =>
          current.map((item) =>
            item.id === device.id ? { ...item, status: previousStatus } : item,
          ),
        );
        setErrorMessage(
          error instanceof Error ? error.message : "Board device update failed.",
        );
      }
    } finally {
      markDeviceSaving(device.id, false);
    }
  }

  async function pairExistingDevice(device: BoardDeviceSummary) {
    setPairingDeviceId(device.id);
    setErrorMessage("");
    setStatusMessage("");
    try {
      await createPairing(device);
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Could not create pairing code.",
      );
    } finally {
      setPairingDeviceId(null);
    }
  }

  if (sessionPending) {
    return (
      <main className="mx-auto max-w-6xl p-6 text-[var(--color-text-muted)]">
        Loading account…
      </main>
    );
  }

  if (!session?.user) {
    return (
      <main className="mx-auto max-w-3xl p-6">
        <Link
          href="/"
          className="text-sm font-semibold text-[var(--color-primary)]"
        >
          ← Back to scorekeeper
        </Link>
        <section className="mt-6 rounded-2xl border border-[var(--color-panel-border)] bg-[var(--color-panel)] p-6">
          <h1 className="text-3xl font-bold">Board Devices</h1>
          <p className="mt-2 text-[var(--color-text-muted)]">
            Sign in before registering league board devices.
          </p>
        </section>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-6xl p-4 sm:p-6">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link
            href="/league-play"
            className="text-sm font-semibold text-[var(--color-primary)]"
          >
            ← League Play
          </Link>
          <h1 className="mt-2 text-3xl font-bold">Board Devices</h1>
          <p className="mt-1 text-sm text-[var(--color-text-muted)]">
            Register a persistent scorer for each physical board, then pair it
            with a short-lived six-digit code.
          </p>
        </div>
        <Link
          href="/board-device"
          className="rounded-xl border border-[var(--color-panel-border)] px-4 py-2 text-sm font-bold"
        >
          Open Device Client
        </Link>
      </div>

      {errorMessage && (
        <div className="mb-4 rounded-xl border border-red-500/40 bg-red-500/10 p-4 text-sm text-red-100">
          {errorMessage}
        </div>
      )}
      {statusMessage && (
        <div className="mb-4 rounded-xl border border-emerald-500/40 bg-emerald-500/10 p-4 text-sm text-emerald-100">
          {statusMessage}
        </div>
      )}

      {pairing && (
        <section className="mb-6 rounded-2xl border border-amber-500/40 bg-amber-500/10 p-5">
          <div className="text-sm font-bold uppercase tracking-wide text-amber-100/80">
            Pair {pairing.deviceName}
          </div>
          <div className="mt-2 font-mono text-5xl font-black tracking-[0.25em] text-amber-50">
            {pairing.code}
          </div>
          <p className="mt-3 text-sm text-amber-100/80">
            Enter this code on the board device. It expires at{" "}
            {pairingExpiryLabel} and is invalid immediately after use.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void navigator.clipboard.writeText(pairing.url)}
              className="rounded-xl bg-amber-200 px-4 py-2 font-bold text-black"
            >
              Copy Pairing Link
            </button>
            <a
              href={pairing.url}
              className="rounded-xl border border-amber-500/40 px-4 py-2 font-bold text-amber-100"
            >
              Open Pairing Link
            </a>
            <button
              type="button"
              onClick={() => setPairing(null)}
              className="rounded-xl border border-amber-500/40 px-4 py-2 font-bold text-amber-100"
            >
              Done
            </button>
          </div>
        </section>
      )}

      <section className="mb-6 rounded-2xl border border-[var(--color-panel-border)] bg-[var(--color-panel)] p-5">
        <label className="text-sm font-bold">League</label>
        <select
          value={leagueId}
          disabled={registering}
          onChange={(event) => {
            const nextLeagueId = event.target.value;
            activeLeagueIdRef.current = nextLeagueId;
            setLeagueId(nextLeagueId);
            setPairing(null);
          }}
          className="mt-2 w-full rounded-xl border border-[var(--color-panel-border)] bg-[var(--color-panel-soft)] px-3 py-3 sm:max-w-md"
        >
          <option value="">Select a league</option>
          {leagues.map((league) => (
            <option key={league.id} value={league.id}>
              {league.name}
            </option>
          ))}
        </select>
      </section>

      {leagueId && (
        <section className="mb-6 rounded-2xl border border-[var(--color-panel-border)] bg-[var(--color-panel)] p-5">
          <h2 className="text-xl font-bold">Add a board device</h2>
          <form
            onSubmit={registerDevice}
            className="mt-4 grid gap-3 sm:grid-cols-[1fr_160px_auto]"
          >
            <input
              value={newName}
              onChange={(event) => setNewName(event.target.value)}
              maxLength={80}
              required
              placeholder="Board 1 Scorer"
              className="rounded-xl border border-[var(--color-panel-border)] bg-[var(--color-panel-soft)] px-3 py-3"
            />
            <label className="text-sm">
              Board number
              <input
                type="number"
                min={1}
                max={32}
                value={newBoardNumber}
                onChange={(event) =>
                  setNewBoardNumber(Number(event.target.value))
                }
                className="mt-1 w-full rounded-xl border border-[var(--color-panel-border)] bg-[var(--color-panel-soft)] px-3 py-2"
              />
            </label>
            <button
              disabled={registering}
              className="self-end rounded-xl bg-[var(--color-primary)] px-4 py-3 font-bold text-white disabled:opacity-50"
            >
              {registering ? "Adding…" : "Add & Pair Device"}
            </button>
          </form>
        </section>
      )}

      <section className="rounded-2xl border border-[var(--color-panel-border)] bg-[var(--color-panel)] p-5">
        <h2 className="text-xl font-bold">Registered Devices</h2>
        <div className="mt-4 space-y-3">
          {devices.map((device) => {
            const draft = drafts[device.id] ?? {
              name: device.name,
              boardNumber: device.boardNumber,
            };
            const isSaving = savingDeviceIds.has(device.id);
            const isPairing = pairingDeviceId === device.id;
            const rowBusy = isSaving || isPairing;
            return (
              <div
                key={device.id}
                className="rounded-xl border border-[var(--color-panel-border)] p-4"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-bold">{device.name}</h3>
                      <span
                        className={`rounded-full px-2 py-1 text-[10px] font-bold uppercase ${
                          device.status === "active"
                            ? "bg-emerald-500/20 text-emerald-100"
                            : "bg-red-500/20 text-red-100"
                        }`}
                      >
                        {device.status}
                      </span>
                      {rowBusy && (
                        <span className="rounded-full bg-blue-500/10 px-2 py-1 text-[10px] font-bold uppercase text-blue-200">
                          {isPairing ? "Pairing…" : "Saving…"}
                        </span>
                      )}
                    </div>
                    <div className="mt-1 text-xs text-[var(--color-text-muted)]">
                      Board {device.boardNumber} · {seenLabel(device.lastSeenAt)}
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      disabled={pairingDeviceId !== null || isSaving || device.status !== "active"}
                      onClick={() => void pairExistingDevice(device)}
                      className="rounded-lg border border-[var(--color-panel-border)] px-3 py-2 text-sm font-bold disabled:opacity-50"
                    >
                      Pair / Re-pair
                    </button>
                    <button
                      type="button"
                      disabled={rowBusy}
                      onClick={() => void toggleDeviceStatus(device)}
                      className="rounded-lg border border-[var(--color-panel-border)] px-3 py-2 text-sm font-bold disabled:opacity-50"
                    >
                      {device.status === "active" ? "Disable" : "Enable"}
                    </button>
                  </div>
                </div>

                <div className="mt-4 grid gap-2 sm:grid-cols-[1fr_130px_auto]">
                  <input
                    value={draft.name}
                    disabled={rowBusy}
                    onChange={(event) =>
                      setDrafts((current) => ({
                        ...current,
                        [device.id]: { ...draft, name: event.target.value },
                      }))
                    }
                    className="rounded-lg border border-[var(--color-panel-border)] bg-[var(--color-panel-soft)] px-3 py-2 text-sm"
                  />
                  <input
                    type="number"
                    min={1}
                    max={32}
                    value={draft.boardNumber}
                    disabled={rowBusy}
                    onChange={(event) =>
                      setDrafts((current) => ({
                        ...current,
                        [device.id]: {
                          ...draft,
                          boardNumber: Number(event.target.value),
                        },
                      }))
                    }
                    className="rounded-lg border border-[var(--color-panel-border)] bg-[var(--color-panel-soft)] px-3 py-2 text-sm"
                  />
                  <button
                    type="button"
                    disabled={rowBusy}
                    onClick={() => void saveDevice(device, draft)}
                    className="rounded-lg bg-[var(--color-panel-soft)] px-3 py-2 text-sm font-bold disabled:opacity-50"
                  >
                    {isSaving ? "Saving…" : "Save"}
                  </button>
                </div>
              </div>
            );
          })}
          {!devices.length && (
            <p className="text-sm text-[var(--color-text-muted)]">
              No board devices registered for this league.
            </p>
          )}
        </div>
      </section>
    </main>
  );
}
