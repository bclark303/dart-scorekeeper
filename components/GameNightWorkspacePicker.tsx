"use client";

import type { LeagueSummary } from "@/lib/league/contracts";
import type { GameNightSummary } from "@/lib/league/gameNightContracts";

function formatDate(value: number) {
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
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

export function GameNightWorkspacePicker({
  leagues,
  leagueId,
  nights,
  nightId,
  onLeagueChange,
  onNightChange,
}: {
  leagues: LeagueSummary[];
  leagueId: string;
  nights: GameNightSummary[];
  nightId: string;
  onLeagueChange: (leagueId: string) => void;
  onNightChange: (nightId: string) => void;
}) {
  return (
    <section className="grid gap-3 rounded-2xl border border-[var(--color-panel-border)] bg-[var(--color-panel)] p-4 md:grid-cols-2">
      <label htmlFor="game-night-workspace-league" className="text-sm font-bold">
        League
        <select
          id="game-night-workspace-league"
          value={leagueId}
          onChange={(event) => onLeagueChange(event.target.value)}
          className="mt-2 w-full rounded-xl border border-[var(--color-panel-border)] bg-[var(--color-panel-soft)] p-3 font-bold"
        >
          <option value="">Select a league</option>
          {leagues.map((league) => (
            <option key={league.id} value={league.id}>
              {league.name}
            </option>
          ))}
        </select>
      </label>

      <label htmlFor="game-night-workspace-night" className="text-sm font-bold">
        Game Night
        <select
          id="game-night-workspace-night"
          value={nightId}
          onChange={(event) => onNightChange(event.target.value)}
          disabled={!leagueId || nights.length === 0}
          className="mt-2 w-full rounded-xl border border-[var(--color-panel-border)] bg-[var(--color-panel-soft)] p-3 font-bold disabled:opacity-50"
        >
          <option value="">Select a Game Night</option>
          {nights.map((night) => (
            <option key={night.id} value={night.id}>
              {night.name} · {formatDate(night.scheduledAt)} · {niceStatus(night.status)}
            </option>
          ))}
        </select>
      </label>
    </section>
  );
}
