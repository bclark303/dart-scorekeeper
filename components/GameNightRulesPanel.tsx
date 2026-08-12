"use client";

import type { Dispatch, SetStateAction } from "react";

import type { GameNightSettingsSummary } from "@/lib/league/gameNightContracts";
import { X01_BEST_OF_OPTIONS } from "@/lib/league/matchFormat";

function numberValue(value: string, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function GameNightRulesPanel({
  settings,
  setSettings,
  disabled,
  onSave,
}: {
  settings: GameNightSettingsSummary;
  setSettings: Dispatch<SetStateAction<GameNightSettingsSummary>>;
  disabled: boolean;
  onSave: () => void;
}) {
  function patch<K extends keyof GameNightSettingsSummary>(
    key: K,
    value: GameNightSettingsSummary[K],
  ) {
    setSettings((current) => ({ ...current, [key]: value }));
  }

  return (
    <section className="rounded-2xl border border-[var(--color-panel-border)] bg-[var(--color-panel)] p-5">
      <div>
        <h2 className="text-xl font-bold">League Night Rules</h2>
        <p className="mt-1 text-sm text-[var(--color-text-muted)]">
          Team construction, X01 match rules, and physical board behavior are
          configured separately.
        </p>
      </div>

      <div className="mt-5 grid gap-4 xl:grid-cols-3">
        <div className="rounded-xl border border-[var(--color-panel-border)] bg-[var(--color-panel-soft)] p-4">
          <h3 className="text-lg font-bold">Team Formation</h3>
          <p className="mt-1 text-xs text-[var(--color-text-muted)]">
            Controls how checked-in roster players are divided for this night.
          </p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
            <label className="text-sm">
              Creation mode
              <select
                value={settings.teamCreationMode}
                onChange={(event) =>
                  patch(
                    "teamCreationMode",
                    event.target
                      .value as GameNightSettingsSummary["teamCreationMode"],
                  )
                }
                className="mt-1 w-full rounded-xl border border-[var(--color-panel-border)] bg-[var(--color-panel)] p-2.5"
              >
                <option value="automatic">Automatic</option>
                <option value="manual">Manual</option>
                <option value="hybrid">Hybrid</option>
              </select>
            </label>

            <label className="text-sm">
              Target teams
              <input
                type="number"
                min={2}
                max={64}
                value={settings.targetTeamCount}
                onChange={(event) =>
                  patch(
                    "targetTeamCount",
                    numberValue(event.target.value, 2),
                  )
                }
                className="mt-1 w-full rounded-xl border border-[var(--color-panel-border)] bg-[var(--color-panel)] p-2.5"
              />
            </label>

            <label className="text-sm">
              Minimum players / team
              <input
                type="number"
                min={1}
                max={16}
                value={settings.minTeamPlayers}
                onChange={(event) =>
                  patch(
                    "minTeamPlayers",
                    numberValue(event.target.value, 1),
                  )
                }
                className="mt-1 w-full rounded-xl border border-[var(--color-panel-border)] bg-[var(--color-panel)] p-2.5"
              />
            </label>

            <label className="text-sm">
              Maximum players / team
              <input
                type="number"
                min={1}
                max={32}
                value={settings.maxTeamPlayers}
                onChange={(event) =>
                  patch(
                    "maxTeamPlayers",
                    numberValue(event.target.value, 1),
                  )
                }
                className="mt-1 w-full rounded-xl border border-[var(--color-panel-border)] bg-[var(--color-panel)] p-2.5"
              />
            </label>

            <label className="text-sm">
              Uneven teams / dummy policy
              <select
                value={settings.dummyPlayerMode}
                onChange={(event) =>
                  patch(
                    "dummyPlayerMode",
                    event.target
                      .value as GameNightSettingsSummary["dummyPlayerMode"],
                  )
                }
                className="mt-1 w-full rounded-xl border border-[var(--color-panel-border)] bg-[var(--color-panel)] p-2.5"
              >
                <option value="none">Independent — no dummy</option>
                <option value="allow">Allow dummy if needed</option>
                <option value="fill">Auto-fill to minimum</option>
              </select>
            </label>

            {settings.dummyPlayerMode !== "none" && (
              <label className="text-sm">
                Dummy turn score
                <input
                  type="number"
                  min={0}
                  max={180}
                  value={settings.dummyScore}
                  onChange={(event) =>
                    patch("dummyScore", numberValue(event.target.value, 0))
                  }
                  className="mt-1 w-full rounded-xl border border-[var(--color-panel-border)] bg-[var(--color-panel)] p-2.5"
                />
              </label>
            )}
          </div>
        </div>

        <div className="rounded-xl border border-[var(--color-panel-border)] bg-[var(--color-panel-soft)] p-4">
          <h3 className="text-lg font-bold">Match Rules</h3>
          <p className="mt-1 text-xs text-[var(--color-text-muted)]">
            Uses the same X01 formats and Best-of semantics as casual scoring.
          </p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
            <label className="text-sm">
              Game
              <select
                value={settings.startingScore}
                onChange={(event) =>
                  patch("startingScore", Number(event.target.value))
                }
                className="mt-1 w-full rounded-xl border border-[var(--color-panel-border)] bg-[var(--color-panel)] p-2.5"
              >
                <option value={301}>301</option>
                <option value={501}>501</option>
                <option value={701}>701</option>
              </select>
            </label>

            <label className="text-sm">
              Finish
              <select
                value={settings.finishRule}
                onChange={(event) =>
                  patch(
                    "finishRule",
                    event.target
                      .value as GameNightSettingsSummary["finishRule"],
                  )
                }
                className="mt-1 w-full rounded-xl border border-[var(--color-panel-border)] bg-[var(--color-panel)] p-2.5"
              >
                <option value="double">Double Out</option>
                <option value="straight">Straight Out</option>
              </select>
            </label>

            <label className="text-sm">
              Legs
              <select
                value={settings.legsPerMatch}
                onChange={(event) =>
                  patch("legsPerMatch", Number(event.target.value))
                }
                className="mt-1 w-full rounded-xl border border-[var(--color-panel-border)] bg-[var(--color-panel)] p-2.5"
              >
                {X01_BEST_OF_OPTIONS.map((legs) => (
                  <option key={legs} value={legs}>
                    Best of {legs}
                  </option>
                ))}
              </select>
            </label>

            <div className="rounded-xl border border-[var(--color-panel-border)] bg-[var(--color-panel)] p-3 text-sm">
              <div className="font-bold">Score Entry</div>
              <div className="mt-1 text-[var(--color-text-muted)]">
                Graphical dart-by-dart and total-turn entry are both available
                on league scorers. This is a scorer preference rather than a
                competition rule.
              </div>
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-[var(--color-panel-border)] bg-[var(--color-panel-soft)] p-4">
          <h3 className="text-lg font-bold">Boards & Rotation</h3>
          <p className="mt-1 text-xs text-[var(--color-text-muted)]">
            Controls the physical boards and how future rounds move between
            them.
          </p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
            <label className="text-sm">
              Number of boards
              <input
                type="number"
                min={1}
                max={32}
                value={settings.boardCount}
                onChange={(event) =>
                  patch("boardCount", numberValue(event.target.value, 1))
                }
                className="mt-1 w-full rounded-xl border border-[var(--color-panel-border)] bg-[var(--color-panel)] p-2.5"
              />
            </label>

            <label className="text-sm">
              Board rotation
              <select
                value={settings.boardRotationType}
                onChange={(event) =>
                  patch(
                    "boardRotationType",
                    event.target
                      .value as GameNightSettingsSummary["boardRotationType"],
                  )
                }
                className="mt-1 w-full rounded-xl border border-[var(--color-panel-border)] bg-[var(--color-panel)] p-2.5"
              >
                <option value="rotate">Rotate</option>
                <option value="fixed">Fixed</option>
                <option value="manual">Manual</option>
              </select>
            </label>
          </div>
        </div>
      </div>

      <button
        type="button"
        disabled={disabled}
        onClick={onSave}
        className="mt-5 rounded-xl bg-[var(--color-primary)] px-4 py-2.5 font-bold text-white disabled:opacity-50"
      >
        Save Rules
      </button>
      <p className="mt-2 text-xs text-[var(--color-text-muted)]">
        Saving rules clears existing board pairings so they can be rebuilt
        safely with the new match format.
      </p>
    </section>
  );
}
