"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { GameNightBoardOperationsPanel } from "@/components/GameNightBoardOperationsPanel";
import { GameNightReadinessPanel } from "@/components/GameNightReadinessPanel";
import { authClient } from "@/lib/auth/client";
import type { GameNightSummary } from "@/lib/league/gameNightContracts";
import { useGameNightWorkspace } from "@/lib/league/useGameNightWorkspace";

function formatDate(value: number) {
  return new Intl.DateTimeFormat(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

function niceStatus(value: string) {
  return value
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export default function GameNightControlPage() {
  const { data: session, isPending } = authClient.useSession();
  const workspace = useGameNightWorkspace(Boolean(session?.user));
  const [working, setWorking] = useState(false);
  const nightStatus = workspace.night?.status;
  const refreshNight = workspace.refreshNight;

  useEffect(() => {
    if (nightStatus !== "active") return;
    const timer = window.setInterval(() => void refreshNight(), 5000);
    return () => window.clearInterval(timer);
  }, [nightStatus, refreshNight]);

  async function changeStatus(status: "active" | "completed") {
    if (!workspace.night) return;
    setWorking(true);
    workspace.setErrorMessage("");
    try {
      const response = await fetch("/api/leagues/game-nights", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "status",
          gameNightId: workspace.night.id,
          status,
        }),
      });
      const result = (await response.json()) as {
        gameNight?: GameNightSummary;
        error?: string;
      };
      if (!response.ok || !result.gameNight) {
        throw new Error(result.error ?? "Game Night update failed.");
      }
      workspace.applyNight(result.gameNight);
    } catch (error) {
      workspace.setErrorMessage(
        error instanceof Error ? error.message : "Game Night update failed.",
      );
    } finally {
      setWorking(false);
    }
  }

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
        <h1 className="text-3xl font-black">Game Night Control</h1>
        <p className="mt-2 text-[var(--color-text-muted)]">
          Sign in to open the coordinator Control Room.
        </p>
      </main>
    );
  }

  const night = workspace.night;
  if (!night) {
    return (
      <main className="mx-auto max-w-6xl p-4 sm:p-6">
        <h1 className="text-3xl font-black">Game Night Control</h1>
        {workspace.errorMessage ? (
          <div className="mt-5 rounded-xl border border-amber-500/40 bg-amber-500/10 p-4">
            {workspace.errorMessage}
          </div>
        ) : (
          <p className="mt-3 text-[var(--color-text-muted)]">
            No current Game Night is selected.
          </p>
        )}
        <Link
          href="/game-nights"
          className="mt-5 inline-flex rounded-xl bg-[var(--color-primary)] px-4 py-3 font-black text-white"
        >
          Choose a Game Night
        </Link>
      </main>
    );
  }

  const prePlay = ["draft", "checkin", "ready"].includes(night.status);
  const roundNumber = night.activeRoundNumber ?? night.currentRoundNumber ?? 1;
  const round =
    night.rounds?.find((item) => item.status === "active") ??
    night.rounds?.find((item) => item.roundNumber === roundNumber);
  const pairings =
    round?.pairings ??
    night.pairings.filter((item) => item.roundNumber === roundNumber);
  const completed = pairings.filter((item) => item.matchStatus === "completed").length;
  const live = pairings.filter((item) => item.matchStatus === "active").length;
  const waiting = Math.max(0, pairings.length - completed - live);

  return (
    <main className="min-h-screen bg-[var(--color-app-bg)] p-4 text-[var(--color-text-main)] sm:p-6">
      <div className="mx-auto max-w-6xl space-y-5">
        <header className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="text-xs font-black uppercase tracking-[0.14em] text-[var(--color-primary)]">
              Control Room · {niceStatus(night.status)}
            </div>
            <h1 className="mt-1 text-3xl font-black">{night.name}</h1>
            <p className="mt-1 text-sm text-[var(--color-text-muted)]">
              {workspace.league?.name} · {night.seasonName} · {formatDate(night.scheduledAt)}
            </p>
            {night.venueName && (
              <p className="mt-1 text-sm font-bold text-[var(--color-text-muted)]">
                {night.venueName}
              </p>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void refreshNight()}
              className="rounded-xl border border-[var(--color-panel-border)] px-3 py-2 text-sm font-black"
            >
              Refresh
            </button>
            <Link
              href="/game-nights"
              className="rounded-xl border border-[var(--color-panel-border)] px-3 py-2 text-sm font-black"
            >
              Switch Night
            </Link>
          </div>
        </header>

        {workspace.errorMessage && (
          <div className="rounded-xl border border-red-500/40 bg-red-500/10 p-4 text-sm">
            {workspace.errorMessage}
          </div>
        )}

        {prePlay ? (
          <GameNightReadinessPanel
            night={night}
            working={working}
            onStart={() => void changeStatus("active")}
          />
        ) : night.status === "active" ? (
          <>
            <section className="rounded-3xl border border-[var(--color-primary)]/50 bg-[var(--color-panel)] p-5 sm:p-6">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <div className="text-xs font-black uppercase tracking-[0.14em] text-[var(--color-primary)]">
                    Live now
                  </div>
                  <h2 className="mt-2 text-3xl font-black">Round {roundNumber}</h2>
                  <div className="mt-3 flex flex-wrap gap-2 text-sm">
                    <span className="rounded-lg bg-[var(--color-panel-soft)] px-3 py-2 font-black">
                      {live} playing
                    </span>
                    <span className="rounded-lg bg-[var(--color-panel-soft)] px-3 py-2 font-black">
                      {waiting} waiting
                    </span>
                    <span className="rounded-lg bg-[var(--color-panel-soft)] px-3 py-2 font-black">
                      {completed} complete
                    </span>
                  </div>
                </div>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <Link
                    href="/game-nights/fixtures"
                    className="inline-flex min-h-12 items-center justify-center rounded-xl bg-[var(--color-primary)] px-6 py-3 text-center font-black text-white"
                  >
                    Round Control →
                  </Link>
                  <Link
                    href="/game-nights/stats"
                    className="inline-flex min-h-12 items-center justify-center rounded-xl border border-[var(--color-panel-border)] px-4 py-3 text-center font-black"
                  >
                    Live Stats
                  </Link>
                </div>
              </div>
            </section>

            <GameNightBoardOperationsPanel
              leagueId={workspace.leagueId}
              night={night}
              onNightChange={workspace.applyNight}
            />

            <section>
              <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
                <div>
                  <h2 className="text-xl font-black">Current matches</h2>
                  <p className="text-sm text-[var(--color-text-muted)]">
                    Match state at a glance. Hardware problems are handled above.
                  </p>
                </div>
                <span className="text-sm font-black text-[var(--color-text-muted)]">
                  {pairings.length} match{pairings.length === 1 ? "" : "es"}
                </span>
              </div>

              <div className="grid gap-3 lg:grid-cols-2">
                {pairings.map((pairing) => {
                  const board = night.boards.find((item) => item.id === pairing.boardId);
                  const teamA = night.teams.find((team) => team.id === pairing.teamAId);
                  const teamB = night.teams.find((team) => team.id === pairing.teamBId);
                  const status = pairing.matchStatus ?? pairing.status;
                  return (
                    <article
                      key={pairing.id}
                      className="rounded-2xl border border-[var(--color-panel-border)] bg-[var(--color-panel)] p-5"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <h3 className="font-black">
                          {board?.name ?? `Board ${pairing.boardNumber}`}
                        </h3>
                        <span className="rounded-full bg-[var(--color-panel-soft)] px-3 py-1 text-xs font-black uppercase">
                          {niceStatus(status)}
                        </span>
                      </div>
                      <div className="mt-4 grid grid-cols-[1fr_auto_1fr] items-center gap-3 text-center">
                        <div className="font-black">{teamA?.name ?? "Team A"}</div>
                        <div className="text-xs font-black uppercase text-[var(--color-text-muted)]">vs</div>
                        <div className="font-black">{teamB?.name ?? "Team B"}</div>
                      </div>
                      {pairing.matchSessionId && (
                        <Link
                          href={`/league-match/${pairing.matchSessionId}`}
                          className="mt-4 inline-flex rounded-xl border border-[var(--color-panel-border)] px-4 py-2.5 text-sm font-black"
                        >
                          {pairing.matchStatus === "completed" ? "Review Match" : "View Match"} →
                        </Link>
                      )}
                    </article>
                  );
                })}
              </div>
            </section>

            <details className="rounded-2xl border border-[var(--color-panel-border)] bg-[var(--color-panel)] p-4">
              <summary className="cursor-pointer text-sm font-black">Finish / close night</summary>
              <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                <p className="max-w-2xl text-sm text-[var(--color-text-muted)]">
                  Complete the Game Night only after the configured final round and every match are complete. The server rejects an early close.
                </p>
                <button
                  disabled={working}
                  onClick={() => void changeStatus("completed")}
                  className="rounded-xl border border-[var(--color-panel-border)] px-4 py-2.5 font-black disabled:opacity-50"
                >
                  Complete Game Night
                </button>
              </div>
            </details>
          </>
        ) : (
          <section className="rounded-3xl border border-[var(--color-panel-border)] bg-[var(--color-panel)] p-6">
            <div className="text-xs font-black uppercase tracking-wide text-[var(--color-text-muted)]">
              Game Night complete
            </div>
            <h2 className="mt-1 text-2xl font-black">{night.name}</h2>
            <p className="mt-2 max-w-2xl text-[var(--color-text-muted)]">
              The operational work is finished. Review final fixtures or statistics, or choose another Game Night.
            </p>
            <div className="mt-5 flex flex-wrap gap-3">
              <Link href="/game-nights/fixtures" className="rounded-xl bg-[var(--color-primary)] px-4 py-2.5 font-black text-white">
                Review Results
              </Link>
              <Link href="/game-nights/stats" className="rounded-xl border border-[var(--color-panel-border)] px-4 py-2.5 font-black">
                Final Stats
              </Link>
              <Link href="/game-nights" className="rounded-xl border border-[var(--color-panel-border)] px-4 py-2.5 font-black">
                Choose Another Night
              </Link>
            </div>
          </section>
        )}
      </div>
    </main>
  );
}
