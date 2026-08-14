"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

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

  useEffect(() => {
    if (workspace.night?.status !== "active") return;
    const timer = window.setInterval(
      () => void workspace.refreshNight(),
      5000,
    );
    return () => window.clearInterval(timer);
  }, [workspace.night?.status, workspace.refreshNight]);

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
          Open Game Night Hub
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

  const cards = [
    {
      title: "Players",
      value: `${checkedIn} / ${night.attendance.length} checked in`,
      note: duesPending ? `${duesPending} dues pending` : "Attendance ready",
      href: "/game-nights/check-in",
      ok: checkedIn >= 2,
    },
    {
      title: "Teams",
      value: `${teamCount} teams`,
      note: teamCount >= 2 ? "Team setup ready" : "Teams need setup",
      href: "/game-nights/teams",
      ok: teamCount >= 2,
    },
    {
      title: "Boards",
      value: `${boardCount} boards`,
      note: boardCount ? "Board layout available" : "Boards need setup",
      href: "/game-nights/boards",
      ok: boardCount > 0,
    },
    {
      title: "Fixtures",
      value: `${fixtureCount} matches`,
      note: night.rounds?.length
        ? `${night.rounds.length} rounds generated`
        : "Fixtures need setup",
      href: "/game-nights/fixtures",
      ok: fixtureCount > 0,
    },
  ];

  return (
    <main className="min-h-screen bg-[var(--color-app-bg)] p-4 text-[var(--color-text-main)] sm:p-6">
      <div className="mx-auto max-w-6xl">
        <header className="mb-5 flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="text-xs font-black uppercase tracking-[0.14em] text-[var(--color-primary)]">
              Game Night · {niceStatus(night.status)}
            </div>
            <h1 className="mt-1 text-3xl font-black">{night.name}</h1>
            <p className="text-sm text-[var(--color-text-muted)]">
              {workspace.league?.name} · {night.seasonName} · {formatDate(night.scheduledAt)}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void workspace.refreshNight()}
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
          <div className="mb-5 rounded-xl border border-red-500/40 bg-red-500/10 p-4 text-sm">
            {workspace.errorMessage}
          </div>
        )}

        {prePlay ? (
          <>
            <div className="mb-3">
              <h2 className="text-xl font-black">Readiness</h2>
              <p className="text-sm text-[var(--color-text-muted)]">
                Summary only. Open a card to make changes in its focused workspace.
              </p>
            </div>
            <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {cards.map((card) => (
                <Link
                  key={card.title}
                  href={card.href}
                  className="rounded-2xl border border-[var(--color-panel-border)] bg-[var(--color-panel)] p-4 hover:border-[var(--color-primary)]"
                >
                  <div className="flex justify-between">
                    <strong>{card.title}</strong>
                    <span className={card.ok ? "text-emerald-300" : "text-amber-300"}>
                      {card.ok ? "✓" : "!"}
                    </span>
                  </div>
                  <div className="mt-3 text-lg font-black">{card.value}</div>
                  <div className="mt-1 text-sm text-[var(--color-text-muted)]">
                    {card.note}
                  </div>
                  <div className="mt-4 text-sm font-black text-[var(--color-primary)]">
                    Open {card.title} →
                  </div>
                </Link>
              ))}
            </section>

            {duesPending > 0 && (
              <div className="mt-4 rounded-xl border border-amber-500/40 bg-amber-500/10 p-4 text-sm">
                <strong>
                  {duesPending} checked-in player{duesPending === 1 ? " has" : "s have"} dues pending.
                </strong>{" "}
                Attendance and payment remain separate.
              </div>
            )}

            <section className="mt-5 flex flex-col gap-3 rounded-2xl border border-[var(--color-panel-border)] bg-[var(--color-panel)] p-5 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="text-xs font-black uppercase tracking-wide text-[var(--color-text-muted)]">
                  Next action
                </div>
                <div className="mt-1 font-black">
                  {checkedIn < 2
                    ? "Check in players"
                    : teamCount < 2
                      ? "Prepare teams"
                      : boardCount < 1
                        ? "Configure boards"
                        : fixtureCount < 1
                          ? "Generate fixtures"
                          : "Start the Game Night"}
                </div>
              </div>
              {checkedIn < 2 ? (
                <Link
                  href="/game-nights/check-in"
                  className="rounded-xl bg-[var(--color-primary)] px-5 py-3 text-center font-black text-white"
                >
                  Open Check-in
                </Link>
              ) : teamCount < 2 ? (
                <Link
                  href="/game-nights/teams"
                  className="rounded-xl bg-[var(--color-primary)] px-5 py-3 text-center font-black text-white"
                >
                  Open Teams
                </Link>
              ) : boardCount < 1 ? (
                <Link
                  href="/game-nights/setup"
                  className="rounded-xl bg-[var(--color-primary)] px-5 py-3 text-center font-black text-white"
                >
                  Open Setup & Rules
                </Link>
              ) : fixtureCount < 1 ? (
                <Link
                  href="/game-nights/fixtures"
                  className="rounded-xl bg-[var(--color-primary)] px-5 py-3 text-center font-black text-white"
                >
                  Open Fixtures
                </Link>
              ) : (
                <button
                  disabled={working}
                  onClick={() => void changeStatus("active")}
                  className="rounded-xl bg-emerald-600 px-5 py-3 font-black text-white disabled:opacity-50"
                >
                  Start Game Night
                </button>
              )}
            </section>
          </>
        ) : night.status === "active" ? (
          <>
            <section className="mb-4">
              <div className="text-xs font-black uppercase tracking-[0.14em] text-[var(--color-primary)]">
                Live room
              </div>
              <h2 className="text-2xl font-black">Round {roundNumber}</h2>
              <p className="text-sm text-[var(--color-text-muted)]">
                {pairings.length} matches · {completed} complete · {live} playing
              </p>
            </section>

            <section className="grid gap-3 lg:grid-cols-2">
              {pairings.map((pairing) => {
                const board = night.boards.find((item) => item.id === pairing.boardId);
                const teamA = night.teams.find((team) => team.id === pairing.teamAId);
                const teamB = night.teams.find((team) => team.id === pairing.teamBId);
                return (
                  <article
                    key={pairing.id}
                    className="rounded-2xl border border-[var(--color-panel-border)] bg-[var(--color-panel)] p-5"
                  >
                    <div className="flex items-center justify-between">
                      <h3 className="font-black">
                        {board?.name ?? `Board ${pairing.boardNumber}`}
                      </h3>
                      <span className="text-xs font-black uppercase">
                        {pairing.matchStatus ?? pairing.status}
                      </span>
                    </div>
                    <div className="mt-4 text-center text-lg font-black">
                      {teamA?.name ?? "Team A"}{" "}
                      <span className="font-normal text-[var(--color-text-muted)]">vs</span>{" "}
                      {teamB?.name ?? "Team B"}
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
            </section>

            <section className="mt-5 flex flex-col gap-3 rounded-2xl border border-[var(--color-panel-border)] bg-[var(--color-panel)] p-5 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="text-xs font-black uppercase tracking-wide text-[var(--color-text-muted)]">
                  Next action
                </div>
                <div className="mt-1 font-black">Continue from Fixture & Round Control</div>
              </div>
              <div className="flex flex-wrap gap-2">
                <Link
                  href="/game-nights/fixtures"
                  className="rounded-xl bg-[var(--color-primary)] px-5 py-3 font-black text-white"
                >
                  Open Round Control
                </Link>
                <Link
                  href="/game-nights/stats"
                  className="rounded-xl border border-[var(--color-panel-border)] px-4 py-3 font-black"
                >
                  Live Stats
                </Link>
                <button
                  disabled={working}
                  onClick={() => void changeStatus("completed")}
                  className="rounded-xl border border-[var(--color-panel-border)] px-4 py-3 font-black"
                >
                  Complete Night
                </button>
              </div>
            </section>
          </>
        ) : (
          <section className="rounded-2xl border border-[var(--color-panel-border)] bg-[var(--color-panel)] p-6">
            <div className="text-xs font-black uppercase tracking-wide text-[var(--color-text-muted)]">
              Game Night complete
            </div>
            <h2 className="mt-1 text-2xl font-black">{night.name}</h2>
            <p className="mt-2 text-[var(--color-text-muted)]">
              Review completed matches, final round results, and night statistics from their dedicated screens.
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
                Game Night Hub
              </Link>
            </div>
          </section>
        )}
      </div>
    </main>
  );
}
