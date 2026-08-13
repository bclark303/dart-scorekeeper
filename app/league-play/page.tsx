"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

import type { LeagueListResponse, LeagueSummary } from "@/lib/league/contracts";

const ACTIVE_LEAGUE_KEY = "dart-scorekeeper:active-league-id";

const leagueMenu = [
  { href: "/leagues", title: "League Setup", description: "Leagues, seasons, rules, schedule, and league-level statistics.", icon: "🏛️" },
  { href: "/game-nights/control", title: "Game Night", description: "Check-in, teams, boards, fixtures, and live night control.", icon: "📅" },
  { href: "/league-roster", title: "Players", description: "Add and manage players, league membership, and player statistics.", icon: "👥" },
  { href: "/league-devices", title: "Devices", description: "Registered scoring devices, status, pairing, and maintenance.", icon: "🖥️" },
  { href: "/league-play/play", title: "Play", description: "Open the current centrally managed match and board status.", icon: "🎯" },
] as const;

type AccessState = "checking" | "logged-out" | "logged-in" | "error";

export default function LeaguePlayPage() {
  const [access, setAccess] = useState<AccessState>("checking");
  const [leagues, setLeagues] = useState<LeagueSummary[]>([]);
  const [activeLeagueId, setActiveLeagueId] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  const activeLeague = useMemo(
    () => leagues.find((league) => league.id === activeLeagueId) ?? null,
    [activeLeagueId, leagues],
  );

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
      setErrorMessage(error instanceof Error ? error.message : "Could not load League Play.");
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => void loadWorkspace(), 0);
    return () => window.clearTimeout(timer);
  }, [loadWorkspace]);

  function changeActiveLeague(leagueId: string) {
    setActiveLeagueId(leagueId);
    if (leagueId) window.localStorage.setItem(ACTIVE_LEAGUE_KEY, leagueId);
    else window.localStorage.removeItem(ACTIVE_LEAGUE_KEY);
  }

  return (
    <main className="min-h-screen bg-[var(--color-app-bg)] p-4 text-[var(--color-text-main)] sm:p-6">
      <div className="mx-auto max-w-5xl">
        <header className="mb-8 flex items-start justify-between gap-4">
          <div>
            <Link href="/" className="text-sm font-bold text-[var(--color-primary)]">← Home</Link>
            <h1 className="mt-2 text-4xl font-black">League Play</h1>
            <p className="mt-1 text-[var(--color-text-muted)]">Connected league scoring and administration.</p>
          </div>
          <div className="flex gap-2">
            <Link href="/settings" aria-label="Settings" className="rounded-xl border border-[var(--color-panel-border)] bg-[var(--color-panel)] px-3 py-2 text-sm font-bold">⚙</Link>
            <Link href="/help?from=league-play" aria-label="Help" className="rounded-xl border border-[var(--color-panel-border)] bg-[var(--color-panel)] px-3 py-2 text-sm font-bold">?</Link>
          </div>
        </header>

        {access === "checking" && <div className="text-[var(--color-text-muted)]">Checking login…</div>}

        {access === "logged-out" && (
          <div className="grid gap-5 md:grid-cols-2">
            <Link href="/account" className="rounded-3xl border border-blue-500/40 bg-[var(--color-panel)] p-7 transition hover:border-blue-500">
              <div className="text-3xl">🔐</div>
              <h2 className="mt-4 text-2xl font-black">Log In</h2>
              <p className="mt-2 text-sm text-[var(--color-text-muted)]">Sign in to access League Setup, Game Night, Players, Devices, and Play.</p>
            </Link>
            <Link href="/board-device" className="rounded-3xl border border-violet-500/40 bg-[var(--color-panel)] p-7 transition hover:border-violet-500">
              <div className="text-3xl">🖥️</div>
              <h2 className="mt-4 text-2xl font-black">Device Setup</h2>
              <p className="mt-2 text-sm text-[var(--color-text-muted)]">Pair this scorer with a registered league board using its device code.</p>
            </Link>
          </div>
        )}

        {access === "error" && (
          <div className="rounded-2xl border border-red-500/40 bg-red-500/10 p-5">
            <div className="font-black">League Play could not be loaded.</div>
            <div className="mt-1 text-sm">{errorMessage}</div>
            <button onClick={() => void loadWorkspace()} className="mt-4 rounded-xl bg-[var(--color-primary)] px-4 py-2 font-black text-white">Retry</button>
          </div>
        )}

        {access === "logged-in" && (
          <>
            <section className="mb-6 rounded-2xl border border-[var(--color-panel-border)] bg-[var(--color-panel)] p-4 sm:p-5">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <div className="text-xs font-black uppercase tracking-[0.14em] text-[var(--color-text-muted)]">Active league</div>
                  <div className="mt-1 text-xl font-black">{activeLeague?.name ?? "No league selected"}</div>
                  {activeLeague?.seasons[0] && <div className="text-sm text-[var(--color-text-muted)]">{activeLeague.seasons[0].name}</div>}
                </div>
                {leagues.length > 1 && (
                  <label className="text-sm font-bold">Switch league
                    <select value={activeLeagueId} onChange={(event) => changeActiveLeague(event.target.value)} className="mt-1 block min-w-60 rounded-xl border border-[var(--color-panel-border)] bg-[var(--color-panel-soft)] px-3 py-2.5">
                      {leagues.map((league) => <option key={league.id} value={league.id}>{league.name}</option>)}
                    </select>
                  </label>
                )}
              </div>
            </section>

            {!leagues.length ? (
              <section className="rounded-3xl border border-dashed border-[var(--color-panel-border)] bg-[var(--color-panel)] p-8 text-center">
                <h2 className="text-2xl font-black">No leagues yet</h2>
                <p className="mt-2 text-[var(--color-text-muted)]">Create your first league and season to unlock the league workflow.</p>
                <Link href="/leagues" className="mt-5 inline-flex rounded-xl bg-[var(--color-primary)] px-5 py-3 font-black text-white">Open League Setup</Link>
              </section>
            ) : (
              <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {leagueMenu.map((item) => (
                  <Link key={item.href} href={item.href} className="group rounded-2xl border border-[var(--color-panel-border)] bg-[var(--color-panel)] p-5 transition hover:-translate-y-0.5 hover:border-[var(--color-primary)]">
                    <div className="text-2xl">{item.icon}</div>
                    <div className="mt-3 flex items-center justify-between gap-3">
                      <h2 className="text-xl font-black">{item.title}</h2>
                      <span className="text-xl text-[var(--color-text-muted)] transition group-hover:translate-x-1">→</span>
                    </div>
                    <p className="mt-2 text-sm leading-6 text-[var(--color-text-muted)]">{item.description}</p>
                  </Link>
                ))}
              </section>
            )}
          </>
        )}
      </div>
    </main>
  );
}
