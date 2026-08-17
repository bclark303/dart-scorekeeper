"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

import type {
  BoardDeviceSummary,
  PhysicalBoardSummary,
  VenueHardwareResponse,
} from "@/lib/league/boardDeviceContracts";
import type {
  GameNightBoardOperationsResponse,
  GameNightBoardUsageSummary,
} from "@/lib/league/gameNightBoardOperations";
import type { GameNightSummary } from "@/lib/league/gameNightContracts";

const ONLINE_WINDOW_MS = 15_000;

function formatScheduledAt(value: number) {
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

function deviceHealth(device: BoardDeviceSummary | null, now: number) {
  if (!device) return { label: "No scorer", tone: "amber" as const };
  if (device.status === "disabled") return { label: "Disabled", tone: "red" as const };
  if (!device.lastSeenAt) return { label: "Offline · never connected", tone: "red" as const };
  const age = now - device.lastSeenAt;
  if (age <= ONLINE_WINDOW_MS) return { label: "Online", tone: "green" as const };
  const seconds = Math.max(1, Math.round(age / 1000));
  return {
    label: seconds < 120 ? `Offline · ${seconds}s ago` : `Offline · ${Math.round(seconds / 60)}m ago`,
    tone: "red" as const,
  };
}

function toneClasses(tone: "green" | "amber" | "red") {
  if (tone === "green") return "border-emerald-500/40 bg-emerald-500/10 text-emerald-200";
  if (tone === "red") return "border-red-500/40 bg-red-500/10 text-red-200";
  return "border-amber-500/40 bg-amber-500/10 text-amber-100";
}

type Props = {
  leagueId: string;
  night: GameNightSummary;
  onNightChange: (night: GameNightSummary) => void;
};

export function GameNightBoardOperationsPanel({ leagueId, night, onNightChange }: Props) {
  const [physicalBoards, setPhysicalBoards] = useState<PhysicalBoardSummary[]>([]);
  const [devices, setDevices] = useState<BoardDeviceSummary[]>([]);
  const [usages, setUsages] = useState<GameNightBoardUsageSummary[]>([]);
  const [moveTargets, setMoveTargets] = useState<Record<string, string>>({});
  const [workingKey, setWorkingKey] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [statusMessage, setStatusMessage] = useState("");
  const [clock, setClock] = useState(() => Date.now());

  const deviceByBoard = useMemo(
    () => new Map(
      devices
        .filter((device) => device.physicalBoardId)
        .map((device) => [device.physicalBoardId!, device]),
    ),
    [devices],
  );

  const currentPhysicalIds = useMemo(
    () => new Set(
      night.boards
        .map((board) => board.physicalBoardId)
        .filter((id): id is string => Boolean(id)),
    ),
    [night.boards],
  );

  const loadOperations = useCallback(async () => {
    if (!leagueId || !night.venueId) {
      setPhysicalBoards([]);
      setDevices([]);
      setUsages([]);
      return;
    }

    const hardwareParams = new URLSearchParams({ leagueId, venueId: night.venueId });
    const operationsParams = new URLSearchParams({ gameNightId: night.id });
    const [hardwareResponse, operationsResponse] = await Promise.all([
      fetch(`/api/leagues/board-devices?${hardwareParams.toString()}`, { cache: "no-store" }),
      fetch(`/api/leagues/game-nights/board-operations?${operationsParams.toString()}`, { cache: "no-store" }),
    ]);
    const hardware = (await hardwareResponse.json()) as VenueHardwareResponse;
    const operations = (await operationsResponse.json()) as GameNightBoardOperationsResponse;
    if (!hardwareResponse.ok || !hardware.boards || !hardware.devices) {
      throw new Error(hardware.error ?? "Could not load venue hardware.");
    }
    if (!operationsResponse.ok) {
      throw new Error(operations.error ?? "Could not load board allocations.");
    }
    setPhysicalBoards(hardware.boards);
    setDevices(hardware.devices);
    setUsages(operations.usages ?? []);
    setClock(Date.now());
    setErrorMessage("");
  }, [leagueId, night.id, night.venueId]);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      void loadOperations().catch((error) =>
        setErrorMessage(error instanceof Error ? error.message : "Could not load board operations."),
      );
    }, 0);
    const interval = window.setInterval(() => {
      void loadOperations().catch((error) =>
        setErrorMessage(error instanceof Error ? error.message : "Could not refresh board operations."),
      );
    }, 5000);
    return () => {
      window.clearTimeout(timeout);
      window.clearInterval(interval);
    };
  }, [loadOperations]);

  async function assignScorer(board: PhysicalBoardSummary, deviceId: string) {
    const current = deviceByBoard.get(board.id) ?? null;
    const key = `device:${board.id}`;
    setWorkingKey(key);
    setErrorMessage("");
    setStatusMessage("");
    try {
      if (!deviceId) {
        if (!current) return;
        const response = await fetch("/api/leagues/board-devices", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "update", deviceId: current.id, physicalBoardId: null }),
        });
        const result = (await response.json()) as VenueHardwareResponse;
        if (!response.ok) throw new Error(result.error ?? "Could not detach the scorer.");
        setStatusMessage(`${current.name} is now a spare. The match stayed on ${board.name}.`);
      } else {
        const next = devices.find((device) => device.id === deviceId);
        if (!next) throw new Error("The selected scoring device is no longer available.");
        const response = await fetch("/api/leagues/board-devices", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "update", deviceId: next.id, physicalBoardId: board.id }),
        });
        const result = (await response.json()) as VenueHardwareResponse;
        if (!response.ok) throw new Error(result.error ?? "Could not replace the scorer.");
        setStatusMessage(`${next.name} is now serving ${board.name}. Match state was not changed.`);
      }
      await loadOperations();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Scorer reassignment failed.");
    } finally {
      setWorkingKey("");
    }
  }

  async function relocateBoard(gameNightBoardId: string) {
    const physicalBoardId = moveTargets[gameNightBoardId];
    if (!physicalBoardId) return;
    const target = physicalBoards.find((board) => board.id === physicalBoardId);
    const key = `move:${gameNightBoardId}`;
    setWorkingKey(key);
    setErrorMessage("");
    setStatusMessage("");
    try {
      const response = await fetch("/api/leagues/game-nights/board-operations", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "relocateBoard",
          gameNightId: night.id,
          gameNightBoardId,
          physicalBoardId,
        }),
      });
      const result = (await response.json()) as {
        gameNight?: GameNightSummary;
        usages?: GameNightBoardUsageSummary[];
        error?: string;
      };
      if (!response.ok || !result.gameNight) {
        throw new Error(result.error ?? "Could not move the live match.");
      }
      onNightChange(result.gameNight);
      setUsages(result.usages ?? []);
      setMoveTargets((current) => ({ ...current, [gameNightBoardId]: "" }));
      setStatusMessage(
        `Board slot moved to ${target?.name ?? "the selected board"}. Fixture, match, and score history were preserved.`,
      );
      await loadOperations();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Could not move the live match.");
    } finally {
      setWorkingKey("");
    }
  }

  const problemCount = night.boards.reduce((count, nightBoard) => {
    const physical = physicalBoards.find((board) => board.id === nightBoard.physicalBoardId) ?? null;
    const device = physical ? deviceByBoard.get(physical.id) ?? null : null;
    const unhealthyDevice = deviceHealth(device, clock).tone !== "green";
    return count + (!physical || physical.status !== "active" || unhealthyDevice ? 1 : 0);
  }, 0);

  return (
    <section className="rounded-2xl border border-[var(--color-panel-border)] bg-[var(--color-panel)] p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-black">Board & scorer health</h2>
          <p className="mt-1 max-w-3xl text-sm text-[var(--color-text-muted)]">
            Live hardware follows the physical board, not the league or match record. Replace a scorer freely; if a dartboard itself is unusable, move the existing board slot to another physical board without restarting the match.
          </p>
        </div>
        <span className={`rounded-full border px-3 py-1 text-xs font-black ${problemCount ? toneClasses("amber") : toneClasses("green")}`}>
          {problemCount ? `${problemCount} need${problemCount === 1 ? "s" : ""} attention` : "All boards healthy"}
        </span>
      </div>

      {errorMessage && (
        <div className="mt-4 rounded-xl border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-100">
          {errorMessage}
        </div>
      )}
      {statusMessage && (
        <div className="mt-4 rounded-xl border border-emerald-500/40 bg-emerald-500/10 p-3 text-sm text-emerald-100">
          {statusMessage}
        </div>
      )}

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        {night.boards.map((nightBoard) => {
          const physical = physicalBoards.find((board) => board.id === nightBoard.physicalBoardId) ?? null;
          const scorer = physical ? deviceByBoard.get(physical.id) ?? null : null;
          const health = deviceHealth(scorer, clock);
          const otherUsages = physical
            ? usages.filter((usage) => usage.physicalBoardId === physical.id)
            : [];
          const relocationCandidates = physicalBoards.filter(
            (candidate) =>
              candidate.status === "active" &&
              candidate.id !== physical?.id &&
              !currentPhysicalIds.has(candidate.id),
          );
          const moveKey = `move:${nightBoard.id}`;
          const deviceKey = `device:${physical?.id ?? nightBoard.id}`;
          const currentRoundNumber = night.activeRoundNumber ?? night.currentRoundNumber ?? 1;
          const currentPairing =
            night.pairings.find(
              (pairing) => pairing.boardId === nightBoard.id && pairing.matchStatus === "active",
            ) ??
            night.pairings.find(
              (pairing) =>
                pairing.boardId === nightBoard.id &&
                pairing.roundNumber === currentRoundNumber &&
                pairing.matchStatus !== "completed",
            ) ??
            null;
          const boardDetailsHref = physical
            ? `/league-devices?leagueId=${encodeURIComponent(leagueId)}&venueId=${encodeURIComponent(night.venueId ?? "")}&boardId=${encodeURIComponent(physical.id)}`
            : "/league-devices";
          const boardPrimaryHref = currentPairing?.matchSessionId
            ? `/league-match/${encodeURIComponent(currentPairing.matchSessionId)}`
            : boardDetailsHref;
          const deviceDetailsHref = scorer
            ? `/league-devices?leagueId=${encodeURIComponent(leagueId)}&venueId=${encodeURIComponent(night.venueId ?? "")}&deviceId=${encodeURIComponent(scorer.id)}`
            : boardDetailsHref;

          return (
            <article
              key={nightBoard.id}
              className={`rounded-2xl border p-4 ${
                !physical || physical.status !== "active"
                  ? "border-red-500/50 bg-red-500/10"
                  : health.tone === "green"
                    ? "border-[var(--color-panel-border)] bg-[var(--color-panel-soft)]"
                    : "border-amber-500/40 bg-amber-500/10"
              }`}
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <Link href={boardPrimaryHref} className="group inline-flex items-center gap-2 text-lg font-black hover:text-[var(--color-primary)]">
                    {physical?.name ?? nightBoard.name}
                    <span aria-hidden="true" className="transition group-hover:translate-x-1">→</span>
                  </Link>
                  <div className="mt-1 text-xs text-[var(--color-text-muted)]">
                    {physical ? `Physical Board ${physical.boardNumber}` : "Physical board mapping missing"}
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Link href={boardDetailsHref} className={`rounded-full border px-2.5 py-1 text-xs font-black transition hover:ring-2 ${
                    physical?.status === "active" ? toneClasses("green") : toneClasses("red")
                  }`}>
                    {physical?.status === "active" ? "Board available" : "Board out of service"}
                  </Link>
                  <Link href={deviceDetailsHref} className={`rounded-full border px-2.5 py-1 text-xs font-black transition hover:ring-2 ${toneClasses(health.tone)}`}>
                    {scorer ? `${scorer.name} · ${health.label}` : health.label}
                  </Link>
                </div>
              </div>

              {otherUsages.length > 0 && (
                <div className="mt-3 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-xs">
                  {otherUsages.map((usage) => (
                    <div key={`${usage.gameNightId}:${usage.physicalBoardId}`}>
                      Also allocated to <strong>{usage.gameNightName}</strong> · {usage.gameNightStatus} · {formatScheduledAt(usage.scheduledAt)}
                    </div>
                  ))}
                </div>
              )}

              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <label>
                  <span className="mb-1 block text-xs font-black">Scoring device</span>
                  <select
                    value={scorer?.id ?? ""}
                    disabled={!physical || workingKey === deviceKey}
                    onChange={(event) => physical && void assignScorer(physical, event.target.value)}
                    className="w-full rounded-xl border border-[var(--color-panel-border)] bg-[var(--color-panel)] p-3 disabled:opacity-50"
                  >
                    <option value="">No scorer assigned</option>
                    {devices.map((device) => (
                      <option key={device.id} value={device.id} disabled={device.status === "disabled"}>
                        {device.name}
                        {device.status === "disabled"
                          ? " — disabled"
                          : device.physicalBoardId && device.physicalBoardId !== physical?.id
                            ? ` — move from ${device.boardName ?? "another board"}`
                            : device.physicalBoardId
                              ? " — current"
                              : " — spare"}
                      </option>
                    ))}
                  </select>
                </label>

                <div>
                  <label>
                    <span className="mb-1 block text-xs font-black">Move match to physical board</span>
                    <select
                      value={moveTargets[nightBoard.id] ?? ""}
                      disabled={workingKey === moveKey}
                      onChange={(event) =>
                        setMoveTargets((current) => ({ ...current, [nightBoard.id]: event.target.value }))
                      }
                      className="w-full rounded-xl border border-[var(--color-panel-border)] bg-[var(--color-panel)] p-3 disabled:opacity-50"
                    >
                      <option value="">Choose destination…</option>
                      {relocationCandidates.map((candidate) => {
                        const candidateUsages = usages.filter(
                          (usage) => usage.physicalBoardId === candidate.id,
                        );
                        const activeConflict = candidateUsages.find(
                          (usage) => usage.gameNightStatus === "active",
                        );
                        const plannedUsage = candidateUsages[0];
                        return (
                          <option key={candidate.id} value={candidate.id} disabled={Boolean(activeConflict)}>
                            {candidate.name}
                            {activeConflict
                              ? ` — IN USE by ${activeConflict.gameNightName}`
                              : plannedUsage
                                ? ` — also planned for ${plannedUsage.gameNightName}`
                                : " — available"}
                          </option>
                        );
                      })}
                    </select>
                  </label>
                  <button
                    type="button"
                    disabled={!moveTargets[nightBoard.id] || workingKey === moveKey}
                    onClick={() => void relocateBoard(nightBoard.id)}
                    className="mt-2 min-h-11 w-full rounded-xl border border-[var(--color-primary)] px-4 py-2 text-sm font-black text-[var(--color-primary)] disabled:opacity-40"
                  >
                    {workingKey === moveKey ? "Moving…" : "Move Match"}
                  </button>
                </div>
              </div>

              {(!physical || physical.status !== "active") && (
                <p className="mt-3 text-sm font-bold text-red-100">
                  This physical board cannot continue hosting play. Choose another available board above. The current match and score history will be preserved.
                </p>
              )}
              {physical && scorer && health.tone !== "green" && (
                <p className="mt-3 text-sm text-amber-100">
                  The board is still valid, but its scorer is not currently healthy. Select a spare scorer; no fixture or match move is required.
                </p>
              )}
            </article>
          );
        })}
      </div>
    </section>
  );
}
