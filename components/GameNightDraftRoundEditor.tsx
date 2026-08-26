"use client";

import { useState } from "react";

import type {
  GameNightBoardSummary,
  GameNightRoundSummary,
  GameNightTeamSummary,
  ResolvedGameNightSettings,
} from "@/lib/league/gameNightContracts";
import type { FixtureRoundPairing } from "@/lib/league/fixtureEngine";

type FixtureAction = (body: object, message?: string) => Promise<void> | void;

function strategyLabel(strategy: ResolvedGameNightSettings["pairingStrategy"]) {
  if (strategy === "round_robin") return "Round robin";
  if (strategy === "swiss") return "Swiss · current-night record";
  if (strategy === "manual") return "Manual coordinator draft";
  return "Random · avoid rematches";
}

export function GameNightDraftRoundEditor({
  gameNightId,
  gameNightStatus,
  round,
  previousRound,
  boards,
  activeTeams,
  settings,
  breakActive,
  disabled,
  onAction,
}: {
  gameNightId: string;
  gameNightStatus: string;
  round: GameNightRoundSummary;
  previousRound: GameNightRoundSummary | null;
  boards: GameNightBoardSummary[];
  activeTeams: GameNightTeamSummary[];
  settings: ResolvedGameNightSettings;
  breakActive: boolean;
  disabled: boolean;
  onAction: FixtureAction;
}) {
  const [fixtureDraft, setFixtureDraft] = useState<FixtureRoundPairing[]>(() =>
    round.pairings.map((pairing) => ({
      boardId: pairing.boardId,
      teamAId: pairing.teamAId,
      teamBId: pairing.teamBId,
    })),
  );

  function updateFixture(
    index: number,
    key: keyof FixtureRoundPairing,
    value: string,
  ) {
    setFixtureDraft((current) =>
      current.map((pairing, pairingIndex) =>
        pairingIndex === index ? { ...pairing, [key]: value } : pairing,
      ),
    );
  }

  return (
    <div className="mt-5 rounded-xl border border-[var(--color-primary)] bg-[var(--color-panel-soft)] p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-lg font-bold">Edit Round {round.roundNumber} Draft</h3>
          <p className="mt-1 text-sm text-[var(--color-text-muted)]">
            Change teams or boards before this round is released. Duplicate
            teams or boards are rejected when saved.
          </p>
        </div>
        <button
          type="button"
          disabled={disabled}
          onClick={() =>
            void onAction(
              {
                action: "regenerateRound",
                gameNightId,
                roundNumber: round.roundNumber,
                strategy: settings.pairingStrategy,
              },
              `Round ${round.roundNumber} regenerated using ${strategyLabel(settings.pairingStrategy)}.`,
            )
          }
          className="rounded-lg border border-[var(--color-panel-border)] px-3 py-2 text-sm font-bold disabled:opacity-50"
        >
          Regenerate Round
        </button>
      </div>

      <div className="mt-4 space-y-3">
        {fixtureDraft.map((pairing, index) => (
          <div
            key={`${round.roundNumber}-${index}`}
            className="grid gap-2 rounded-lg border border-[var(--color-panel-border)] bg-[var(--color-panel)] p-3 md:grid-cols-3"
          >
            <select
              value={pairing.boardId}
              disabled={disabled}
              onChange={(event) => updateFixture(index, "boardId", event.target.value)}
              className="rounded-lg border border-[var(--color-panel-border)] bg-[var(--color-panel-soft)] p-2"
            >
              {boards.map((board) => (
                <option key={board.id} value={board.id}>
                  {board.name}
                </option>
              ))}
            </select>
            <select
              value={pairing.teamAId}
              disabled={disabled}
              onChange={(event) => updateFixture(index, "teamAId", event.target.value)}
              className="rounded-lg border border-[var(--color-panel-border)] bg-[var(--color-panel-soft)] p-2"
            >
              {activeTeams.map((team) => (
                <option key={team.id} value={team.id}>
                  {team.name}
                </option>
              ))}
            </select>
            <select
              value={pairing.teamBId}
              disabled={disabled}
              onChange={(event) => updateFixture(index, "teamBId", event.target.value)}
              className="rounded-lg border border-[var(--color-panel-border)] bg-[var(--color-panel-soft)] p-2"
            >
              {activeTeams.map((team) => (
                <option key={team.id} value={team.id}>
                  {team.name}
                </option>
              ))}
            </select>
          </div>
        ))}
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          disabled={disabled}
          onClick={() =>
            void onAction(
              {
                action: "replaceRoundFixtures",
                gameNightId,
                roundNumber: round.roundNumber,
                pairings: fixtureDraft,
              },
              `Round ${round.roundNumber} fixture edits saved.`,
            )
          }
          className="rounded-xl bg-[var(--color-primary)] px-4 py-2.5 font-bold text-white disabled:opacity-50"
        >
          Save Fixture Edits
        </button>

        {gameNightStatus === "active" && previousRound?.completedAt && (
          <button
            type="button"
            disabled={disabled}
            onClick={() =>
              void onAction(
                {
                  action: "startNextRound",
                  gameNightId,
                  endIntermissionEarly: breakActive,
                },
                breakActive
                  ? `Intermission ended. Round ${round.roundNumber} is now live.`
                  : `Round ${round.roundNumber} is now live.`,
              )
            }
            className="rounded-xl bg-emerald-600 px-4 py-2.5 font-bold text-white disabled:opacity-50"
          >
            {breakActive
              ? `End Intermission & Start Round ${round.roundNumber}`
              : `Start Round ${round.roundNumber}`}
          </button>
        )}
      </div>

      {gameNightStatus === "active" &&
        settings.roundAdvanceMode === "automatic" &&
        previousRound?.completedAt &&
        !breakActive && (
          <p className="mt-3 text-xs text-[var(--color-text-muted)]">
            Automatic mode releases this round after {settings.roundAdvanceDelaySeconds}s.
            A coordinator can still start it early.
          </p>
        )}
    </div>
  );
}
