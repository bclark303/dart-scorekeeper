"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

import type { LeagueListResponse, LeagueSummary } from "@/lib/league/contracts";
import type { GameNightListResponse, GameNightSummary } from "@/lib/league/gameNightContracts";

const ACTIVE_LEAGUE_KEY = "dart-scorekeeper:active-league-id";

type AccessState = "checking" | "logged-out" | "logged-in" | "error";

type TaskCardProps = {
  href: string;
  icon: string;
  title: string;
  description: string;
  emphasis?: "normal" | "important";
};

function TaskCard({ href, icon, title, description, emphasis = "normal" }: TaskCardProps) {
  return (
    <Link
      href={href}
      className={`group flex min-h-36 flex-col rounded-2xl border p-5 transition focus:outline-none focus:ring-4 focus:ring-blue-500/30 ${
        emphasis === "important"
          ? "border-blue-500/45 bg-blue-500/10 hover:border-blue-400"
          : "border-[var(--color-panel-border)] bg-[var(--color-panel)] hover:border-[var(--color-primary)]"
      }`}
    >
      <div className="flex items-start gap-3">
        <div aria-hidden="true" className="text-3xl">{icon}</div>
        <div>
          <h3 className="text-lg font-black leading-tight">{title}</h3>
          <p className="mt-2 text-sm leading-6 text-[var(--color-text-muted)]">{description}</p>
        </div>
      </div>
      <div className="mt-auto pt-4 text-sm font-black text-[var(--color-primary)]">
        Open <span aria-hidden="true" className="inline-block transition group-hover:translate-x-1">→</span>
      </div>
    </Link>
  );
}

function formatScheduledAt(value: number) {
  return new Intl.DateTimeFormat(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

function gameNightStatusLabel(status: GameNightSummary["status"]) {
  switch (status) {
    case "draft":
      return "Needs setup";
    case "checkin":
      return "Check-in open";
    case "ready":
      return "Ready to start";
    case "active":
      return "In progress";
    case "completed":
      return "Completed";
    case "cancelled":
      return "Cancelled";
  }
}

export default function LeaguePlayPage() {
  const [access, setAccess] = useState<AccessState>("checking");
  const [leagues, setLeagues] = useState<LeagueSummary[]>([]);
  const [activeLeagueId, setActiveLeagueId] = useState("");
  const [gameNights, setGameNights] = useState<GameNightSummary[]>([]);
  const [gameNightsLoading, setGameNightsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const activeLeague = useMemo(
    () => leagues.find((league) => league.id === activeLeagueId) ?? null,
    [activeLeagueId, leagues],
  );

  const currentNight = useMemo(() => {
    const active = gameNights.find((night) => night.status === "active");
    if (active) return active;

    const unfinished = gameNights
      .filter((night) => !["completed", "cancelled"].includes(night.status))
      .sort((a, b) => {
        const now = Date.now();
        const aFuture = a.scheduledAt >= now;
        const bFuture = b.scheduledAt >= now;
        if (aFuture !== bFuture) return aFuture ? -1 : 1;
        return aFuture ? a.scheduledAt - b.scheduledAt : b.scheduledAt - a.scheduledAt;
      });
    return unfinished[0] ?? null;
  }, [gameNights]);

  const loadWorkspace = useCallback(async () => {
    setErrorMessage("");
    try {
      const response = await fetch("/api/leagues", { cache: "no-store" });
      if (response.status === 401) {
        setAccess("logged-out");
        setLeagues([]);
        return;
      }
      const result = (await response.json()) as LeagueListResponse & { error?: string };
      if (!response.ok) throw new Error(result.error ?? "Could not load leagues.");

      setAccess("logged-in");
      setLeagues(result.leagues);
      const remembered = window.localStorage.getItem(ACTIVE_LEAGUE_KEY);
      const resolved =
        (remembered && result.leagues.some((league) => league.id === remembered) && remembered) ||
        result.leagues[0]?.id ||
        "";
      setActiveLeagueId(resolved);
      if (resolved) window.localStorage.setItem(ACTIVE_LEAGUE_KEY, resolved);
    } catch (error) {
      setAccess("error");
      setErrorMessage(error instanceof Error ? error.message : "Could not load League Admin.");
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => void loadWorkspace(), 0);
    return () => window.clearTimeout(timer);
  }, [loadWorkspace]);

  useEffect(() => {
    if (access !== "logged-in" || !activeLeagueId) {
      setGameNights([]);
      return;
    }

    const controller = new AbortController();
    setGameNightsLoading(true);
    fetch(`/api/leagues/game-nights?leagueId=${encodeURIComponent(activeLeagueId)}`, {
      cache: "no-store",
      signal: controller.signal,
    })
      .then(async (response) => {
        const result = (await response.json()) as GameNightListResponse;
        if (!response.ok) throw new Error(result.error ?? "Could not load Game Nights.");
        return result.gameNights ?? [];
      })
      .then((nights) => {
        if (!controller.signal.aborted) setGameNights(nights);
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        setErrorMessage(error instanceof Error ? error.message : "Could not load Game Nights.");
      })
      .finally(() => {
        if (!controller.signal.aborted) setGameNightsLoading(false);
      });

    return () => controller.abort();
  }, [access, activeLeagueId]);

  function changeActiveLeague(leagueId: string) {
    setActiveLeagueId(leagueId);
    setGameNights([]);
    if (leagueId) window.localStorage.setItem(ACTIVE_LEAGUE_KEY, leagueId);
    else window.localStorage.removeItem(ACTIVE_LEAGUE_KEY);
  }

  const checkedIn = currentNight?.attendance.filter((item) => item.status === "checked_in").length ?? 0;
  const completedMatches = currentNight?.pairings.filter((item) => item.matchStatus === "completed").length ?? 0;
  const totalMatches = currentNight?.pairings.length ?? 0;

  return (
    <main className="min-h-screen bg-[var(--color-app-bg)] p-4 text-[var(--color-text-main)] sm:p-6">
      <div className="mx-auto max-w-6xl">
        <header className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <Link href="/" className="text-sm font-black text-[var(--color-primary)]">← Main Menu</Link>
            <h1 className="mt-2 text-4xl font-black tracking-tight">League Administration</h1>
            <p className="mt-2 max-w-2xl text-base text-[var(--color-text-muted)]">
              Choose what you want to do. You do not need to know where the setting lives.
            </p>
          </div>
          <div className="flex gap-2">
            <Link href="/help?from=league-play" className="min-h-11 rounded-xl border border-[var(--color-panel-border)] bg-[var(--color-panel)] px-4 py-2.5 text-sm font-black">
              Help
            </Link>
            <Link href="/settings" className="min-h-11 rounded-xl border border-[var(--color-panel-border)] bg-[var(--color-panel)] px-4 py-2.5 text-sm font-black">
              Settings
            </Link>
          </div>
        </header>

        {access === "checking" && (
          <section className="rounded-2xl border border-[var(--color-panel-border)] bg-[var(--color-panel)] p-6 text-[var(--color-text-muted)]">
            Opening league administration…
          </section>
        )}

        {access === "logged-out" && (
          <section className="mx-auto max-w-2xl rounded-3xl border border-blue-500/40 bg-[var(--color-panel)] p-7 text-center sm:p-9">
            <div aria-hidden="true" className="text-5xl">🔐</div>
            <h2 className="mt-4 text-3xl font-black">Administrator sign-in</h2>
            <p className="mx-auto mt-3 max-w-lg text-[var(--color-text-muted)]">
              Sign in to manage your league, players, Game Nights, venues, dartboards, and scoring devices.
            </p>
            <Link href="/account" className="mt-6 inline-flex min-h-14 items-center justify-center rounded-2xl bg-blue-600 px-7 py-4 text-lg font-black text-white">
              Sign In →
            </Link>
            <div className="mt-6 border-t border-[var(--color-panel-border)] pt-5 text-sm text-[var(--color-text-muted)]">
              Is this a screen beside a dartboard? <Link href="/board-device" className="font-black text-[var(--color-primary)]">Open the scorer instead →</Link>
            </div>
          </section>
        )}

        {access === "error" && (
          <section className="rounded-2xl border border-red-500/40 bg-red-500/10 p-5">
            <div className="font-black">League Administration could not be loaded.</div>
            <div className="mt-1 text-sm">{errorMessage}</div>
            <button onClick={() => void loadWorkspace()} className="mt-4 min-h-11 rounded-xl bg-[var(--color-primary)] px-5 py-2.5 font-black text-white">Try Again</button>
          </section>
        )}

        {access === "logged-in" && (
          <>
            {!leagues.length ? (
              <section className="rounded-3xl border border-dashed border-[var(--color-panel-border)] bg-[var(--color-panel)] p-8 text-center sm:p-10">
                <div aria-hidden="true" className="text-5xl">🏆</div>
                <h2 className="mt-4 text-3xl font-black">Set up your first league</h2>
                <p className="mx-auto mt-3 max-w-xl text-[var(--color-text-muted)]">
                  Start with the league name and season. We will guide you to players, venue, dartboards, and scoring devices afterward.
                </p>
                <Link href="/leagues" className="mt-6 inline-flex min-h-14 items-center justify-center rounded-2xl bg-[var(--color-primary)] px-7 py-4 text-lg font-black text-white">
                  Start League Setup →
                </Link>
              </section>
            ) : (
              <>
                <section className="mb-6 rounded-2xl border border-[var(--color-panel-border)] bg-[var(--color-panel)] p-4 sm:p-5">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                    <div>
                      <div className="text-xs font-black uppercase tracking-[0.14em] text-[var(--color-text-muted)]">You are managing</div>
                      <div className="mt-1 text-2xl font-black">{activeLeague?.name ?? "League"}</div>
                      {activeLeague?.seasons[0] && <div className="mt-1 text-sm text-[var(--color-text-muted)]">Current season: {activeLeague.seasons[0].name}</div>}
                    </div>
                    {leagues.length > 1 && (
                      <label className="text-sm font-black">
                        Change league
                        <select
                          value={activeLeagueId}
                          onChange={(event) => changeActiveLeague(event.target.value)}
                          className="mt-1 block min-h-12 min-w-64 rounded-xl border border-[var(--color-panel-border)] bg-[var(--color-panel-soft)] px-3 py-2.5 text-base"
                        >
                          {leagues.map((league) => <option key={league.id} value={league.id}>{league.name}</option>)}
                        </select>
                      </label>
                    )}
                  </div>
                </section>

                <section className="mb-8">
                  <div className="mb-3 flex items-end justify-between gap-4">
                    <div>
                      <div className="text-xs font-black uppercase tracking-[0.16em] text-blue-300">Tonight</div>
                      <h2 className="mt-1 text-3xl font-black">Run the league night</h2>
                    </div>
                    <Link href="/game-nights" className="text-sm font-black text-[var(--color-primary)]">All Game Nights →</Link>
                  </div>

                  {gameNightsLoading ? (
                    <div className="rounded-3xl border border-blue-500/35 bg-blue-500/10 p-7 text-[var(--color-text-muted)]">Checking tonight&apos;s schedule…</div>
                  ) : currentNight ? (
                    <Link href="/game-nights/control" className="group block rounded-3xl border border-blue-500/50 bg-blue-500/10 p-6 transition hover:border-blue-400 sm:p-8">
                      <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="rounded-full bg-blue-500/15 px-3 py-1 text-xs font-black uppercase tracking-wide text-blue-200">{gameNightStatusLabel(currentNight.status)}</span>
                            <span className="text-sm text-[var(--color-text-muted)]">{formatScheduledAt(currentNight.scheduledAt)}</span>
                          </div>
                          <h3 className="mt-3 text-3xl font-black">{currentNight.name}</h3>
                          <p className="mt-2 text-[var(--color-text-muted)]">
                            {currentNight.venueName ? `At ${currentNight.venueName}. ` : "Venue not chosen yet. "}
                            Control will tell you what needs attention and what to do next.
                          </p>
                          <div className="mt-5 flex flex-wrap gap-2 text-sm font-bold">
                            <span className="rounded-full bg-[var(--color-panel)] px-3 py-2">{checkedIn} checked in</span>
                            <span className="rounded-full bg-[var(--color-panel)] px-3 py-2">{currentNight.boards.length} {currentNight.boards.length === 1 ? "dartboard" : "dartboards"}</span>
                            {totalMatches > 0 && <span className="rounded-full bg-[var(--color-panel)] px-3 py-2">{completedMatches}/{totalMatches} games complete</span>}
                          </div>
                        </div>
                        <div className="inline-flex min-h-16 shrink-0 items-center justify-center rounded-2xl bg-blue-600 px-7 py-4 text-xl font-black text-white">
                          {currentNight.status === "active" ? "Continue Game Night" : "Prepare Game Night"}
                          <span aria-hidden="true" className="ml-2 transition group-hover:translate-x-1">→</span>
                        </div>
                      </div>
                    </Link>
                  ) : (
                    <div className="rounded-3xl border border-dashed border-blue-500/45 bg-blue-500/10 p-6 sm:p-8">
                      <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                          <h3 className="text-2xl font-black">No upcoming Game Night is scheduled</h3>
                          <p className="mt-2 text-sm text-[var(--color-text-muted)]">Create the next night, choose the date and venue, then we&apos;ll walk through players, teams, and boards.</p>
                        </div>
                        <Link href="/game-nights" className="inline-flex min-h-14 shrink-0 items-center justify-center rounded-2xl bg-blue-600 px-6 py-3 font-black text-white">Schedule a Game Night →</Link>
                      </div>
                    </div>
                  )}
                </section>

                <section className="mb-8">
                  <div className="mb-3">
                    <div className="text-xs font-black uppercase tracking-[0.16em] text-[var(--color-text-muted)]">People</div>
                    <h2 className="mt-1 text-2xl font-black">Players & membership</h2>
                  </div>
                  <div className="grid gap-4 md:grid-cols-2">
                    <TaskCard href="/league-roster" icon="➕" title="Add or Edit Players" description="Add a new player, find an existing player, or change who belongs to this league and season." emphasis="important" />
                    <TaskCard href="/league-roster" icon="📊" title="Player Records & Statistics" description="Find a player and open their league and career results." />
                  </div>
                </section>

                <section className="mb-8">
                  <div className="mb-3">
                    <div className="text-xs font-black uppercase tracking-[0.16em] text-[var(--color-text-muted)]">League</div>
                    <h2 className="mt-1 text-2xl font-black">Schedule, seasons & results</h2>
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    <TaskCard href="/game-nights" icon="📅" title="Schedule a Game Night" description="Create the next league night or open an existing one." />
                    <TaskCard href="/leagues" icon="🏆" title="League & Seasons" description="Change the league name, manage seasons, and review league setup." />
                    <TaskCard href="/game-nights/stats" icon="🏅" title="Standings & Results" description="Review Game Night results, high scores, and player highlights." />
                  </div>
                </section>

                <section className="mb-8">
                  <div className="mb-3">
                    <div className="text-xs font-black uppercase tracking-[0.16em] text-[var(--color-text-muted)]">Location & equipment</div>
                    <h2 className="mt-1 text-2xl font-black">Where you play and what you score on</h2>
                  </div>
                  <div className="grid gap-4 md:grid-cols-2">
                    <TaskCard href="/league-devices" icon="📍" title="Venues & Dartboards" description="Add a club or hall, add its dartboards, or mark a board out of service." />
                    <TaskCard href="/league-devices" icon="📱" title="Scoring Devices" description="Add, pair, move, or replace the tablet or computer used beside a dartboard." emphasis="important" />
                  </div>
                </section>

                <details className="rounded-2xl border border-[var(--color-panel-border)] bg-[var(--color-panel)] p-5">
                  <summary className="cursor-pointer text-lg font-black">Less common & advanced tasks</summary>
                  <p className="mt-2 text-sm text-[var(--color-text-muted)]">These are available when you need them, but they should not get in the way of normal league operation.</p>
                  <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    <TaskCard href="/game-night-templates" icon="🧩" title="Game Templates" description="Save or edit reusable Game Night settings." />
                    <TaskCard href="/game-nights/setup" icon="⚙️" title="Game Night Rules" description="Open the detailed rules and structure for the selected Game Night." />
                    <TaskCard href="/game-nights/fixtures" icon="🗂️" title="Games & Rounds" description="Open detailed fixture and round controls." />
                    <TaskCard href="/league-play/play" icon="🎯" title="Direct Match View" description="Open the central match screen when you need match-level control." />
                  </div>
                </details>
              </>
            )}
          </>
        )}
      </div>
    </main>
  );
}
