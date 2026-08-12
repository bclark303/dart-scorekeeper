"use client";

import { useCallback, useEffect, useState } from "react";

import type { GameNightStatsSummary } from "@/lib/league/gameNightStats";

function leaderNames(leader: GameNightStatsSummary["most180s"]) {
  return leader?.players.map((player) => player.displayName).join(", ") ?? "";
}

export function GameNightStatsPanel({
  gameNightId,
  status,
}: {
  gameNightId: string;
  status: string;
}) {
  const [stats, setStats] = useState<GameNightStatsSummary | null>(null);
  const [errorMessage, setErrorMessage] = useState("");

  const loadStats = useCallback(async () => {
    try {
      const response = await fetch(
        `/api/leagues/game-night-stats?gameNightId=${encodeURIComponent(gameNightId)}`,
        { cache: "no-store" },
      );
      const result = (await response.json()) as {
        stats?: GameNightStatsSummary;
        error?: string;
      };
      if (!response.ok || !result.stats) {
        throw new Error(result.error ?? "Could not load Game Night statistics.");
      }
      setStats(result.stats);
      setErrorMessage("");
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Could not load Game Night statistics.",
      );
    }
  }, [gameNightId]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => void loadStats(), 0);
    if (status !== "active") {
      return () => window.clearTimeout(timeoutId);
    }
    const intervalId = window.setInterval(() => void loadStats(), 5000);
    return () => {
      window.clearTimeout(timeoutId);
      window.clearInterval(intervalId);
    };
  }, [loadStats, status]);

  return (
    <section className="rounded-2xl border border-[var(--color-panel-border)] bg-[var(--color-panel)] p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold">Night Highlights & Player Stats</h2>
          <p className="mt-1 text-sm text-[var(--color-text-muted)]">
            Derived from non-voided central league turns. Undo automatically
            removes a turn from these totals.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void loadStats()}
          className="rounded-xl border border-[var(--color-panel-border)] px-3 py-2 text-sm font-bold"
        >
          Refresh
        </button>
      </div>

      {errorMessage && (
        <div className="mt-4 rounded-xl border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-100">
          {errorMessage}
        </div>
      )}

      {stats && (
        <>
          <div className="mt-5 grid gap-3 md:grid-cols-2">
            <div className="rounded-xl border border-[var(--color-panel-border)] bg-[var(--color-panel-soft)] p-4">
              <div className="text-xs font-bold uppercase tracking-wide text-[var(--color-text-muted)]">
                Most 180s
              </div>
              {stats.most180s ? (
                <>
                  <div className="mt-1 text-3xl font-black">
                    {stats.most180s.value}
                  </div>
                  <div className="mt-1 font-bold">
                    {leaderNames(stats.most180s)}
                  </div>
                </>
              ) : (
                <div className="mt-2 text-sm text-[var(--color-text-muted)]">
                  No 180s tonight
                </div>
              )}
            </div>

            <div className="rounded-xl border border-[var(--color-panel-border)] bg-[var(--color-panel-soft)] p-4">
              <div className="text-xs font-bold uppercase tracking-wide text-[var(--color-text-muted)]">
                Highest Turn
              </div>
              {stats.highestTurn ? (
                <>
                  <div className="mt-1 text-3xl font-black">
                    {stats.highestTurn.value}
                  </div>
                  <div className="mt-1 font-bold">
                    {leaderNames(stats.highestTurn)}
                  </div>
                </>
              ) : (
                <div className="mt-2 text-sm text-[var(--color-text-muted)]">
                  No scored turns yet
                </div>
              )}
            </div>
          </div>

          {stats.players.length ? (
            <div className="mt-5 overflow-x-auto">
              <table className="w-full min-w-[760px] text-left text-sm">
                <thead className="text-xs uppercase tracking-wide text-[var(--color-text-muted)]">
                  <tr>
                    <th className="pb-2 pr-4">Player</th>
                    <th className="pb-2 pr-4">180s</th>
                    <th className="pb-2 pr-4">140+</th>
                    <th className="pb-2 pr-4">100+</th>
                    <th className="pb-2 pr-4">High Turn</th>
                    <th className="pb-2 pr-4">Double Outs</th>
                    <th className="pb-2">High Checkout</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.players.map((player) => (
                    <tr
                      key={player.leaguePlayerId}
                      className="border-t border-[var(--color-panel-border)]"
                    >
                      <td className="py-3 pr-4 font-bold">
                        {player.displayName}
                      </td>
                      <td className="py-3 pr-4">{player.count180s}</td>
                      <td className="py-3 pr-4">{player.count140Plus}</td>
                      <td className="py-3 pr-4">{player.count100Plus}</td>
                      <td className="py-3 pr-4">{player.highestTurn || "—"}</td>
                      <td className="py-3 pr-4">{player.doubleOuts}</td>
                      <td className="py-3">{player.highestCheckout || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="mt-4 text-sm text-[var(--color-text-muted)]">
              No league turns have been scored on this Game Night yet.
            </p>
          )}
        </>
      )}
    </section>
  );
}
