"use client";

import type { Dispatch, SetStateAction } from "react";

import type {
  GameNightLayoutMode,
  GameNightSettingsSummary,
} from "@/lib/league/gameNightContracts";
import { getDummyScoringRule } from "@/lib/league/dummyScoring";
import { X01_BEST_OF_OPTIONS } from "@/lib/league/matchFormat";

function numberValue(value: string, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function modeValue(value: string): GameNightLayoutMode {
  return value === "automatic" ? "automatic" : "manual";
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
  const dummyScoringRule = getDummyScoringRule(settings.dummyScore);
  const teamCountMode = settings.teamCountMode ?? "manual";
  const teamSizeMode = settings.teamSizeMode ?? "manual";
  const boardCountMode = settings.boardCountMode ?? "manual";

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

          <div className="mt-4 rounded-xl border border-[var(--color-primary)]/40 bg-[var(--color-panel)] p-3 text-xs text-[var(--color-text-muted)]">
            <span className="font-bold text-[var(--color-text)]">Automatic layout:</span>{" "}
            Auto modes recalculate from the checked-in headcount. Team sizing
            prefers balanced 2-3 player teams where practical, team count avoids
            a bye when a similarly good even-team layout exists, and Auto Boards
            provides one board per simultaneous matchup.
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
            <label className="text-sm">
              Creation mode
              <select
                value={settings.teamCreationMode}
                onChange={(event) =>
                  patch(
                    "teamCreationMode",
                    event.target.value as GameNightSettingsSummary["teamCreationMode"],
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
              Number of teams
              <select
                value={teamCountMode}
                onChange={(event) => patch("teamCountMode", modeValue(event.target.value))}
                className="mt-1 w-full rounded-xl border border-[var(--color-panel-border)] bg-[var(--color-panel)] p-2.5"
              >
                <option value="manual">Manual</option>
                <option value="automatic">Auto from check-ins</option>
              </select>
              <input
                type="number"
                min={2}
                max={64}
                disabled={disabled || teamCountMode === "automatic"}
                value={settings.targetTeamCount}
                onChange={(event) =>
                  patch("targetTeamCount", numberValue(event.target.value, 2))
                }
                className="mt-2 w-full rounded-xl border border-[var(--color-panel-border)] bg-[var(--color-panel)] p-2.5 disabled:opacity-60"
              />
              {teamCountMode === "automatic" && (
                <span className="mt-1 block text-xs text-emerald-200">
                  Current calculated value: {settings.targetTeamCount} teams
                </span>
              )}
            </label>

            <div className="rounded-xl border border-[var(--color-panel-border)] bg-[var(--color-panel)] p-3">
              <label className="text-sm">
                Team sizes
                <select
                  value={teamSizeMode}
                  onChange={(event) => patch("teamSizeMode", modeValue(event.target.value))}
                  className="mt-1 w-full rounded-xl border border-[var(--color-panel-border)] bg-[var(--color-panel-soft)] p-2.5"
                >
                  <option value="manual">Manual min / max</option>
                  <option value="automatic">Auto balanced sizes</option>
                </select>
              </label>
              <div className="mt-2 grid grid-cols-2 gap-2">
                <label className="text-xs">
                  Minimum
                  <input
                    type="number"
                    min={1}
                    max={16}
                    disabled={disabled || teamSizeMode === "automatic"}
                    value={settings.minTeamPlayers}
                    onChange={(event) =>
                      patch("minTeamPlayers", numberValue(event.target.value, 1))
                    }
                    className="mt-1 w-full rounded-lg border border-[var(--color-panel-border)] bg-[var(--color-panel-soft)] p-2.5 disabled:opacity-60"
                  />
                </label>
                <label className="text-xs">
                  Maximum
                  <input
                    type="number"
                    min={1}
                    max={32}
                    disabled={disabled || teamSizeMode === "automatic"}
                    value={settings.maxTeamPlayers}
                    onChange={(event) =>
                      patch("maxTeamPlayers", numberValue(event.target.value, 1))
                    }
                    className="mt-1 w-full rounded-lg border border-[var(--color-panel-border)] bg-[var(--color-panel-soft)] p-2.5 disabled:opacity-60"
                  />
                </label>
              </div>
              {teamSizeMode === "automatic" && (
                <div className="mt-2 text-xs text-emerald-200">
                  Current calculated range: {settings.minTeamPlayers}
                  {settings.minTeamPlayers === settings.maxTeamPlayers
                    ? ""
                    : `-${settings.maxTeamPlayers}`} players/team
                </div>
              )}
            </div>

            <label className="text-sm">
              Uneven teams / dummy policy
              <select
                value={settings.dummyPlayerMode}
                onChange={(event) =>
                  patch(
                    "dummyPlayerMode",
                    event.target.value as GameNightSettingsSummary["dummyPlayerMode"],
                  )
                }
                className="mt-1 w-full rounded-xl border border-[var(--color-panel-border)] bg-[var(--color-panel)] p-2.5"
              >
                <option value="none">Independent — no dummy</option>
                <option value="allow">Allow dummy if needed</option>
                <option value="fill">Auto-fill to minimum</option>
                <option value="balance">Balance all teams with dummies</option>
              </select>
              {settings.dummyPlayerMode === "balance" && (
                <span className="mt-1 block text-xs text-emerald-200">
                  Shorter teams receive dummy slots until every team has the same number of players as the largest real team.
                </span>
              )}
            </label>
          </div>

          {settings.dummyPlayerMode !== "none" && (
            <div className="mt-4 rounded-xl border border-[var(--color-panel-border)] bg-[var(--color-panel)] p-4">
              <h4 className="font-bold">Dummy Scoring Rules</h4>
              <p className="mt-1 text-xs text-[var(--color-text-muted)]">
                The selected dummy rule is snapshotted into each board match.
              </p>
              <div className="mt-3 grid gap-3">
                <button
                  type="button"
                  onClick={() => patch("dummyScore", 0)}
                  className={`rounded-lg border p-3 text-left ${
                    dummyScoringRule === "half_actual"
                      ? "border-[var(--color-primary)] bg-[var(--color-panel-soft)]"
                      : "border-[var(--color-panel-border)]"
                  }`}
                >
                  <div className="font-bold">Half of actual score</div>
                  <p className="mt-1 text-xs text-[var(--color-text-muted)]">
                    Each dummy dart is floor(partner dart score ÷ 2); misses stay 0.
                  </p>
                </button>
                <button
                  type="button"
                  onClick={() =>
                    patch("dummyScore", settings.dummyScore > 0 ? settings.dummyScore : 60)
                  }
                  className={`rounded-lg border p-3 text-left ${
                    dummyScoringRule === "fixed"
                      ? "border-[var(--color-primary)] bg-[var(--color-panel-soft)]"
                      : "border-[var(--color-panel-border)]"
                  }`}
                >
                  <div className="font-bold">Fixed dummy score per turn</div>
                  <p className="mt-1 text-xs text-[var(--color-text-muted)]">
                    Every dummy turn uses the configured fixed score.
                  </p>
                </button>
              </div>
              {dummyScoringRule === "fixed" && (
                <label className="mt-3 block text-sm font-bold">
                  Fixed score per dummy turn
                  <input
                    type="number"
                    min={1}
                    max={180}
                    value={settings.dummyScore}
                    onChange={(event) =>
                      patch(
                        "dummyScore",
                        Math.max(1, Math.min(180, numberValue(event.target.value, 60))),
                      )
                    }
                    className="mt-1 w-full rounded-xl border border-[var(--color-panel-border)] bg-[var(--color-panel-soft)] p-2.5"
                  />
                </label>
              )}
            </div>
          )}
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
                onChange={(event) => patch("startingScore", Number(event.target.value))}
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
                  patch("finishRule", event.target.value as GameNightSettingsSummary["finishRule"])
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
                onChange={(event) => patch("legsPerMatch", Number(event.target.value))}
                className="mt-1 w-full rounded-xl border border-[var(--color-panel-border)] bg-[var(--color-panel)] p-2.5"
              >
                {X01_BEST_OF_OPTIONS.map((legs) => (
                  <option key={legs} value={legs}>Best of {legs}</option>
                ))}
              </select>
            </label>
            <div className="rounded-xl border border-[var(--color-panel-border)] bg-[var(--color-panel)] p-3 text-sm">
              <div className="font-bold">Score Entry</div>
              <div className="mt-1 text-[var(--color-text-muted)]">
                Graphical dart-by-dart and total-turn entry remain scorer preferences.
              </div>
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-[var(--color-panel-border)] bg-[var(--color-panel-soft)] p-4">
          <h3 className="text-lg font-bold">Boards & Rotation</h3>
          <p className="mt-1 text-xs text-[var(--color-text-muted)]">
            Controls the physical boards and how future rounds move between them.
          </p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
            <label className="text-sm">
              Number of boards
              <select
                value={boardCountMode}
                onChange={(event) => patch("boardCountMode", modeValue(event.target.value))}
                className="mt-1 w-full rounded-xl border border-[var(--color-panel-border)] bg-[var(--color-panel)] p-2.5"
              >
                <option value="manual">Manual</option>
                <option value="automatic">Auto from team count</option>
              </select>
              <input
                type="number"
                min={1}
                max={32}
                disabled={disabled || boardCountMode === "automatic"}
                value={settings.boardCount}
                onChange={(event) => patch("boardCount", numberValue(event.target.value, 1))}
                className="mt-2 w-full rounded-xl border border-[var(--color-panel-border)] bg-[var(--color-panel)] p-2.5 disabled:opacity-60"
              />
              {boardCountMode === "automatic" && (
                <span className="mt-1 block text-xs text-emerald-200">
                  Current calculated value: {settings.boardCount} board{settings.boardCount === 1 ? "" : "s"}
                </span>
              )}
            </label>

            <label className="text-sm">
              Board rotation
              <select
                value={settings.boardRotationType}
                onChange={(event) =>
                  patch(
                    "boardRotationType",
                    event.target.value as GameNightSettingsSummary["boardRotationType"],
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
        Saving rules recalculates any Auto layout fields from the current check-in
        count and clears board pairings so they can be rebuilt safely.
      </p>
    </section>
  );
}
