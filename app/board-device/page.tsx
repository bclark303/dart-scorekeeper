"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";

import { LeagueMatchScorer } from "@/components/LeagueMatchScorer";
import type { BoardDeviceConnectionResponse } from "@/lib/league/boardDeviceContracts";
import { countPendingBoardMutationsForDevice, getRecoverableBoardOfflineMatchForDevice } from "@/lib/persistence/boardMatchQueueStore";

const STORAGE_KEY = "dart-scorekeeper:board-device-key";
const MODE_KEY = "dart-scorekeeper:board-device-mode";

type DeviceMode = "league" | "casual";

function deviceIdFromKey(value: string) {
  if (!value.startsWith("dsk_")) return null;
  const separator = value.indexOf(".", 4);
  if (separator <= 4) return null;
  return value.slice(4, separator) || null;
}

export default function BoardDevicePage() {
  const [deviceKey, setDeviceKey] = useState("");
  const [mode, setMode] = useState<DeviceMode>("league");
  const [pairCode, setPairCode] = useState("");
  const [legacyKeyDraft, setLegacyKeyDraft] = useState("");
  const [initialized, setInitialized] = useState(false);
  const [connection, setConnection] =
    useState<BoardDeviceConnectionResponse | null>(null);
  const [offlineMatchId, setOfflineMatchId] = useState("");
  const [loading, setLoading] = useState(false);
  const [pairing, setPairing] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const saveDeviceKey = useCallback((value: string) => {
    const previousKey = window.localStorage.getItem(STORAGE_KEY) ?? "";
    const sameRegisteredDevice =
      deviceIdFromKey(previousKey) &&
      deviceIdFromKey(previousKey) === deviceIdFromKey(value);
    window.localStorage.setItem(STORAGE_KEY, value);
    setDeviceKey(value);
    setConnection(null);
    // Re-pairing/rotating credentials for the same registered scorer must not
    // detach it from its durable offline match queue. A different device key
    // can safely clear only the in-memory recovery pointer; the old queue stays
    // persisted under the old device ID.
    if (!sameRegisteredDevice) setOfflineMatchId("");
    setErrorMessage("");
  }, []);

  const claimPairingCode = useCallback(
    async (rawCode: string) => {
      const code = rawCode.replace(/\D/g, "");
      if (code.length !== 6) {
        setErrorMessage("Enter the six-digit pairing code.");
        return;
      }

      setPairing(true);
      setErrorMessage("");
      try {
        const response = await fetch("/api/board-device/pair", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ code }),
        });
        const result = (await response.json()) as {
          deviceKey?: string;
          error?: string;
        };
        if (!response.ok || !result.deviceKey) {
          throw new Error(result.error ?? "Device pairing failed.");
        }
        saveDeviceKey(result.deviceKey);
        setPairCode("");
        window.history.replaceState(
          null,
          "",
          `${window.location.pathname}${window.location.search}`,
        );
      } catch (error) {
        setErrorMessage(
          error instanceof Error ? error.message : "Device pairing failed.",
        );
      } finally {
        setPairing(false);
      }
    },
    [saveDeviceKey],
  );

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      const savedKey = window.localStorage.getItem(STORAGE_KEY) ?? "";
      const savedMode =
        window.localStorage.getItem(MODE_KEY) === "casual"
          ? "casual"
          : "league";
      setDeviceKey(savedKey);
      setLegacyKeyDraft(savedKey);
      setMode(savedMode);
      setInitialized(true);
      const savedDeviceId = deviceIdFromKey(savedKey);
      if (savedDeviceId) {
        void getRecoverableBoardOfflineMatchForDevice(savedDeviceId).then((record) => {
          if (record) setOfflineMatchId(record.matchId);
        });
      }

      const hashMatch = window.location.hash.match(/pair=(\d{6})/);
      if (hashMatch?.[1]) {
        setPairCode(hashMatch[1]);
        void claimPairingCode(hashMatch[1]);
      }
    }, 0);
    return () => window.clearTimeout(timeout);
  }, [claimPairingCode]);

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
      if (result.assignment?.matchSessionId) {
        setOfflineMatchId(result.assignment.matchSessionId);
      }
      setErrorMessage("");
      if (
        result.assignment?.matchSessionId &&
        result.assignment.gameNightStatus === "active"
      ) {
        setMode("league");
        window.localStorage.setItem(MODE_KEY, "league");
      }
    } catch (error) {
      // Keep the last successful assignment mounted. The scorer itself owns
      // offline/reconnect behavior and must not be ejected by a failed parent poll.
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Could not connect this board device.",
      );
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

  function submitPairingCode(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void claimPairingCode(pairCode);
  }

  function saveLegacyKey(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const value = legacyKeyDraft.trim();
    if (!value) return;
    saveDeviceKey(value);
  }

  async function forgetRegistration() {
    const registeredDeviceId = deviceIdFromKey(deviceKey);
    if (registeredDeviceId) {
      const pending = await countPendingBoardMutationsForDevice(registeredDeviceId);
      if (pending > 0) {
        setErrorMessage(`Cannot forget this device while ${pending} queued board update${pending === 1 ? " is" : "s are"} waiting to sync. Re-pair the same registered device instead so the queue is preserved.`);
        return;
      }
    }
    window.localStorage.removeItem(STORAGE_KEY);
    window.localStorage.removeItem(MODE_KEY);
    setDeviceKey("");
    setLegacyKeyDraft("");
    setConnection(null);
    setOfflineMatchId("");
    setErrorMessage("");
    setMode("league");
  }

  function selectLeagueMode() {
    setMode("league");
    window.localStorage.setItem(MODE_KEY, "league");
  }

  function openCasualScorer() {
    setMode("casual");
    window.localStorage.setItem(MODE_KEY, "casual");
    window.location.href = "/casual?boardDevice=casual";
  }

  if (!initialized) {
    return (
      <main className="mx-auto max-w-5xl p-6 text-[var(--color-text-muted)]">
        Loading board device…
      </main>
    );
  }

  if (!deviceKey) {
    return (
      <main className="mx-auto max-w-3xl p-6">
        <section className="rounded-2xl border border-[var(--color-panel-border)] bg-[var(--color-panel)] p-6">
          <div className="text-sm font-bold uppercase tracking-wide text-[var(--color-text-muted)]">
            Dart Scorekeeper
          </div>
          <h1 className="mt-2 text-3xl font-bold">Pair this scoring device</h1>
          <p className="mt-2 text-[var(--color-text-muted)]">
            On an administrator screen, open Venue Hardware and choose Pair / Re-pair
            for this device. Enter the six-digit code shown there. Codes expire
            after ten minutes and can only be used once.
          </p>

          <form onSubmit={submitPairingCode} className="mt-5">
            <input
              value={pairCode}
              onChange={(event) =>
                setPairCode(event.target.value.replace(/\D/g, "").slice(0, 6))
              }
              inputMode="numeric"
              pattern="[0-9]*"
              autoComplete="one-time-code"
              placeholder="000000"
              className="w-full rounded-xl border border-[var(--color-panel-border)] bg-[var(--color-panel-soft)] p-4 text-center font-mono text-4xl font-black tracking-[0.35em]"
            />
            <button
              disabled={pairing}
              className="mt-3 w-full rounded-xl bg-[var(--color-primary)] px-5 py-3 font-bold text-white disabled:opacity-50"
            >
              {pairing ? "Pairing…" : "Pair Device"}
            </button>
          </form>

          {errorMessage && (
            <div className="mt-4 rounded-xl border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-100">
              {errorMessage}
            </div>
          )}

          <details className="mt-6">
            <summary className="cursor-pointer text-sm font-bold text-[var(--color-text-muted)]">
              Advanced: use a legacy device key
            </summary>
            <form onSubmit={saveLegacyKey} className="mt-3">
              <textarea
                value={legacyKeyDraft}
                onChange={(event) => setLegacyKeyDraft(event.target.value)}
                rows={3}
                spellCheck={false}
                placeholder="dsk_..."
                className="w-full rounded-xl border border-[var(--color-panel-border)] bg-[var(--color-panel-soft)] p-3 font-mono text-xs"
              />
              <button className="mt-2 rounded-xl border border-[var(--color-panel-border)] px-4 py-2 text-sm font-bold">
                Save Legacy Key
              </button>
            </form>
          </details>
        </section>
      </main>
    );
  }

  const registeredDeviceId = deviceIdFromKey(deviceKey);
  const liveMatchId = connection?.assignment?.matchSessionId ?? null;
  const recoverableMatchId = liveMatchId ?? (offlineMatchId || null);
  const activeLeagueAssignment =
    liveMatchId && connection?.assignment?.gameNightStatus === "active";
  const openLeagueAssignment =
    recoverableMatchId &&
    (mode === "league" || activeLeagueAssignment || Boolean(offlineMatchId));

  if (openLeagueAssignment && recoverableMatchId && registeredDeviceId) {
    return (
      <LeagueMatchScorer
        matchId={recoverableMatchId}
        authMode="device"
        deviceKey={deviceKey}
        deviceId={registeredDeviceId}
        backHref="/board-device"
        backLabel="← Device Home"
      />
    );
  }

  return (
    <main className="mx-auto max-w-5xl p-4 sm:p-6">
      <section className="rounded-2xl border border-[var(--color-panel-border)] bg-[var(--color-panel)] p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="text-sm font-bold uppercase tracking-wide text-[var(--color-text-muted)]">
              Scoring Device
            </div>
            <h1 className="mt-1 text-3xl font-bold">
              {connection?.device?.name ?? "Connecting…"}
            </h1>
            {connection?.device && (
              <p className="mt-1 text-sm text-[var(--color-text-muted)]">
                {connection.device.venueName} · {connection.device.boardName ?? "Unassigned spare"}
              </p>
            )}
          </div>
          <div className="flex items-start gap-2">
            <a href="/help?from=device" className="rounded-xl border border-[var(--color-panel-border)] px-4 py-2 text-sm font-bold">? Help</a>
            <details className="relative">
              <summary className="cursor-pointer list-none rounded-xl border border-[var(--color-panel-border)] px-4 py-2 text-sm font-bold">
                Device
              </summary>
              <div className="absolute right-0 z-20 mt-2 w-64 rounded-xl border border-[var(--color-panel-border)] bg-[var(--color-panel)] p-3 shadow-xl">
                <button
                  type="button"
                  onClick={() => void forgetRegistration()}
                  className="w-full rounded-lg border border-red-500/40 px-3 py-2 text-left text-sm font-bold text-red-200"
                >
                  Forget Registration
                </button>
              </div>
            </details>
          </div>
        </div>

        {errorMessage && (
          <div className="mt-4 rounded-xl border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-100">
            {errorMessage}
          </div>
        )}

        <div className="mt-6 grid gap-3 md:grid-cols-2">
          <button
            type="button"
            onClick={selectLeagueMode}
            className={`rounded-2xl border p-5 text-left ${
              mode === "league"
                ? "border-[var(--color-primary)] bg-[var(--color-primary)]/10"
                : "border-[var(--color-panel-border)] bg-[var(--color-panel-soft)]"
            }`}
          >
            <div className="font-black">League / scheduled play</div>
            <div className="mt-1 text-sm text-[var(--color-text-muted)]">
              {connection?.device?.physicalBoardId
                ? connection?.assignment
                  ? `${connection.assignment.gameNightName} · ${connection.assignment.boardName}`
                  : `Waiting for a Game Night on ${connection.device.boardName ?? "this board"}`
                : "This device is currently a spare. Assign it to a physical board from Venue Hardware."}
            </div>
          </button>
          <button
            type="button"
            onClick={openCasualScorer}
            className="rounded-2xl border border-[var(--color-panel-border)] bg-[var(--color-panel-soft)] p-5 text-left"
          >
            <div className="font-black">Casual play</div>
            <div className="mt-1 text-sm text-[var(--color-text-muted)]">
              Start a local game without changing this device's venue/board assignment.
            </div>
          </button>
        </div>

        <div className="mt-5 text-xs text-[var(--color-text-muted)]">
          {loading ? "Checking for assignments…" : "Assignments refresh automatically."}
        </div>
      </section>
    </main>
  );
}
