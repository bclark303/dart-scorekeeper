"use client";

import Link from "next/link";
import {
  type Dispatch,
  type SetStateAction,
  useEffect,
  useState,
} from "react";

import { GameNightDraftRoundEditor } from "@/components/GameNightDraftRoundEditor";
import { GameNightScheduleButton } from "@/components/GameNightScheduleButton";
import {
  resolveGameNightSettings,
  type FixturePairingStrategy,
  type GameNightSettingsSummary,
  type GameNightSummary,
} from "@/lib/league/gameNightContracts";

type FixtureAction = (body: object, message?: string) => Promise<void> | void;

function strategyLabel(strategy: FixturePairingStrategy) {
  if (strategy === "fixed") return "Fixed matchups · repeat Round 1";
  if (strategy === "round_robin") return "Round robin";
  if (strategy === "swiss") return "Swiss · current-night record";
  if (strategy === "manual") return "Manual coordinator draft";
  return "Random · avoid rematches";
}

function formatRemaining(target: number, now: number) {
  const seconds = Math.max(0, Math.ceil((target - now) / 1000));
  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;
  return minutes > 0 ? `${minutes}m ${remainder}s` : `${remainder}s`;
}

export function GameNightFixturePanel({
  gameNight,
  settings,
  setSettings,
  disabled,
  onAction,
}: {
  gameNight: GameNightSummary;
  settings: GameNightSettingsSummary;
  setSettings: Dispatch<SetStateAction<GameNightSettingsSummary>>;
  disabled: boolean;
  onAction: FixtureAction;
}) {
  const resolved = resolveGameNightSettings(settings);
  const rounds = gameNight.rounds ?? [];
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  const draftRound =
    [...rounds].reverse().find((round) => round.status === "draft") ?? null;
  const activeTeams = gameNight.teams.filter(
    (team) => team.status !== "withdrawn",
  );
  const teamById = new Map(gameNight.teams.map((team) => [team.id, team]));
  const boardById = new Map(gameNight.boards.map((board) => [board.id, board]));
  const previousRound = draftRound
    ? rounds.find(
        (round) => round.roundNumber === draftRound.roundNumber - 1,
      ) ?? null
    : null;
  const breakActive = Boolean(
    previousRound?.intermissionEndsAt && previousRound.intermissionEndsAt > now,
  );

  function patch<K extends keyof GameNightSettingsSummary>(
    key: K,
    value: GameNightSettingsSummary[K],
  ) {
    setSettings((current) => ({ ...current, [key]: value }));
  }

  function toggleIntermission(roundNumber: number) {
    const current = resolved.intermissionAfterRounds;
    patch(
      "intermissionAfterRounds",
      current.includes(roundNumber)
        ? current.filter((round) => round !== roundNumber)
        : [...current, roundNumber].sort((a, b) => a - b),
    );
  }

  const canEditRules =
    gameNight.status !== "active" && gameNight.status !== "completed";
  const finalRound = rounds.find(
    (round) => round.roundNumber === resolved.roundCount,
  );
  const finalRoundComplete = finalRound?.completedAt != null;

  return (
    <section className="rounded-2xl border border-[var(--color-panel-border)] bg-[var(--color-panel)] p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold">Fixture & Round Control</h2>
          <p className="mt-1 text-sm text-[var(--color-text-muted)]">
            Synchronized rounds keep every board together. The next round is
            prepared as a draft before it becomes playable.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <GameNightScheduleButton gameNight={gameNight} />
          <div className="rounded-full border border-[var(--color-panel-border)] px-3 py-1 text-xs font-bold uppercase">
            {gameNight.completedRoundCount ?? 0} / {resolved.roundCount} rounds
            complete
          </div>
        </div>
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-[var(--color-panel-border)] bg-[var(--color-panel-soft)] p-4">
          <h3 className="font-bold">Round Rules</h3>
          <div className="mt-3 rounded-xl border border-[var(--color-primary)]/40 bg-[var(--color-panel)] p-3">
            <div className="text-sm font-black">Common league format</div>
            <p className="mt-1 text-xs text-[var(--color-text-muted)]">
              Three rounds can represent three individual legs while keeping the same opponents.
              A scheduled round break then doubles as the between-leg intermission.
            </p>
            <button
              type="button"
              disabled={disabled || !canEditRules}
              onClick={() =>
                setSettings((current) => ({
                  ...current,
                  roundCount: 3,
                  pairingStrategy: "fixed",
                  legsPerMatch: 1,
                  intermissionAfterRounds: [2],
                  intermissionDurationMinutes: 10,
                }))
              }
              className="mt-3 rounded-lg border border-[var(--color-primary)] px-3 py-2 text-sm font-black text-[var(--color-primary)] disabled:opacity-50"
            >
              Use 3 rounds × 1 leg · same matchups
            </button>
            <div className="mt-2 text-xs text-[var(--color-text-muted)]">
              Sets a 10-minute break after Round 2. Save Fixture Rules to apply it.
            </div>
          </div>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <label className="text-sm">
              Rounds per Game Night
              <input
                type="number"
                min={1}
                max={32}
                disabled={disabled || !canEditRules}
                value={resolved.roundCount}
                onChange={(event) =>
                  patch("roundCount", Number(event.target.value))
                }
                className="mt-1 w-full rounded-xl border border-[var(--color-panel-border)] bg-[var(--color-panel)] p-2.5"
              />
            </label>

            <label className="text-sm">
              Pairing method
              <select
                disabled={disabled || !canEditRules}
                value={resolved.pairingStrategy}
                onChange={(event) =>
                  patch(
                    "pairingStrategy",
                    event.target.value as FixturePairingStrategy,
                  )
                }
                className="mt-1 w-full rounded-xl border border-[var(--color-panel-border)] bg-[var(--color-panel)] p-2.5"
              >
                <option value="random">Random · avoid rematches</option>
                <option value="fixed">Fixed matchups · repeat Round 1</option>
                <option value="round_robin">Round robin</option>
                <option value="swiss">Swiss · current-night record</option>
                <option value="manual">Manual coordinator</option>
              </select>
            </label>

            <label className="text-sm">
              Round advance
              <select
                disabled={disabled || !canEditRules}
                value={resolved.roundAdvanceMode}
                onChange={(event) =>
                  patch(
                    "roundAdvanceMode",
                    event.target.value as "manual" | "automatic",
                  )
                }
                className="mt-1 w-full rounded-xl border border-[var(--color-panel-border)] bg-[var(--color-panel)] p-2.5"
              >
                <option value="manual">Coordinator starts next round</option>
                <option value="automatic">Automatic after delay</option>
              </select>
            </label>

            <label className="text-sm">
              Automatic delay (seconds)
              <input
                type="number"
                min={0}
                max={3600}
                disabled={
                  disabled ||
                  !canEditRules ||
                  resolved.roundAdvanceMode !== "automatic"
                }
                value={resolved.roundAdvanceDelaySeconds}
                onChange={(event) =>
                  patch(
                    "roundAdvanceDelaySeconds",
                    Number(event.target.value),
                  )
                }
                className="mt-1 w-full rounded-xl border border-[var(--color-panel-border)] bg-[var(--color-panel)] p-2.5 disabled:opacity-50"
              />
            </label>
          </div>

          {resolved.roundCount > 1 && (
            <div className="mt-4">
              <div className="text-sm font-bold">Scheduled intermissions</div>
              <div className="mt-2 flex flex-wrap gap-2">
                {Array.from(
                  { length: resolved.roundCount - 1 },
                  (_, index) => index + 1,
                ).map((roundNumber) => (
                  <label
                    key={roundNumber}
                    className="flex items-center gap-2 rounded-lg border border-[var(--color-panel-border)] px-3 py-2 text-sm"
                  >
                    <input
                      type="checkbox"
                      disabled={disabled || !canEditRules}
                      checked={resolved.intermissionAfterRounds.includes(
                        roundNumber,
                      )}
                      onChange={() => toggleIntermission(roundNumber)}
                    />
                    After Round {roundNumber}
                  </label>
                ))}
              </div>
              <label className="mt-3 block text-sm sm:max-w-xs">
                Intermission duration (minutes)
                <input
                  type="number"
                  min={0}
                  max={180}
                  disabled={disabled || !canEditRules}
                  value={resolved.intermissionDurationMinutes}
                  onChange={(event) =>
                    patch(
                      "intermissionDurationMinutes",
                      Number(event.target.value),
                    )
                  }
                  className="mt-1 w-full rounded-xl border border-[var(--color-panel-border)] bg-[var(--color-panel)] p-2.5"
                />
              </label>
            </div>
          )}

          <button
            type="button"
            disabled={disabled || !canEditRules}
            onClick={() =>
              void onAction(
                {
                  action: "settings",
                  gameNightId: gameNight.id,
                  settings: resolveGameNightSettings(settings),
                },
                "Fixture rules saved. Teams/boards can now be rebuilt with the new round format.",
              )
            }
            className="mt-4 rounded-xl bg-[var(--color-primary)] px-4 py-2.5 font-bold text-white disabled:opacity-50"
          >
            Save Fixture Rules
          </button>
          {!canEditRules && (
            <p className="mt-2 text-xs text-amber-100">
              Fixture rules lock once the Game Night has started.
            </p>
          )}
        </div>

        <div className="rounded-xl border border-[var(--color-panel-border)] bg-[var(--color-panel-soft)] p-4">
          <h3 className="font-bold">Team Availability</h3>
          <p className="mt-1 text-xs text-[var(--color-text-muted)]">
            A withdrawn team is omitted from future draft rounds. Its currently
            playable match must finish first.
          </p>
          <div className="mt-3 space-y-2">
            {gameNight.teams.map((team) => (
              <div
                key={team.id}
                className="flex items-center justify-between gap-3 rounded-lg border border-[var(--color-panel-border)] bg-[var(--color-panel)] p-3"
              >
                <div>
                  <div className="font-bold">{team.name}</div>
                  <div className="text-xs uppercase text-[var(--color-text-muted)]">
                    {team.status === "withdrawn" ? "Withdrawn" : "Active"}
                  </div>
                </div>
                <button
                  type="button"
                  disabled={disabled}
                  onClick={() =>
                    void onAction(
                      {
                        action: "teamStatus",
                        gameNightId: gameNight.id,
                        teamId: team.id,
                        status:
                          team.status === "withdrawn" ? "active" : "withdrawn",
                      },
                      `${team.name} ${
                        team.status === "withdrawn"
                          ? "returned to"
                          : "withdrawn from"
                      } future rounds.`,
                    )
                  }
                  className="rounded-lg border border-[var(--color-panel-border)] px-3 py-2 text-sm font-bold disabled:opacity-50"
                >
                  {team.status === "withdrawn" ? "Reactivate" : "Withdraw"}
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-5 space-y-4">
        {rounds.map((round) => (
          <div
            key={round.roundNumber}
            className="rounded-xl border border-[var(--color-panel-border)] bg-[var(--color-panel-soft)] p-4"
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h3 className="text-lg font-bold">Round {round.roundNumber}</h3>
                <div className="mt-1 text-xs uppercase tracking-wide text-[var(--color-text-muted)]">
                  {round.status}
                  {round.intermissionEndsAt && round.intermissionEndsAt > now
                    ? ` · break ${formatRemaining(round.intermissionEndsAt, now)} remaining`
                    : ""}
                </div>
              </div>
              <div className="text-xs text-[var(--color-text-muted)]">
                {strategyLabel(resolved.pairingStrategy)}
              </div>
            </div>

            <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {round.pairings.map((pairing) => {
                const board = boardById.get(pairing.boardId);
                const teamA = teamById.get(pairing.teamAId);
                const teamB = teamById.get(pairing.teamBId);
                const winner = teamById.get(pairing.winnerTeamId ?? "");
                const scorerAvailable =
                  pairing.matchSessionId && pairing.status !== "draft";
                return (
                  <div
                    key={pairing.id}
                    className="rounded-lg border border-[var(--color-panel-border)] bg-[var(--color-panel)] p-3"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-bold">
                        {board?.name ?? `Board ${pairing.boardNumber}`}
                      </span>
                      <span className="text-[10px] font-bold uppercase text-[var(--color-text-muted)]">
                        {pairing.matchStatus ?? pairing.status}
                      </span>
                    </div>
                    <div className="mt-2 text-sm font-semibold">
                      {teamA?.name ?? pairing.teamAId} vs{" "}
                      {teamB?.name ?? pairing.teamBId}
                    </div>
                    {winner && (
                      <div className="mt-1 text-xs font-bold text-emerald-300">
                        Winner: {winner.name}
                      </div>
                    )}
                    {scorerAvailable && (
                      <Link
                        href={`/league-match/${pairing.matchSessionId}`}
                        className="mt-3 inline-flex rounded-lg border border-[var(--color-panel-border)] px-3 py-2 text-xs font-bold"
                      >
                        {pairing.matchStatus === "completed"
                          ? "View Match"
                          : "Open Scorer"}
                      </Link>
                    )}
                  </div>
                );
              })}
            </div>

            {round.byeTeamIds.length > 0 && (
              <div className="mt-3 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-100">
                Bye / waiting:{" "}
                {round.byeTeamIds
                  .map((id) => teamById.get(id)?.name ?? id)
                  .join(", ")}
              </div>
            )}
          </div>
        ))}
        {!rounds.length && (
          <p className="rounded-xl border border-dashed border-[var(--color-panel-border)] p-4 text-sm text-[var(--color-text-muted)]">
            Prepare teams and populate boards to generate Round 1.
          </p>
        )}
      </div>

      {draftRound && (
        <GameNightDraftRoundEditor
          key={draftRound.pairings.map((pairing) => pairing.id).join(":")}
          gameNightId={gameNight.id}
          gameNightStatus={gameNight.status}
          round={draftRound}
          previousRound={previousRound}
          boards={gameNight.boards}
          activeTeams={activeTeams}
          settings={resolved}
          breakActive={breakActive}
          disabled={disabled}
          onAction={onAction}
        />
      )}

      {finalRoundComplete && (
        <div className="mt-5 rounded-xl border border-emerald-500/40 bg-emerald-500/10 p-4 text-sm text-emerald-100">
          All {resolved.roundCount} scheduled rounds are complete. The
          coordinator can now complete the Game Night.
        </div>
      )}
    </section>
  );
}
