"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";

import { GameNightScheduleButton } from "@/components/GameNightScheduleButton";
import { GameNightWorkspacePicker } from "@/components/GameNightWorkspacePicker";
import { authClient } from "@/lib/auth/client";
import { DEFAULT_GAME_NIGHT_SETTINGS } from "@/lib/league/gameNightContracts";
import { useGameNightWorkspace } from "@/lib/league/useGameNightWorkspace";

function formatScheduledAt(value: number) {
  return new Intl.DateTimeFormat(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
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

export default function GameNightsPage() {
  const { data: session, isPending: isSessionPending } = authClient.useSession();
  const workspace = useGameNightWorkspace(Boolean(session?.user));
  const [newNightName, setNewNightName] = useState("League Night");
  const [newNightSeasonId, setNewNightSeasonId] = useState("");
  const [newNightDate, setNewNightDate] = useState("");
  const [working, setWorking] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");

  useEffect(() => {
    if (!workspace.league) {
      setNewNightSeasonId("");
      return;
    }
    setNewNightSeasonId((current) =>
      current && workspace.league?.seasons.some((season) => season.id === current)
        ? current
        : workspace.league?.seasons[0]?.id ?? "",
    );
  }, [workspace.league]);

  const checkedInCount =
    workspace.night?.attendance.filter((player) => player.status === "checked_in")
      .length ?? 0;
  const duesPending =
    workspace.night?.attendance.filter(
      (player) => player.status === "checked_in" && player.duesStatus === "unpaid",
    ).length ?? 0;
  const fixtureCount = useMemo(() => {
    if (!workspace.night) return 0;
    return (
      workspace.night.rounds?.reduce(
        (sum, round) => sum + round.pairings.length,
        0,
      ) ?? workspace.night.pairings.length
    );
  }, [workspace.night]);

  async function createGameNight(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!workspace.leagueId || !newNightSeasonId || !newNightDate) return;

    setWorking(true);
    workspace.setErrorMessage("");
    setStatusMessage("");
    try {
      const response = await fetch("/api/leagues/game-nights", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          leagueId: workspace.leagueId,
          seasonId: newNightSeasonId,
          name: newNightName,
          scheduledAt: new Date(newNightDate).getTime(),
          settings: DEFAULT_GAME_NIGHT_SETTINGS,
        }),
      });
      const result = (await response.json()) as {
        gameNight?: NonNullable<typeof workspace.night>;
        error?: string;
      };
      if (!response.ok || !result.gameNight) {
        throw new Error(result.error ?? "Game Night could not be created.");
      }

      workspace.applyNight(result.gameNight);
      setStatusMessage(
        "Game Night created. Open Setup & Rules or begin Player Check-in.",
      );
      setNewNightDate("");
    } catch (error) {
      workspace.setErrorMessage(
        error instanceof Error
          ? error.message
          : "Game Night could not be created.",
      );
    } finally {
      setWorking(false);
    }
  }

  if (isSessionPending) {
    return (
      <main className="mx-auto max-w-7xl p-6 text-[var(--color-text-muted)]">
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
          <h1 className="text-3xl font-black">Game Nights</h1>
          <p className="mt-2 text-[var(--color-text-muted)]">
            Sign in through Connected Storage before managing league Game Nights.
          </p>
        </section>
      </main>
    );
  }

  const night = workspace.night;
  const managementCards = night
    ? [
        {
          title: "Setup & Rules",
          value: `${night.settings.startingScore} · Best of ${night.settings.legsPerMatch}`,
          note: `${niceStatus(night.settings.teamCreationMode)} teams · ${night.settings.roundCount} round${night.settings.roundCount === 1 ? "" : "s"}`,
          href: "/game-nights/setup",
          ready: true,
        },
        {
          title: "Player Check-in",
          value: `${checkedInCount} / ${night.attendance.length} checked in`,
          note: duesPending
            ? `${duesPending} checked-in player${duesPending === 1 ? " has" : "s have"} dues pending`
            : "Attendance and dues are clear",
          href: "/game-nights/check-in",
          ready: checkedInCount >= 2,
        },
        {
          title: "Teams",
          value: `${night.teams.length} team${night.teams.length === 1 ? "" : "s"}`,
          note:
            night.teams.length >= 2
              ? "Team assignments are ready"
              : "Prepare teams after check-in",
          href: "/game-nights/teams",
          ready: night.teams.length >= 2,
        },
        {
          title: "Boards",
          value: `${night.boards.length} physical board${night.boards.length === 1 ? "" : "s"}`,
          note:
            night.boards.length > 0
              ? "Board layout is available"
              : "Board layout still needs setup",
          href: "/game-nights/boards",
          ready: night.boards.length > 0,
        },
        {
          title: "Fixtures & Rounds",
          value: `${fixtureCount} match${fixtureCount === 1 ? "" : "es"}`,
          note:
            fixtureCount > 0
              ? `${night.rounds?.length ?? 1} round${(night.rounds?.length ?? 1) === 1 ? "" : "s"} generated`
              : "Generate Round 1 when teams are ready",
          href: "/game-nights/fixtures",
          ready: fixtureCount > 0,
        },
        {
          title: "Stats",
          value: night.status === "active" ? "Live highlights" : "Night statistics",
          note: "180s, high turns, 100+, 140+, doubles and checkouts",
          href: "/game-nights/stats",
          ready: true,
        },
      ]
    : [];

  return (
    <main className="min-h-screen bg-[var(--color-app-bg)] p-4 text-[var(--color-text-main)] sm:p-6">
      <div className="mx-auto max-w-7xl space-y-5">
        <header className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="text-xs font-black uppercase tracking-[0.14em] text-[var(--color-primary)]">
              League workspace
            </div>
            <h1 className="mt-1 text-3xl font-black">Game Nights</h1>
            <p className="mt-1 max-w-3xl text-sm text-[var(--color-text-muted)]">
              Choose the night here, then use the focused sections above for
              setup, check-in, teams, boards, rounds, and stats.
            </p>
          </div>
          {night && (
            <Link
              href="/game-nights/control"
              className="rounded-xl bg-[var(--color-primary)] px-4 py-2.5 text-sm font-black text-white"
            >
              Open Control Room →
            </Link>
          )}
        </header>

        {workspace.errorMessage && (
          <div className="rounded-xl border border-red-500/40 bg-red-500/10 p-4 text-sm text-red-100">
            {workspace.errorMessage}
          </div>
        )}
        {statusMessage && !workspace.errorMessage && (
          <div className="rounded-xl border border-emerald-500/40 bg-emerald-500/10 p-4 text-sm text-emerald-100">
            {statusMessage}
          </div>
        )}

        <GameNightWorkspacePicker
          leagues={workspace.leagues}
          leagueId={workspace.leagueId}
          nights={workspace.nights}
          nightId={workspace.nightId}
          onLeagueChange={(leagueId) => {
            workspace.selectLeague(leagueId);
            setStatusMessage("");
          }}
          onNightChange={(nightId) => {
            workspace.selectNight(nightId);
            setStatusMessage("");
          }}
        />

        {workspace.league && (
          <details className="rounded-2xl border border-[var(--color-panel-border)] bg-[var(--color-panel)] p-5">
            <summary className="cursor-pointer font-black">
              + Schedule a new Game Night
            </summary>
            <form
              onSubmit={createGameNight}
              className="mt-4 grid gap-3 md:grid-cols-4"
            >
              <input
                value={newNightName}
                onChange={(event) => setNewNightName(event.target.value)}
                maxLength={80}
                required
                className="rounded-xl border border-[var(--color-panel-border)] bg-[var(--color-panel-soft)] px-3 py-3"
                placeholder="League Night"
              />
              <select
                value={newNightSeasonId}
                onChange={(event) => setNewNightSeasonId(event.target.value)}
                required
                className="rounded-xl border border-[var(--color-panel-border)] bg-[var(--color-panel-soft)] px-3 py-3"
              >
                <option value="">Season</option>
                {workspace.league.seasons.map((season) => (
                  <option key={season.id} value={season.id}>
                    {season.name}
                  </option>
                ))}
              </select>
              <input
                type="datetime-local"
                value={newNightDate}
                onChange={(event) => setNewNightDate(event.target.value)}
                required
                className="rounded-xl border border-[var(--color-panel-border)] bg-[var(--color-panel-soft)] px-3 py-3"
              />
              <button
                disabled={working}
                className="rounded-xl bg-[var(--color-primary)] px-4 py-3 font-black text-white disabled:opacity-50"
              >
                Create Game Night
              </button>
            </form>
          </details>
        )}

        {night ? (
          <>
            <section className="rounded-2xl border border-[var(--color-panel-border)] bg-[var(--color-panel)] p-5">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <div className="text-xs font-black uppercase tracking-wide text-[var(--color-primary)]">
                    {niceStatus(night.status)}
                  </div>
                  <h2 className="mt-1 text-2xl font-black">{night.name}</h2>
                  <p className="mt-1 text-sm text-[var(--color-text-muted)]">
                    {workspace.league?.name} · {night.seasonName} · {formatScheduledAt(night.scheduledAt)}
                  </p>
                </div>
                <GameNightScheduleButton gameNight={night} />
              </div>
            </section>

            <section>
              <div className="mb-3">
                <h2 className="text-xl font-black">Manage this Game Night</h2>
                <p className="text-sm text-[var(--color-text-muted)]">
                  Each card opens a focused workspace instead of expanding another
                  section on this page.
                </p>
              </div>
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {managementCards.map((card) => (
                  <Link
                    key={card.title}
                    href={card.href}
                    className="rounded-2xl border border-[var(--color-panel-border)] bg-[var(--color-panel)] p-5 hover:border-[var(--color-primary)]"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <h3 className="font-black">{card.title}</h3>
                      <span
                        className={
                          card.ready ? "text-emerald-300" : "text-amber-300"
                        }
                        aria-label={card.ready ? "Ready" : "Needs attention"}
                      >
                        {card.ready ? "✓" : "!"}
                      </span>
                    </div>
                    <div className="mt-3 text-lg font-black">{card.value}</div>
                    <p className="mt-1 text-sm text-[var(--color-text-muted)]">
                      {card.note}
                    </p>
                    <div className="mt-4 text-sm font-black text-[var(--color-primary)]">
                      Open {card.title} →
                    </div>
                  </Link>
                ))}
              </div>
            </section>

            <section className="rounded-2xl border border-[var(--color-panel-border)] bg-[var(--color-panel)] p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-lg font-black">Scheduled Nights</h2>
                  <p className="text-sm text-[var(--color-text-muted)]">
                    Switch nights without leaving the Game Night workspace.
                  </p>
                </div>
                {workspace.loading && (
                  <span className="text-sm text-[var(--color-text-muted)]">
                    Refreshing…
                  </span>
                )}
              </div>
              <div className="mt-4 grid gap-2 md:grid-cols-2 xl:grid-cols-3">
                {workspace.nights.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => workspace.selectNight(item.id)}
                    className={`rounded-xl border p-3 text-left ${
                      item.id === workspace.nightId
                        ? "border-[var(--color-primary)] bg-[var(--color-panel-soft)]"
                        : "border-[var(--color-panel-border)]"
                    }`}
                  >
                    <div className="font-black">{item.name}</div>
                    <div className="mt-1 text-xs text-[var(--color-text-muted)]">
                      {item.seasonName} · {formatScheduledAt(item.scheduledAt)}
                    </div>
                    <div className="mt-2 text-xs font-black uppercase tracking-wide">
                      {niceStatus(item.status)}
                    </div>
                  </button>
                ))}
              </div>
            </section>
          </>
        ) : workspace.league && !workspace.loading ? (
          <section className="rounded-2xl border border-dashed border-[var(--color-panel-border)] bg-[var(--color-panel)] p-6">
            <h2 className="text-xl font-black">No Game Night selected</h2>
            <p className="mt-2 text-sm text-[var(--color-text-muted)]">
              Schedule a Game Night above to begin.
            </p>
          </section>
        ) : null}
      </div>
    </main>
  );
}
