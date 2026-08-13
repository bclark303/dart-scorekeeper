"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

import { authClient } from "@/lib/auth/client";
import type { LeagueListResponse, LeagueSummary } from "@/lib/league/contracts";
import type { GameNightSummary } from "@/lib/league/gameNightContracts";

const ACTIVE_LEAGUE_KEY = "dart-scorekeeper:active-league-id";

export default function LeaguePlayCurrentPage() {
  const { data: session, isPending } = authClient.useSession();
  const [league, setLeague] = useState<LeagueSummary | null>(null);
  const [night, setNight] = useState<GameNightSummary | null>(null);
  const [errorMessage, setErrorMessage] = useState("");

  const loadCurrentPlay = useCallback(async () => {
    setErrorMessage("");
    try {
      const leagueResponse = await fetch("/api/leagues", { cache: "no-store" });
      const leagueResult = (await leagueResponse.json()) as LeagueListResponse & {
        error?: string;
      };
      if (!leagueResponse.ok) {
        throw new Error(leagueResult.error ?? "Could not load leagues.");
      }

      const remembered = window.localStorage.getItem(ACTIVE_LEAGUE_KEY);
      const activeLeague =
        (remembered &&
          leagueResult.leagues.find((item) => item.id === remembered)) ||
        leagueResult.leagues[0] ||
        null;
      setLeague(activeLeague);
      if (!activeLeague) {
        setNight(null);
        return;
      }

      const nightResponse = await fetch(
        `/api/leagues/game-nights?leagueId=${encodeURIComponent(activeLeague.id)}`,
        { cache: "no-store" },
      );
      const nightResult = (await nightResponse.json()) as {
        gameNights?: GameNightSummary[];
        error?: string;
      };
      if (!nightResponse.ok || !nightResult.gameNights) {
        throw new Error(nightResult.error ?? "Could not load Game Night.");
      }

      const currentNight =
        nightResult.gameNights.find((item) => item.status === "active") ??
        nightResult.gameNights.find(
          (item) => !["completed", "cancelled"].includes(item.status),
        ) ??
        null;
      setNight(currentNight);
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Could not load current play.",
      );
    }
  }, []);

  useEffect(() => {
    if (!session?.user) return;
    const timer = window.setTimeout(() => void loadCurrentPlay(), 0);
    const interval = window.setInterval(() => void loadCurrentPlay(), 5000);
    return () => {
      window.clearTimeout(timer);
      window.clearInterval(interval);
    };
  }, [loadCurrentPlay, session?.user]);

  const currentRoundNumber =
    night?.activeRoundNumber ?? night?.currentRoundNumber ?? 1;

  const currentPairings = useMemo(() => {
    if (!night) return [];
    const round =
      night.rounds?.find((item) => item.status === "active") ??
      night.rounds?.find((item) => item.roundNumber === currentRoundNumber);
    return (
      round?.pairings ??
      night.pairings.filter(
        (pairing) => pairing.roundNumber === currentRoundNumber,
      )
    );
  }, [currentRoundNumber, night]);

  if (isPending) {
    return (
      <main className="mx-auto max-w-6xl p-6 text-[var(--color-text-muted)]">
        Checking account…
      </main>
    );
  }

  if (!session?.user) {
    return (
      <main className="mx-auto max-w-3xl p-6">
        <Link
          href="/league-play"
          className="text-sm font-black text-[var(--color-primary)]"
        >
          ← League Play
        </Link>
        <section className="mt-5 rounded-2xl border border-[var(--color-panel-border)] bg-[var(--color-panel)] p-6">
          <h1 className="text-3xl font-black">Play</h1>
          <p className="mt-2 text-[var(--color-text-muted)]">
            Sign in before opening a centrally managed league match.
          </p>
        </section>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[var(--color-app-bg)] p-4 text-[var(--color-text-main)] sm:p-6">
      <div className="mx-auto max-w-6xl">
        <header className="mb-6 flex flex-wrap items-start justify-between gap-3">
          <div>
            <Link
              href="/league-play"
              className="text-sm font-black text-[var(--color-primary)]"
            >
              ← League Play
            </Link>
            <h1 className="mt-2 text-3xl font-black">Play</h1>
            <p className="mt-1 text-sm text-[var(--color-text-muted)]">
              {league?.name ?? "Active league"} · current centrally managed
              matches
            </p>
          </div>
          <div className="flex gap-2">
            <Link
              href="/settings"
              aria-label="Settings"
              className="rounded-xl border border-[var(--color-panel-border)] bg-[var(--color-panel)] px-3 py-2 font-black"
            >
              ⚙
            </Link>
            <Link
              href="/help?from=league-play-play"
              aria-label="Help"
              className="rounded-xl border border-[var(--color-panel-border)] bg-[var(--color-panel)] px-3 py-2 font-black"
            >
              ?
            </Link>
          </div>
        </header>

        {errorMessage && (
          <div className="mb-5 rounded-xl border border-red-500/40 bg-red-500/10 p-4 text-sm text-red-100">
            {errorMessage}
          </div>
        )}

        {!night && !errorMessage ? (
          <section className="rounded-2xl border border-dashed border-[var(--color-panel-border)] bg-[var(--color-panel)] p-8 text-center">
            <h2 className="text-2xl font-black">No current Game Night</h2>
            <p className="mt-2 text-[var(--color-text-muted)]">
              When a Game Night is active, its board matches will appear here.
            </p>
            <Link
              href="/game-nights/control"
              className="mt-5 inline-flex rounded-xl border border-[var(--color-panel-border)] px-4 py-2.5 font-black"
            >
              Open Game Night Control
            </Link>
          </section>
        ) : night ? (
          <>
            <section className="mb-5 rounded-2xl border border-[var(--color-panel-border)] bg-[var(--color-panel)] p-5">
              <div className="text-xs font-black uppercase tracking-[0.14em] text-[var(--color-primary)]">
                {night.status === "active" ? "Game Night in progress" : "Game Night preparing"}
              </div>
              <h2 className="mt-1 text-2xl font-black">{night.name}</h2>
              <p className="mt-1 text-sm text-[var(--color-text-muted)]">
                Round {currentRoundNumber}
              </p>
            </section>

            <div className="grid gap-4 lg:grid-cols-2">
              {currentPairings.map((pairing) => {
                const board = night.boards.find((item) => item.id === pairing.boardId);
                const teamA = night.teams.find((team) => team.id === pairing.teamAId);
                const teamB = night.teams.find((team) => team.id === pairing.teamBId);
                return (
                  <article key={pairing.id} className="rounded-2xl border border-[var(--color-panel-border)] bg-[var(--color-panel)] p-5">
                    <div className="flex items-center justify-between gap-3">
                      <h3 className="text-lg font-black">{board?.name ?? `Board ${pairing.boardNumber}`}</h3>
                      <span className="rounded-full border border-[var(--color-panel-border)] px-2.5 py-1 text-xs font-black uppercase">{pairing.matchStatus ?? pairing.status}</span>
                    </div>
                    <div className="mt-5 text-center text-xl font-black">{teamA?.name ?? "Team A"} <span className="font-normal text-[var(--color-text-muted)]">vs</span> {teamB?.name ?? "Team B"}</div>
                    {pairing.matchSessionId ? (
                      <Link href={`/league-match/${pairing.matchSessionId}`} className="mt-5 flex justify-center rounded-xl bg-[var(--color-primary)] px-4 py-3 font-black text-white">
                        {pairing.matchStatus === "completed" ? "Review Match" : "Open Scorer"}
                      </Link>
                    ) : (
                      <div className="mt-5 rounded-xl bg-[var(--color-panel-soft)] p-3 text-center text-sm text-[var(--color-text-muted)]">Waiting for the coordinator to release this match.</div>
                    )}
                  </article>
                );
              })}
              {!currentPairings.length && (
                <section className="rounded-2xl border border-dashed border-[var(--color-panel-border)] bg-[var(--color-panel)] p-6 text-[var(--color-text-muted)] lg:col-span-2">No matches are available in the current round yet.</section>
              )}
            </div>
          </>
        ) : null}
      </div>
    </main>
  );
}
