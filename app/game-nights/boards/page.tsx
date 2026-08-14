"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

import { GameNightWorkspacePicker } from "@/components/GameNightWorkspacePicker";
import { authClient } from "@/lib/auth/client";
import type { BoardDeviceSummary } from "@/lib/league/boardDeviceContracts";
import { useGameNightWorkspace } from "@/lib/league/useGameNightWorkspace";

function lastSeenLabel(value: number | null) {
  if (!value) return "Never seen";
  return `Last seen ${new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value))}`;
}

export default function GameNightBoardsPage() {
  const { data: session, isPending } = authClient.useSession();
  const workspace = useGameNightWorkspace(Boolean(session?.user));
  const [devices, setDevices] = useState<BoardDeviceSummary[]>([]);
  const [deviceError, setDeviceError] = useState("");

  const loadDevices = useCallback(async (leagueId: string) => {
    if (!leagueId) {
      setDevices([]);
      return;
    }
    try {
      const response = await fetch(
        `/api/leagues/board-devices?leagueId=${encodeURIComponent(leagueId)}`,
        { cache: "no-store" },
      );
      const result = (await response.json()) as {
        devices?: BoardDeviceSummary[];
        error?: string;
      };
      if (!response.ok || !result.devices) {
        throw new Error(result.error ?? "Could not load registered board devices.");
      }
      setDevices(result.devices);
      setDeviceError("");
    } catch (error) {
      setDeviceError(
        error instanceof Error
          ? error.message
          : "Could not load registered board devices.",
      );
    }
  }, []);

  useEffect(() => {
    if (!workspace.leagueId) return;
    const timer = window.setTimeout(
      () => void loadDevices(workspace.leagueId),
      0,
    );
    return () => window.clearTimeout(timer);
  }, [loadDevices, workspace.leagueId]);

  const currentRoundNumber =
    workspace.night?.activeRoundNumber ?? workspace.night?.currentRoundNumber ?? 1;
  const currentPairings = useMemo(() => {
    if (!workspace.night) return [];
    const round = workspace.night.rounds?.find(
      (item) => item.roundNumber === currentRoundNumber,
    );
    return (
      round?.pairings ??
      workspace.night.pairings.filter(
        (pairing) => pairing.roundNumber === currentRoundNumber,
      )
    );
  }, [currentRoundNumber, workspace.night]);

  if (isPending) {
    return (
      <main className="mx-auto max-w-6xl p-6 text-[var(--color-text-muted)]">
        Loading account…
      </main>
    );
  }

  if (!session?.user) {
    return (
      <main className="mx-auto max-w-3xl p-6">
        <h1 className="text-3xl font-black">Boards</h1>
        <p className="mt-2 text-[var(--color-text-muted)]">
          Sign in before reviewing league board assignments.
        </p>
      </main>
    );
  }

  const night = workspace.night;

  return (
    <main className="min-h-screen bg-[var(--color-app-bg)] p-4 text-[var(--color-text-main)] sm:p-6">
      <div className="mx-auto max-w-6xl space-y-5">
        <header className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="text-xs font-black uppercase tracking-[0.14em] text-[var(--color-primary)]">
              Game Night
            </div>
            <h1 className="mt-1 text-3xl font-black">Boards</h1>
            <p className="mt-1 max-w-3xl text-sm text-[var(--color-text-muted)]">
              Compare the Game Night&apos;s physical board layout with persistent
              registered scoring devices and the currently assigned fixtures.
            </p>
          </div>
          <Link
            href="/league-devices"
            className="rounded-xl border border-[var(--color-panel-border)] bg-[var(--color-panel)] px-4 py-2.5 text-sm font-black"
          >
            Manage Registered Devices
          </Link>
        </header>

        {workspace.errorMessage && (
          <div className="rounded-xl border border-red-500/40 bg-red-500/10 p-4 text-sm text-red-100">
            {workspace.errorMessage}
          </div>
        )}
        {deviceError && (
          <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-4 text-sm">
            {deviceError}
          </div>
        )}

        <GameNightWorkspacePicker
          leagues={workspace.leagues}
          leagueId={workspace.leagueId}
          nights={workspace.nights}
          nightId={workspace.nightId}
          onLeagueChange={workspace.selectLeague}
          onNightChange={workspace.selectNight}
        />

        {night ? (
          <>
            <section className="rounded-2xl border border-[var(--color-panel-border)] bg-[var(--color-panel)] p-5">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <div className="text-xs font-black uppercase tracking-wide text-[var(--color-primary)]">
                    Round {currentRoundNumber}
                  </div>
                  <h2 className="mt-1 text-2xl font-black">{night.name}</h2>
                  <p className="mt-1 text-sm text-[var(--color-text-muted)]">
                    {night.boards.length} configured board{night.boards.length === 1 ? "" : "s"} · {devices.filter((device) => device.status === "active").length} active registered device{devices.filter((device) => device.status === "active").length === 1 ? "" : "s"}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => void loadDevices(workspace.leagueId)}
                  className="rounded-xl border border-[var(--color-panel-border)] px-4 py-2.5 text-sm font-black"
                >
                  Refresh Devices
                </button>
              </div>
            </section>

            {night.boards.length ? (
              <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {night.boards.map((board) => {
                  const device = devices.find(
                    (item) => item.boardNumber === board.boardNumber,
                  );
                  const pairing = currentPairings.find(
                    (item) => item.boardId === board.id,
                  );
                  const teamA = night.teams.find(
                    (team) => team.id === pairing?.teamAId,
                  );
                  const teamB = night.teams.find(
                    (team) => team.id === pairing?.teamBId,
                  );

                  return (
                    <article
                      key={board.id}
                      className="rounded-2xl border border-[var(--color-panel-border)] bg-[var(--color-panel)] p-5"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="text-xs font-black uppercase tracking-wide text-[var(--color-text-muted)]">
                            Physical Board {board.boardNumber}
                          </div>
                          <h3 className="mt-1 text-xl font-black">{board.name}</h3>
                        </div>
                        <span
                          className={`rounded-full border px-2.5 py-1 text-[10px] font-black uppercase ${
                            device?.status === "active"
                              ? "border-emerald-500/40 text-emerald-200"
                              : "border-amber-500/40 text-amber-200"
                          }`}
                        >
                          {device?.status === "active"
                            ? "Device ready"
                            : device
                              ? "Device disabled"
                              : "No device"}
                        </span>
                      </div>

                      <div className="mt-4 rounded-xl bg-[var(--color-panel-soft)] p-3 text-sm">
                        <div className="font-black">
                          {device?.name ?? "No registered scorer"}
                        </div>
                        <div className="mt-1 text-xs text-[var(--color-text-muted)]">
                          {device ? lastSeenLabel(device.lastSeenAt) : "Register or assign a persistent device for this board number."}
                        </div>
                      </div>

                      <div className="mt-4 border-t border-[var(--color-panel-border)] pt-4">
                        <div className="text-xs font-black uppercase tracking-wide text-[var(--color-text-muted)]">
                          Current assignment
                        </div>
                        {pairing ? (
                          <>
                            <div className="mt-2 text-center font-black">
                              {teamA?.name ?? "Team A"}
                              <span className="mx-2 font-normal text-[var(--color-text-muted)]">vs</span>
                              {teamB?.name ?? "Team B"}
                            </div>
                            <div className="mt-2 text-center text-xs font-black uppercase text-[var(--color-text-muted)]">
                              {pairing.matchStatus ?? pairing.status}
                            </div>
                            {pairing.matchSessionId && (
                              <Link
                                href={`/league-match/${pairing.matchSessionId}`}
                                className="mt-3 flex justify-center rounded-xl border border-[var(--color-panel-border)] px-4 py-2.5 text-sm font-black"
                              >
                                {pairing.matchStatus === "completed"
                                  ? "Review Match"
                                  : "View Match"} →
                              </Link>
                            )}
                          </>
                        ) : (
                          <p className="mt-2 text-sm text-[var(--color-text-muted)]">
                            No fixture is assigned to this board in the current round.
                          </p>
                        )}
                      </div>
                    </article>
                  );
                })}
              </section>
            ) : (
              <section className="rounded-2xl border border-dashed border-[var(--color-panel-border)] bg-[var(--color-panel)] p-6">
                <h2 className="text-xl font-black">No physical boards configured</h2>
                <p className="mt-2 text-sm text-[var(--color-text-muted)]">
                  Set the board count in Setup & Rules first.
                </p>
                <Link
                  href="/game-nights/setup"
                  className="mt-4 inline-flex rounded-xl bg-[var(--color-primary)] px-4 py-2.5 font-black text-white"
                >
                  Open Setup & Rules →
                </Link>
              </section>
            )}

            <section className="flex flex-col gap-3 rounded-2xl border border-[var(--color-panel-border)] bg-[var(--color-panel)] p-5 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="text-xs font-black uppercase tracking-wide text-[var(--color-text-muted)]">
                  Next step
                </div>
                <div className="mt-1 font-black">
                  {night.teams.length < 2
                    ? "Prepare teams before generating fixtures"
                    : currentPairings.length
                      ? "Manage the current fixture round"
                      : "Generate Round 1 assignments"}
                </div>
              </div>
              <Link
                href={night.teams.length < 2 ? "/game-nights/teams" : "/game-nights/fixtures"}
                className="rounded-xl bg-[var(--color-primary)] px-5 py-3 text-center font-black text-white"
              >
                {night.teams.length < 2 ? "Open Teams" : "Open Fixtures & Rounds"} →
              </Link>
            </section>
          </>
        ) : !workspace.loading ? (
          <section className="rounded-2xl border border-dashed border-[var(--color-panel-border)] bg-[var(--color-panel)] p-6 text-sm text-[var(--color-text-muted)]">
            Select or create a Game Night from the Hub first.
          </section>
        ) : null}
      </div>
    </main>
  );
}
