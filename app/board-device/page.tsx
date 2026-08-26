"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";

import { LeagueMatchScorer } from "@/components/LeagueMatchScorer";
import type { BoardDeviceConnectionResponse } from "@/lib/league/boardDeviceContracts";
import {
  countPendingBoardMutationsForDevice,
  getRecoverableBoardOfflineMatchForDevice,
} from "@/lib/persistence/boardMatchQueueStore";

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
  const [connection, setConnection] = useState<BoardDeviceConnectionResponse | null>(null);
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
        const result = (await response.json()) as { deviceKey?: string; error?: string };
        if (!response.ok || !result.deviceKey) {
          throw new Error(result.error ?? "Device pairing failed.");
        }
        saveDeviceKey(result.deviceKey);
        setPairCode("");
        window.history.replaceState(null, "", `${window.location.pathname}${window.location.search}`);
      } catch (error) {
        setErrorMessage(error instanceof Error ? error.message : "Device pairing failed.");
      } finally {
        setPairing(false);
      }
    },
    [saveDeviceKey],
  );

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      const savedKey = window.localStorage.getItem(STORAGE_KEY) ?? "";
      const savedMode = window.localStorage.getItem(MODE_KEY) === "casual" ? "casual" : "league";
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

  // Pairing links use a URL hash so they can be opened without a server-side
  // route. If the scorer is already sitting on this page, navigating to a new
  // #pair=123456 value is a same-document navigation and React does not remount
  // the page. Listen for that hash change so QR/link pairing works whether the
  // scoring screen was closed or already waiting for setup.
  useEffect(() => {
    function claimHashPairing() {
      const hashMatch = window.location.hash.match(/pair=(\d{6})/);
      if (!hashMatch?.[1]) return;
      setPairCode(hashMatch[1]);
      void claimPairingCode(hashMatch[1]);
    }

    window.addEventListener("hashchange", claimHashPairing);
    return () => window.removeEventListener("hashchange", claimHashPairing);
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
      if (result.assignment?.matchSessionId && result.assignment.gameNightStatus === "active") {
        setMode("league");
        window.localStorage.setItem(MODE_KEY, "league");
      }
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Could not connect this board device.",
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
        setErrorMessage(
          `Cannot forget this device while ${pending} queued board update${pending === 1 ? " is" : "s are"} waiting to sync. Re-pair the same registered device instead so the queue is preserved.`,
        );
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

  function openCasualScorer() {
    setMode("casual");
    window.localStorage.setItem(MODE_KEY, "casual");
    window.location.href = "/casual?boardDevice=casual";
  }

  if (!initialized) {
    return (
      <main className="flex min-h-screen items-center justify-center p-6 text-[var(--color-text-muted)]">
        Loading scoring device…
      </main>
    );
  }

  if (!deviceKey) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[var(--color-app-bg)] p-4 sm:p-6">
        <section className="w-full max-w-2xl rounded-3xl border border-[var(--color-panel-border)] bg-[var(--color-panel)] p-6 sm:p-8">
          <div className="text-xs font-black uppercase tracking-[0.16em] text-[var(--color-primary)]">
            Scoring Device Setup
          </div>
          <h1 className="mt-2 text-3xl font-black sm:text-4xl">Pair this scorer</h1>
          <p className="mt-3 text-[var(--color-text-muted)]">
            Pair it once and leave this page open. The scorer remembers its registration and follows the physical board it is assigned to.
          </p>

          <ol className="mt-6 grid gap-3 text-sm sm:grid-cols-3">
            <li className="rounded-2xl bg-[var(--color-panel-soft)] p-4"><strong>1.</strong> On the admin terminal, open Venue Hardware.</li>
            <li className="rounded-2xl bg-[var(--color-panel-soft)] p-4"><strong>2.</strong> Choose Pair / Re-pair for this scoring device.</li>
            <li className="rounded-2xl bg-[var(--color-panel-soft)] p-4"><strong>3.</strong> Enter the six-digit code here.</li>
          </ol>

          <form onSubmit={submitPairingCode} className="mt-6">
            <input
              aria-label="Six-digit pairing code"
              value={pairCode}
              onChange={(event) => setPairCode(event.target.value.replace(/\D/g, "").slice(0, 6))}
              inputMode="numeric"
              pattern="[0-9]*"
              autoComplete="one-time-code"
              placeholder="000000"
              className="w-full rounded-2xl border border-[var(--color-panel-border)] bg-[var(--color-panel-soft)] p-4 text-center font-mono text-4xl font-black tracking-[0.35em]"
            />
            <button
              disabled={pairing}
              className="mt-3 min-h-14 w-full rounded-2xl bg-[var(--color-primary)] px-5 py-3 text-lg font-black text-white disabled:opacity-50"
            >
              {pairing ? "Pairing…" : "Pair Scorer"}
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
    Boolean(liveMatchId) && connection?.assignment?.gameNightStatus === "active";
  const openLeagueAssignment =
    Boolean(recoverableMatchId) &&
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

  const device = connection?.device ?? null;
  const assignment = connection?.assignment ?? null;
  const isSpare = Boolean(device && !device.physicalBoardId);

  return (
    <main className="flex min-h-screen items-center justify-center bg-[var(--color-app-bg)] p-4 text-[var(--color-text-main)] sm:p-6">
      <section className="w-full max-w-4xl overflow-hidden rounded-3xl border border-[var(--color-panel-border)] bg-[var(--color-panel)] shadow-xl">
        <div className="p-6 sm:p-8">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="text-xs font-black uppercase tracking-[0.16em] text-[var(--color-primary)]">
                Scoring Device
              </div>
              <h1 className="mt-2 text-3xl font-black sm:text-4xl">
                {device?.boardName ?? (isSpare ? "Spare scorer" : device?.name ?? "Connecting…")}
              </h1>
              {device && (
                <p className="mt-2 text-sm text-[var(--color-text-muted)]">
                  {device.venueName} · {device.name}
                </p>
              )}
            </div>
            <span
              className={`rounded-full border px-3 py-1 text-xs font-black uppercase tracking-wide ${
                device
                  ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-200"
                  : "border-amber-500/40 bg-amber-500/10 text-amber-100"
              }`}
            >
              {device ? "Connected" : "Connecting"}
            </span>
          </div>

          {errorMessage && (
            <div className="mt-5 rounded-xl border border-red-500/40 bg-red-500/10 p-4 text-sm text-red-100">
              <strong>Connection needs attention.</strong> {errorMessage}
            </div>
          )}

          <div className="mt-7 rounded-3xl border border-[var(--color-panel-border)] bg-[var(--color-panel-soft)] p-6 text-center sm:p-8">
            <div className="text-5xl" aria-hidden="true">{isSpare ? "🧰" : assignment ? "🎯" : "⏳"}</div>
            <h2 className="mt-4 text-2xl font-black sm:text-3xl">
              {isSpare
                ? "This scorer is a spare"
                : assignment
                  ? assignment.gameNightStatus === "active"
                    ? "Waiting for the next board match"
                    : `Ready for ${assignment.gameNightName}`
                  : device?.physicalBoardId
                    ? "Waiting for a league match"
                    : "Checking this scorer's assignment"}
            </h2>
            <p className="mx-auto mt-3 max-w-2xl text-sm leading-6 text-[var(--color-text-muted)] sm:text-base">
              {isSpare
                ? "Nothing needs to be done here. An administrator can move this scorer onto any physical board that needs a replacement."
                : assignment
                  ? assignment.gameNightStatus === "active"
                    ? `${assignment.gameNightName} is active. This screen will open scoring automatically as soon as ${assignment.boardName} has a match ready.`
                    : `${assignment.gameNightName} is prepared for ${assignment.boardName}. Leave this screen open; scoring will appear automatically when the administrator starts play.`
                  : device?.physicalBoardId
                    ? `This device is assigned to ${device.boardName ?? "a physical board"}. Leave it here; it checks for league assignments automatically.`
                    : "The scorer is reconnecting to its registered device record."}
            </p>

            {assignment && (
              <div className="mx-auto mt-5 max-w-xl rounded-2xl border border-[var(--color-panel-border)] bg-[var(--color-panel)] p-4 text-left">
                <div className="text-xs font-black uppercase tracking-wide text-[var(--color-text-muted)]">Next assignment</div>
                <div className="mt-1 font-black">{assignment.gameNightName} · {assignment.boardName}</div>
                {assignment.teamAName && assignment.teamBName && (
                  <div className="mt-1 text-sm text-[var(--color-text-muted)]">
                    {assignment.teamAName} vs {assignment.teamBName}
                  </div>
                )}
              </div>
            )}

            <button
              type="button"
              onClick={() => void loadConnection()}
              disabled={loading}
              className="mt-6 min-h-12 rounded-xl border border-[var(--color-panel-border)] bg-[var(--color-panel)] px-5 py-3 font-black disabled:opacity-50"
            >
              {loading ? "Checking…" : "Check now"}
            </button>
            <div className="mt-2 text-xs text-[var(--color-text-muted)]">Checks automatically every five seconds.</div>
          </div>
        </div>

        <div className="border-t border-[var(--color-panel-border)] bg-[var(--color-panel-soft)] p-5 sm:p-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="font-black">Need something other than tonight&apos;s league match?</div>
              <div className="mt-1 text-sm text-[var(--color-text-muted)]">
                Casual scoring does not change this scorer&apos;s registered venue or board.
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={openCasualScorer}
                className="rounded-xl border border-[var(--color-panel-border)] px-4 py-2.5 text-sm font-black"
              >
                Start Casual Game
              </button>
              <a href="/help?from=device" className="rounded-xl border border-[var(--color-panel-border)] px-4 py-2.5 text-sm font-black">Help</a>
              <details className="relative">
                <summary className="cursor-pointer list-none rounded-xl border border-[var(--color-panel-border)] px-4 py-2.5 text-sm font-black">
                  Device options
                </summary>
                <div className="absolute bottom-12 right-0 z-20 w-64 rounded-xl border border-[var(--color-panel-border)] bg-[var(--color-panel)] p-3 shadow-xl">
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
        </div>
      </section>
    </main>
  );
}
