"use client";

import { useState } from "react";
import { DartThrow } from "@/lib/scoring";

type DartEntryProps = {
  message: string;
  compact: boolean;
  submitDartTurn: (darts: DartThrow[]) => void;
  undoLastTurn: () => void;
  startNextLeg: () => void;
  replayMatch: () => void;
  newGameSetup: () => void;
  viewFinishedGame: () => void;
  isLegComplete: boolean;
  isMatchComplete: boolean;
};

type DartMultiplier = 1 | 2 | 3;

const numberSegments = Array.from({ length: 20 }, (_, index) => index + 1);

function getDartLabel(dart: DartThrow) {
  if (dart.segment === "miss") {
    return "Miss";
  }

  if (dart.segment === "outer-bull") {
    return "Outer Bull";
  }

  if (dart.segment === "bull") {
    return "Bull";
  }

  const prefix =
    dart.multiplier === 3 ? "T" : dart.multiplier === 2 ? "D" : "S";

  return `${prefix}${dart.segment}`;
}

function createNumberDart(
  segment: number,
  multiplier: DartMultiplier,
): DartThrow {
  return {
    id: crypto.randomUUID(),
    segment,
    multiplier,
    score: segment * multiplier,
  };
}

function createSpecialDart(segment: "outer-bull" | "bull" | "miss"): DartThrow {
  if (segment === "outer-bull") {
    return {
      id: crypto.randomUUID(),
      segment,
      multiplier: 1,
      score: 25,
    };
  }

  if (segment === "bull") {
    return {
      id: crypto.randomUUID(),
      segment,
      multiplier: 2,
      score: 50,
    };
  }

  return {
    id: crypto.randomUUID(),
    segment,
    multiplier: 0,
    score: 0,
  };
}

export function DartEntry({
  message,
  compact,
  submitDartTurn,
  undoLastTurn,
  startNextLeg,
  replayMatch,
  newGameSetup,
  viewFinishedGame,
  isLegComplete,
  isMatchComplete,
}: DartEntryProps) {
  const [selectedMultiplier, setSelectedMultiplier] =
    useState<DartMultiplier | null>(null);
  const [currentDarts, setCurrentDarts] = useState<DartThrow[]>([]);

  const turnTotal = currentDarts.reduce((total, dart) => total + dart.score, 0);
  const canAddDart = currentDarts.length < 3;

  function addDart(dart: DartThrow) {
    if (!canAddDart) {
      return;
    }

    setCurrentDarts((previousDarts) => [...previousDarts, dart]);
    setSelectedMultiplier(null);
  }

  function undoDart() {
    setCurrentDarts((previousDarts) => previousDarts.slice(0, -1));
  }

  function clearDarts() {
    setCurrentDarts([]);
  }

  function handleSubmitTurn() {
    if (currentDarts.length === 0) {
      return;
    }

    submitDartTurn(currentDarts);
    setCurrentDarts([]);
    setSelectedMultiplier(null);
  }

  return (
    <section
      className={`rounded-2xl bg-[var(--color-panel)] border border-[var(--color-panel-border)] mb-8 ${
        compact ? "p-4" : "p-6"
      }`}
    >
      <div className={compact ? "text-lg mb-3" : "text-xl mb-4"}>{message}</div>

      {isMatchComplete && (
        <div className="rounded-2xl bg-[var(--color-panel-soft)] border border-[var(--color-panel-border)] p-4 mb-4">
          <div className="text-lg font-bold mb-4">Match complete</div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <button
              onClick={replayMatch}
              className="rounded-xl bg-[var(--color-success)] hover:bg-[var(--color-success-hover)] p-4 text-xl font-bold"
            >
              Replay Match
            </button>

            <button
              onClick={newGameSetup}
              className="rounded-xl bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] p-4 text-xl font-bold"
            >
              New Game / Setup
            </button>

            <button
              onClick={viewFinishedGame}
              className="rounded-xl bg-[var(--color-accent)] hover:bg-[var(--color-accent-hover)] p-4 text-xl font-bold"
            >
              View Match History
            </button>
          </div>
        </div>
      )}

      {isLegComplete && !isMatchComplete && (
        <div className="mb-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
          <button
            onClick={undoLastTurn}
            className="rounded-xl bg-[var(--color-warning)] hover:bg-[var(--color-warning-hover)] p-4 text-xl font-bold"
          >
            Undo Last Turn
          </button>

          <button
            onClick={startNextLeg}
            className="rounded-xl bg-[var(--color-accent)] hover:bg-[var(--color-accent-hover)] p-4 text-xl font-bold"
          >
            Start Next Leg
          </button>
        </div>
      )}

      {!isLegComplete && !isMatchComplete && (
        <div className="rounded-2xl bg-[var(--color-panel-soft)] border border-[var(--color-panel-border)] p-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
            <div>
              <div className="text-xl font-bold">Dart-by-Dart Entry</div>
              <div className="text-[var(--color-text-muted)]">
                Dart {Math.min(currentDarts.length + 1, 3)} of 3
              </div>
            </div>

            <div className="rounded-xl bg-[var(--color-panel)] border border-[var(--color-panel-border)] px-4 py-3">
              <span className="text-[var(--color-text-muted)]">
                Turn total:{" "}
              </span>
              <span className="text-2xl font-bold">{turnTotal}</span>
            </div>
          </div>

          <div className="mb-4">
            <div className="mb-2 text-[var(--color-text-muted)]">
              Multiplier
            </div>

            <div className="grid grid-cols-3 gap-3">
              <button
                onClick={() => setSelectedMultiplier(1)}
                className={`rounded-xl border border-[var(--color-panel-border)] p-3 font-bold ${
                  selectedMultiplier === 1
                    ? "bg-[var(--color-primary)]"
                    : "bg-[var(--color-panel)] hover:bg-[var(--color-panel-border)]"
                }`}
              >
                Single
              </button>

              <button
                onClick={() => setSelectedMultiplier(2)}
                className={`rounded-xl border border-[var(--color-panel-border)] p-3 font-bold ${
                  selectedMultiplier === 2
                    ? "bg-[var(--color-primary)]"
                    : "bg-[var(--color-panel)] hover:bg-[var(--color-panel-border)]"
                }`}
              >
                Double
              </button>

              <button
                onClick={() => setSelectedMultiplier(3)}
                className={`rounded-xl border border-[var(--color-panel-border)] p-3 font-bold ${
                  selectedMultiplier === 3
                    ? "bg-[var(--color-primary)]"
                    : "bg-[var(--color-panel)] hover:bg-[var(--color-panel-border)]"
                }`}
              >
                Triple
              </button>
            </div>
          </div>

          {!selectedMultiplier && canAddDart && (
            <div className="mt-2 text-sm text-[var(--color-text-muted)]">
              Select Single, Double, or Triple before choosing a number.
            </div>
          )}

          <div className="mb-4">
            <div className="mb-2 text-[var(--color-text-muted)]">Segment</div>

            <div className="grid grid-cols-5 gap-2">
              {numberSegments.map((segment) => (
                <button
                  key={segment}
                  onClick={() => {
                    if (!selectedMultiplier) {
                      return;
                    }

                    addDart(createNumberDart(segment, selectedMultiplier));
                  }}
                  disabled={!canAddDart || !selectedMultiplier}
                  className="rounded-xl bg-[var(--color-panel)] hover:bg-[var(--color-panel-border)] disabled:opacity-40 disabled:hover:bg-[var(--color-panel)] border border-[var(--color-panel-border)] p-3 font-bold"
                >
                  {segment}
                </button>
              ))}
            </div>
          </div>

          <div className="mb-4 grid grid-cols-3 gap-3">
            <button
              onClick={() => addDart(createSpecialDart("outer-bull"))}
              disabled={!canAddDart}
              className="rounded-xl bg-[var(--color-panel)] hover:bg-[var(--color-panel-border)] disabled:opacity-40 disabled:hover:bg-[var(--color-panel)] border border-[var(--color-panel-border)] p-3 font-bold"
            >
              Outer Bull
            </button>

            <button
              onClick={() => addDart(createSpecialDart("bull"))}
              disabled={!canAddDart}
              className="rounded-xl bg-[var(--color-panel)] hover:bg-[var(--color-panel-border)] disabled:opacity-40 disabled:hover:bg-[var(--color-panel)] border border-[var(--color-panel-border)] p-3 font-bold"
            >
              Bull
            </button>

            <button
              onClick={() => addDart(createSpecialDart("miss"))}
              disabled={!canAddDart}
              className="rounded-xl bg-[var(--color-panel)] hover:bg-[var(--color-panel-border)] disabled:opacity-40 disabled:hover:bg-[var(--color-panel)] border border-[var(--color-panel-border)] p-3 font-bold"
            >
              Miss
            </button>
          </div>

          <div className="mb-4">
            <div className="mb-2 text-[var(--color-text-muted)]">
              Current darts
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {[0, 1, 2].map((index) => {
                const dart = currentDarts[index];

                return (
                  <div
                    key={index}
                    className="rounded-xl bg-[var(--color-panel)] border border-[var(--color-panel-border)] p-3"
                  >
                    <div className="text-sm text-[var(--color-text-muted)]">
                      Dart {index + 1}
                    </div>
                    <div className="text-xl font-bold">
                      {dart ? getDartLabel(dart) : "—"}
                    </div>
                    <div className="text-[var(--color-text-muted)]">
                      {dart ? `${dart.score} points` : ""}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <button
              onClick={undoDart}
              disabled={currentDarts.length === 0}
              className="rounded-xl bg-[var(--color-warning)] hover:bg-[var(--color-warning-hover)] disabled:opacity-40 p-3 font-bold"
            >
              Undo Dart
            </button>

            <button
              onClick={clearDarts}
              disabled={currentDarts.length === 0}
              className="rounded-xl bg-[var(--color-panel-border)] hover:bg-[var(--color-panel)] disabled:opacity-40 p-3 font-bold"
            >
              Clear Darts
            </button>

            <button
              onClick={handleSubmitTurn}
              disabled={currentDarts.length === 0}
              className="rounded-xl bg-[var(--color-success)] hover:bg-[var(--color-success-hover)] disabled:opacity-40 p-3 font-bold"
            >
              Submit Turn
            </button>
          </div>

          <button
            onClick={undoLastTurn}
            className="mt-3 w-full rounded-xl bg-[var(--color-warning)] hover:bg-[var(--color-warning-hover)] p-3 font-bold"
          >
            Undo Last Turn
          </button>
        </div>
      )}
    </section>
  );
}
