"use client";

import { useEffect, useState } from "react";

import type { SeasonLegStanding } from "@/lib/league/seasonLegStandings";

type SeasonStandingsResponse = {
  standings?: {
    seasonId: string;
    seasonName: string;
    leagueId: string;
    totalLegs: number;
    standings: SeasonLegStanding[];
  };
  error?: string;
};

function formatPercent(value: number) {
  return `${value.toFixed(1)}%`;
}

export function SeasonLegStandingsPanel({ seasonId }: { seasonId: string }) {
  const [data, setData] = useState<SeasonStandingsResponse["standings"]>(null);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setErrorMessage("");
    fetch(`/api/leagues/season-standings?seasonId=${encodeURIComponent(seasonId)}`, {
      cache: "no-store",
      signal: controller.signal,
    })
      .then(async (response) => {
        const result = (await response.json()) as SeasonStandingsResponse;
        if (!response.ok || !result.standings) {
          throw new Error(result.error ?? "Could not load season standings.");
        }
        return result.standings;
      })
      .then((standings) => {
        if (!controller.signal.aborted) setData(standings);
      })
      .catch((error: unknown) => {
        if (!controller.signal.aborted) {
          setErrorMessage(
            error instanceof Error ? error.message : "Could not load season standings.",
          );
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => controller.abort();
  }, [seasonId]);

  return (
    <section className="rounded-2xl border border-[var(--color-panel-border)] bg-[var(--color-panel)] p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-xs font-black uppercase tracking-[0.14em] text-[var(--color-primary)]">
            Season
          </div>
          <h2 className="mt-1 text-2xl font-black">Individual Leg Standings</h2>
          <p className="mt-1 text-sm text-[var(--color-text-muted)]">
            Every real player on the winning team receives one leg win; every real
            player on the opposing team receives one leg loss. Teams may change
            from week to week without losing the individual season table.
          </p>
        </div>
        {data && (
          <div className="rounded-full border border-[var(--color-panel-border)] px-3 py-1 text-xs font-bold uppercase text-[var(--color-text-muted)]">
            {data.totalLegs} legs recorded
          </div>
        )}
      </div>

      {loading ? (
        <div className="mt-4 text-sm text-[var(--color-text-muted)]">Loading season standings…</div>
      ) : errorMessage ? (
        <div className="mt-4 rounded-xl border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-100">
          {errorMessage}
        </div>
      ) : !data?.standings.length ? (
        <div className="mt-4 rounded-xl border border-dashed border-[var(--color-panel-border)] p-4 text-sm text-[var(--color-text-muted)]">
          No completed legs have been recorded for {data?.seasonName ?? "this season"} yet.
        </div>
      ) : (
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[680px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-[var(--color-panel-border)] text-left text-xs uppercase tracking-wide text-[var(--color-text-muted)]">
                <th className="px-2 py-3 text-center">#</th>
                <th className="px-2 py-3">Player</th>
                <th className="px-2 py-3 text-right">Nights</th>
                <th className="px-2 py-3 text-right">W</th>
                <th className="px-2 py-3 text-right">L</th>
                <th className="px-2 py-3 text-right">+/-</th>
                <th className="px-2 py-3 text-right">Leg %</th>
              </tr>
            </thead>
            <tbody>
              {data.standings.map((standing, index) => (
                <tr key={standing.leaguePlayerId} className="border-b border-[var(--color-panel-border)]/70">
                  <td className="px-2 py-3 text-center font-black">{index + 1}</td>
                  <td className="px-2 py-3 font-bold">{standing.displayName}</td>
                  <td className="px-2 py-3 text-right">{standing.nightsPlayed}</td>
                  <td className="px-2 py-3 text-right font-black">{standing.legWins}</td>
                  <td className="px-2 py-3 text-right">{standing.legLosses}</td>
                  <td className="px-2 py-3 text-right">
                    {standing.legDifferential > 0 ? "+" : ""}{standing.legDifferential}
                  </td>
                  <td className="px-2 py-3 text-right font-black">{formatPercent(standing.legWinPercentage)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
