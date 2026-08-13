"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";

import type {
  PlayerCareerStats,
  PlayerCareerStatsResponse,
  PlayerStatTotals,
} from "@/lib/league/playerStatsContracts";

function StatGrid({ totals }: { totals: PlayerStatTotals }) {
  const average = totals.turns > 0 ? totals.pointsScored / totals.turns : 0;
  const items = [
    ["Turns", totals.turns.toLocaleString()],
    ["Points", totals.pointsScored.toLocaleString()],
    ["Avg / turn", average.toFixed(1)],
    ["100+", totals.count100Plus.toLocaleString()],
    ["140+", totals.count140Plus.toLocaleString()],
    ["180s", totals.count180s.toLocaleString()],
    ["High turn", totals.highestTurn.toLocaleString()],
    ["Double outs", totals.doubleOuts.toLocaleString()],
    ["High checkout", totals.highestCheckout.toLocaleString()],
  ];

  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
      {items.map(([label, value]) => (
        <div key={label} className="rounded-xl bg-[var(--color-panel-soft)] p-3">
          <div className="text-xs font-bold uppercase tracking-wide text-[var(--color-text-muted)]">{label}</div>
          <div className="mt-1 text-xl font-black">{value}</div>
        </div>
      ))}
    </div>
  );
}

export default function PlayerStatsPage() {
  const params = useParams<{ playerId: string }>();
  const playerId = params.playerId;
  const [player, setPlayer] = useState<PlayerCareerStats | null>(null);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    fetch(`/api/players?playerId=${encodeURIComponent(playerId)}`, {
      cache: "no-store",
      signal: controller.signal,
    })
      .then(async (response) => {
        const result = (await response.json()) as PlayerCareerStatsResponse;
        if (!response.ok || !result.player) {
          throw new Error(result.error ?? "Could not load player statistics.");
        }
        return result.player;
      })
      .then((result) => {
        if (!controller.signal.aborted) setPlayer(result);
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        setErrorMessage(error instanceof Error ? error.message : "Could not load player statistics.");
      });
    return () => controller.abort();
  }, [playerId]);

  return (
    <main className="min-h-screen bg-[var(--color-app-bg)] p-4 text-[var(--color-text-main)] sm:p-6">
      <div className="mx-auto max-w-5xl space-y-6">
        <header className="flex items-start justify-between gap-4">
          <div>
            <Link href="/league-roster" className="text-sm font-black text-[var(--color-primary)]">← Players</Link>
            <h1 className="mt-2 text-3xl font-black">{player?.displayName ?? "Player Statistics"}</h1>
            <p className="mt-1 text-sm text-[var(--color-text-muted)]">One career identity, with the same authoritative scoring history filtered by league and season.</p>
          </div>
          <Link href="/help?from=player-stats" aria-label="Help" className="rounded-xl border border-[var(--color-panel-border)] bg-[var(--color-panel)] px-3 py-2 font-black">?</Link>
        </header>

        {!player && !errorMessage && (
          <section className="rounded-2xl border border-[var(--color-panel-border)] bg-[var(--color-panel)] p-6 text-[var(--color-text-muted)]">Loading player statistics…</section>
        )}

        {errorMessage && (
          <section className="rounded-2xl border border-rose-500/40 bg-rose-500/10 p-5 text-sm">{errorMessage}</section>
        )}

        {player && (
          <>
            <section className="rounded-2xl border border-[var(--color-panel-border)] bg-[var(--color-panel)] p-5">
              <div className="mb-4">
                <div className="text-xs font-black uppercase tracking-wide text-[var(--color-text-muted)]">Overall</div>
                <h2 className="text-2xl font-black">All leagues</h2>
              </div>
              <StatGrid totals={player.totals} />
            </section>

            {player.leagues.length === 0 ? (
              <section className="rounded-2xl border border-dashed border-[var(--color-panel-border)] bg-[var(--color-panel)] p-6 text-sm text-[var(--color-text-muted)]">No completed scoring history is available for this player yet.</section>
            ) : (
              <section className="space-y-4">
                <div>
                  <h2 className="text-2xl font-black">By League</h2>
                  <p className="text-sm text-[var(--color-text-muted)]">League totals roll up only authoritative turns from that league.</p>
                </div>
                {player.leagues.map((league) => (
                  <article key={league.leagueId} className="rounded-2xl border border-[var(--color-panel-border)] bg-[var(--color-panel)] p-5">
                    <h3 className="text-xl font-black">{league.leagueName}</h3>
                    <div className="mt-4"><StatGrid totals={league.totals} /></div>
                    {league.seasons.length > 0 && (
                      <div className="mt-5 border-t border-[var(--color-panel-border)] pt-4">
                        <div className="mb-3 text-sm font-black">Season breakdown</div>
                        <div className="space-y-3">
                          {league.seasons.map((season) => (
                            <div key={season.seasonId} className="rounded-xl border border-[var(--color-panel-border)] p-4">
                              <div className="mb-3 font-black">{season.seasonName}</div>
                              <StatGrid totals={season.totals} />
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </article>
                ))}
              </section>
            )}

            <section className="rounded-2xl border border-sky-500/30 bg-sky-500/10 p-5 text-sm">
              These are scoring statistics already supported by the authoritative turn history. Match records, standings points, wins/losses and ranking calculations will be added with the standings milestone.
            </section>
          </>
        )}
      </div>
    </main>
  );
}
