"use client";

import { useState } from "react";
import {
  MAX_PAUSED_CASUAL_GAMES,
  type PausedCasualGame,
} from "@/lib/persistence/casualSavedGames";

type ExitMode = "choose" | "pause" | "discard";

export function CasualExitGameDialog({
  games,
  suggestedName,
  onCancel,
  onPause,
  onDiscard,
  onDeleteSavedGame,
}: {
  games: PausedCasualGame[];
  suggestedName: string;
  onCancel: () => void;
  onPause: (name: string) => void;
  onDiscard: () => void;
  onDeleteSavedGame: (id: string) => void;
}) {
  const [mode, setMode] = useState<ExitMode>("choose");
  const [pauseName, setPauseName] = useState(suggestedName);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const isAtLimit = games.length >= MAX_PAUSED_CASUAL_GAMES;

  return (
    <div
      className="fixed inset-0 z-[120] flex items-end justify-center bg-black/70 p-3 sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="exit-game-title"
    >
      <section className="w-full max-w-lg rounded-2xl border border-[var(--color-panel-border)] bg-[var(--color-panel)] p-5 text-[var(--color-text-main)] shadow-2xl">
        {mode === "choose" && (
          <>
            <h2 id="exit-game-title" className="text-2xl font-black">Exit Game</h2>
            <p className="mt-2 text-sm text-[var(--color-text-muted)]">
              Pause this casual game to continue later, or discard it permanently.
            </p>
            <div className="mt-5 grid gap-3">
              <button type="button" onClick={() => setMode("pause")} className="rounded-xl border border-[var(--color-primary)]/50 bg-[var(--color-primary)]/10 px-4 py-4 text-left hover:bg-[var(--color-primary)]/15">
                <div className="font-black">Pause Game</div>
                <div className="mt-1 text-sm text-[var(--color-text-muted)]">Save the exact game state and return to setup.</div>
              </button>
              <button type="button" onClick={() => setMode("discard")} className="rounded-xl border border-[var(--color-danger)]/40 bg-[var(--color-danger)]/10 px-4 py-4 text-left hover:bg-[var(--color-danger)]/15">
                <div className="font-black text-[var(--color-danger-hover)]">Discard Game</div>
                <div className="mt-1 text-sm text-[var(--color-text-muted)]">Remove this casual game without recording a result.</div>
              </button>
              <button type="button" onClick={onCancel} className="rounded-xl border border-[var(--color-panel-border)] px-4 py-3 font-black hover:bg-[var(--color-panel-soft)]">Cancel</button>
            </div>
          </>
        )}

        {mode === "pause" && (
          <>
            <h2 id="exit-game-title" className="text-2xl font-black">Pause Game</h2>
            <p className="mt-2 text-sm text-[var(--color-text-muted)]">Give this game a name so it is easy to find later.</p>
            <label className="mt-4 block text-sm font-bold">
              Saved game name
              <input autoFocus value={pauseName} maxLength={100} onChange={(event) => setPauseName(event.target.value)} className="mt-2 w-full rounded-xl border border-[var(--color-panel-border)] bg-[var(--color-panel-soft)] p-3" />
            </label>

            {isAtLimit && (
              <div className="mt-4 rounded-xl border border-[var(--color-warning)]/50 bg-[var(--color-warning)]/10 p-4">
                <div className="font-black">5 saved games already exist</div>
                <p className="mt-1 text-sm text-[var(--color-text-muted)]">Delete one below before saving this game. Nothing will be overwritten automatically.</p>
                <div className="mt-3 space-y-2">
                  {games.map((game) => (
                    <div key={game.id} className="rounded-lg border border-[var(--color-panel-border)] bg-[var(--color-panel)] p-3">
                      <div className="font-bold">{game.name}</div>
                      <div className="mt-1 text-xs text-[var(--color-text-muted)]">{game.gameLabel} · {new Date(game.pausedAt).toLocaleString()}</div>
                      {pendingDeleteId === game.id ? (
                        <div className="mt-2 flex flex-wrap gap-2">
                          <button type="button" onClick={() => { onDeleteSavedGame(game.id); setPendingDeleteId(null); }} className="rounded-lg bg-[var(--color-danger)] px-3 py-2 text-xs font-bold text-white hover:bg-[var(--color-danger-hover)]">Confirm Delete</button>
                          <button type="button" onClick={() => setPendingDeleteId(null)} className="rounded-lg border border-[var(--color-panel-border)] px-3 py-2 text-xs font-bold">Cancel</button>
                        </div>
                      ) : (
                        <button type="button" onClick={() => setPendingDeleteId(game.id)} className="mt-2 text-xs font-bold text-[var(--color-danger-hover)] underline underline-offset-4">Delete saved game</button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="mt-5 flex flex-wrap justify-end gap-3">
              <button type="button" onClick={() => setMode("choose")} className="rounded-xl border border-[var(--color-panel-border)] px-4 py-3 font-black">Back</button>
              <button type="button" disabled={isAtLimit || !pauseName.trim()} onClick={() => onPause(pauseName.trim())} className="rounded-xl bg-[var(--color-primary)] px-5 py-3 font-black text-white hover:bg-[var(--color-primary-hover)] disabled:cursor-not-allowed disabled:opacity-40">Save & Pause</button>
            </div>
          </>
        )}

        {mode === "discard" && (
          <>
            <h2 id="exit-game-title" className="text-2xl font-black">Discard Game?</h2>
            <p className="mt-2 text-sm text-[var(--color-text-muted)]">This permanently removes the current casual game. Its partial turns, scores, and result will not be added to completed-game statistics or history.</p>
            <div className="mt-5 flex flex-wrap justify-end gap-3">
              <button type="button" onClick={() => setMode("choose")} className="rounded-xl border border-[var(--color-panel-border)] px-4 py-3 font-black">Back</button>
              <button type="button" onClick={onDiscard} className="rounded-xl bg-[var(--color-danger)] px-5 py-3 font-black text-white hover:bg-[var(--color-danger-hover)]">Discard Game</button>
            </div>
          </>
        )}
      </section>
    </div>
  );
}
