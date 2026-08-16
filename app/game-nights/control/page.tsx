"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { GameNightBoardOperationsPanel } from "@/components/GameNightBoardOperationsPanel";
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

  const checkedIn = night.attendance.filter(
    (player) => player.status === "checked_in",
  ).length;
  const duesPending = night.attendance.filter(
    (player) => player.status === "checked_in" && player.duesStatus === "unpaid",
  ).length;
  const teamCount = night.teams.length;
  const boardCount = night.boards.length;
  const fixtureCount =
    night.rounds?.reduce((sum, round) => sum + round.pairings.length, 0) ??
    night.pairings.length;
  const prePlay = ["draft", "checkin", "ready"].includes(night.status);
  const roundNumber = night.activeRoundNumber ?? night.currentRoundNumber ?? 1;
  const round =
    night.rounds?.find((item) => item.status === "active") ??
    night.rounds?.find((item) => item.roundNumber === roundNumber);
  const pairings =
    round?.pairings ??
    night.pairings.filter((item) => item.roundNumber === roundNumber);
  const completed = pairings.filter(
    (item) => item.matchStatus === "completed",
  ).length;
  const live = pairings.filter((item) => item.matchStatus === "active").length;
  const waiting = Math.max(0, pairings.length - completed - live);

  const readinessCards = [
    {
      title: "Rules",
      value: `${night.settings.startingScore} · Best of ${night.settings.legsPerMatch}`,
      note: `${night.settings.roundCount} round${night.settings.roundCount === 1 ? "" : "s"}`,
      href: "/game-nights/setup",
      ok: true,
    },
    {
      title: "Check-in",
      value: `${checkedIn} checked in`,
      note: `${night.attendance.length} on tonight's attendance list`,
      href: "/game-nights/check-in",
      ok: checkedIn >= 2,
    },
    {
      title: "Teams",
      value: `${teamCount} team${teamCount === 1 ? "" : "s"}`,
      note: teamCount >= 2 ? "Ready for matchups" : "Team setup required",
      href: "/game-nights/teams",
      ok: teamCount >= 2,
    },
    {
      title: "Boards",
      value: `${boardCount} board${boardCount === 1 ? "" : "s"}`,
      note: boardCount ? "Physical layout ready" : "Board setup required",
      href: "/game-nights/boards",
      ok: boardCount > 0,
    },
    {
      title: "Fixtures",
      value: `${fixtureCount} match${fixtureCount === 1 ? "" : "es"}`,
      note: fixtureCount ? "Round plan available" : "Round 1 not generated",
      href: "/game-nights/fixtures",
      ok: fixtureCount > 0,
    },
  ];

  const priority =
    checkedIn < 2
      ? {
          title: "Check in the players who are here",
          description:
            "You need at least two checked-in players before this Game Night can move into team preparation.",
          href: "/game-nights/check-in",
          action: "Open Check-in",
        }
      : teamCount < 2
        ? {
            title: "Prepare tonight's teams",
            description:
              "Attendance is ready. Build or generate the teams that will be used for tonight's fixtures.",
            href: "/game-nights/teams",
            action: "Open Teams",
          }
        : boardCount < 1
          ? {
              title: "Configure the physical boards",
              description:
                "Teams are ready. Confirm how many dartboards are available before generating the round schedule.",
              href: "/game-nights/boards",
              action: "Open Boards",
            }
          : fixtureCount < 1
            ? {
                title: "Generate Round 1",
                description:
                  "Players, teams, and boards are ready. Build the first fixture draft and review it before play starts.",
                href: "/game-nights/fixtures",
                action: "Open Fixtures",
              }
            : null;

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
          <>
            <section className="rounded-2xl border border-[var(--color-primary)]/50 bg-[var(--color-panel)] p-5">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <div className="text-xs font-black uppercase tracking-[0.14em] text-[var(--color-primary)]">
                    Current priority
                  </div>
                  <h2 className="mt-2 text-2xl font-black">
                    {priority?.title ?? "Ready to start the Game Night"}
                  </h2>
                  <p className="mt-2 max-w-2xl text-sm text-[var(--color-text-muted)]">
                    {priority?.description ??
                      "Round 1 is prepared. Starting the Game Night releases the current round to its assigned boards."}
                  </p>
                </div>

                {priority ? (
                  <Link
                    href={priority.href}
                    className="inline-flex min-h-12 shrink-0 items-center justify-center rounded-xl bg-[var(--color-primary)] px-6 py-3 text-center font-black text-white"
                  >
                    {priority.action} →
                  </Link>
                ) : (
                  <button
                    disabled={working}
                    onClick={() => void changeStatus("active")}
                    className="min-h-12 shrink-0 rounded-xl bg-emerald-600 px-6 py-3 font-black text-white disabled:opacity-50"
                  >
                    {working ? "Starting…" : "Start Game Night"}
                  </button>
                )}
              </div>
            </section>

            {duesPending > 0 && (
              <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-4 text-sm">
                <strong>
                  {duesPending} checked-in player{duesPending === 1 ? " has" : "s have"} dues pending.
                </strong>{" "}
                Dues do not block play, but they still need attention.
                <Link
                  href="/game-nights/check-in"
                  className="ml-2 font-black text-[var(--color-primary)]"
                >
                  Review check-in →
                </Link>
              </div>
            )}

            <section>
              <div className="mb-3">
                <h2 className="text-xl font-black">Readiness</h2>
                <p className="text-sm text-[var(--color-text-muted)]">
                  These are status summaries. Open only the area that needs a change.
                </p>
              </div>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
                {readinessCards.map((card) => (
                  <Link
                    key={card.title}
                    href={card.href}
                    className="rounded-2xl border border-[var(--color-panel-border)] bg-[var(--color-panel)] p-4 hover:border-[var(--color-primary)]"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <strong>{card.title}</strong>
                      <span
                        className={card.ok ? "text-emerald-300" : "text-amber-300"}
                        aria-label={card.ok ? "Ready" : "Needs attention"}
                      >
                        {card.ok ? "✓" : "!"}
                      </span>
                    </div>
                    <div className="mt-3 text-lg font-black">{card.value}</div>
                    <div className="mt-1 text-xs text-[var(--color-text-muted)]">
                      {card.note}
                    </div>
                  </Link>
                ))}
              </div>
            </section>
          </>
        ) : night.status === "active" ? (
          <>
            <section className="rounded-2xl border border-[var(--color-primary)]/50 bg-[var(--color-panel)] p-5">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <div className="text-xs font-black uppercase tracking-[0.14em] text-[var(--color-primary)]">
                    Live now
                  </div>
                  <h2 className="mt-2 text-2xl font-black">Round {roundNumber}</h2>
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
                    Open Round Control →
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
                  <h2 className="text-xl font-black">Boards</h2>
                  <p className="text-sm text-[var(--color-text-muted)]">
                    Current round status at a glance.
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
                        <div className="text-xs font-black uppercase text-[var(--color-text-muted)]">
                          vs
                        </div>
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
              <summary className="cursor-pointer text-sm font-black">Night actions</summary>
              <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                <p className="max-w-2xl text-sm text-[var(--color-text-muted)]">
                  Complete the Game Night only after the configured final round and
                  every match are complete. The server will reject an early close.
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
          <section className="rounded-2xl border border-[var(--color-panel-border)] bg-[var(--color-panel)] p-6">
            <div className="text-xs font-black uppercase tracking-wide text-[var(--color-text-muted)]">
              Game Night complete
            </div>
            <h2 className="mt-1 text-2xl font-black">{night.name}</h2>
            <p className="mt-2 max-w-2xl text-[var(--color-text-muted)]">
              The operational work is finished. Review final fixtures or statistics,
              or return to the Hub to choose another Game Night.
            </p>
            <div className="mt-5 flex flex-wrap gap-3">
              <Link
                href="/game-nights/fixtures"
                className="rounded-xl bg-[var(--color-primary)] px-4 py-2.5 font-black text-white"
              >
                Review Results
              </Link>
              <Link
                href="/game-nights/stats"
                className="rounded-xl border border-[var(--color-panel-border)] px-4 py-2.5 font-black"
              >
                Final Stats
              </Link>
              <Link
                href="/game-nights"
                className="rounded-xl border border-[var(--color-panel-border)] px-4 py-2.5 font-black"
              >
                Choose Another Night
              </Link>
            </div>
          </section>
        )}
      </div>
    </main>
  );
}
