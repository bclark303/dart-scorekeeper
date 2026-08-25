"use client";

import { useState } from "react";
import type { PausedCasualGame } from "@/lib/persistence/casualSavedGames";

export function PausedCasualGamesPanel({
  games,
  onResume,
  onDelete,
}: {
  games: PausedCasualGame[];
  onResume: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);

  if (games.length === 0) return null;

  return (
    <section className="rounded-2xl border border-[var(--color-panel-border)] bg-[var(--color-panel)] p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-lg font-black">Resume Saved Game</h3>
          <p className="mt-1 text-xs text-[var(--color-text-muted)]">
            Paused casual games stay on this browser until you resume or delete them.
          </p>
        </div>
        <span className="rounded-full border border-[var(--color-panel-border)] px-3 py-1 text-xs font-bold text-[var(--color-text-muted)]">
          {games.length} / 5 saved
        </span>
      </div>

      <div className="mt-4 space-y-3">
        {games.map((game) => (
          <div
            key={game.id}
            className="rounded-xl border border-[var(--color-panel-border)] bg-[var(--color-panel-soft)] p-4"
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="truncate font-black">{game.name}</div>
                <div className="mt-1 text-sm text-[var(--color-text-muted)]">
                  {game.participantNames.join(" · ") || "Casual game"}
                </div>
                <div className="mt-1 text-xs text-[var(--color-text-muted)]">
                  {game.gameLabel} · Paused {new Date(game.pausedAt).toLocaleString()}
                </div>
              </div>
              <button
                type="button"
                onClick={() => onResume(game.id)}
                className="rounded-xl bg-[var(--color-primary)] px-4 py-2.5 text-sm font-black text-white hover:bg-[var(--color-primary-hover)]"
              >
                Resume
              </button>
            </div>

            {pendingDeleteId === game.id ? (
              <div className="mt-3 flex flex-wrap items-center gap-2 rounded-lg border border-[var(--color-danger)]/40 bg-[var(--color-danger)]/10 p-3 text-sm">
                <span className="mr-auto font-bold">Delete this saved game?</span>
                <button
                  type="button"
                  onClick={() => {
                    onDelete(game.id);
                    setPendingDeleteId(null);
                  }}
                  className="rounded-lg bg-[var(--color-danger)] px-3 py-2 font-bold text-white hover:bg-[var(--color-danger-hover)]"
                >
                  Delete
                </button>
                <button
                  type="button"
                  onClick={() => setPendingDeleteId(null)}
                  className="rounded-lg border border-[var(--color-panel-border)] px-3 py-2 font-bold"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setPendingDeleteId(game.id)}
                className="mt-3 text-xs font-bold text-[var(--color-danger-hover)] underline underline-offset-4"
              >
                Delete saved game
              </button>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
