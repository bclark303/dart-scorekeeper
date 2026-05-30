"use client";

import { useState } from "react";
import { DartThrow } from "@/lib/scoring";
import { getDartLabel } from "@/lib/darts";

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

type NumberRing = "single-inner" | "triple" | "single-outer" | "double";

type BoardTarget = {
  segment: number;
  multiplier: 1 | 2 | 3;
  ring: NumberRing;
  label: string;
  score: number;
  path: string;
  centerAngle: number;
};

const boardNumbers = [
  20, 1, 18, 4, 13, 6, 10, 15, 2, 17, 3, 19, 7, 16, 8, 11, 14, 9, 12, 5,
];

const boardCenter = 120;
const boardSize = 240;

const ringDefinitions: Array<{
  ring: NumberRing;
  multiplier: 1 | 2 | 3;
  innerRadius: number;
  outerRadius: number;
}> = [
  { ring: "double", multiplier: 2, innerRadius: 92, outerRadius: 102 },
  { ring: "single-outer", multiplier: 1, innerRadius: 60, outerRadius: 90 },
  { ring: "triple", multiplier: 3, innerRadius: 48, outerRadius: 58 },
  { ring: "single-inner", multiplier: 1, innerRadius: 17, outerRadius: 46 },
];

function getRandomId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function polarToCartesian(radius: number, angleDegrees: number) {
  const angleRadians = (angleDegrees * Math.PI) / 180;

  return {
    x: boardCenter + radius * Math.cos(angleRadians),
    y: boardCenter + radius * Math.sin(angleRadians),
  };
}

function describeAnnularSector(
  innerRadius: number,
  outerRadius: number,
  startAngle: number,
  endAngle: number,
) {
  const outerStart = polarToCartesian(outerRadius, startAngle);
  const outerEnd = polarToCartesian(outerRadius, endAngle);
  const innerEnd = polarToCartesian(innerRadius, endAngle);
  const innerStart = polarToCartesian(innerRadius, startAngle);
  const largeArcFlag = endAngle - startAngle <= 180 ? 0 : 1;

  return [
    `M ${outerStart.x} ${outerStart.y}`,
    `A ${outerRadius} ${outerRadius} 0 ${largeArcFlag} 1 ${outerEnd.x} ${outerEnd.y}`,
    `L ${innerEnd.x} ${innerEnd.y}`,
    `A ${innerRadius} ${innerRadius} 0 ${largeArcFlag} 0 ${innerStart.x} ${innerStart.y}`,
    "Z",
  ].join(" ");
}

function getRingPrefix(ring: NumberRing) {
  if (ring === "double") {
    return "D";
  }

  if (ring === "triple") {
    return "T";
  }

  return "S";
}

function getBoardFillClass(target: BoardTarget) {
  const isEvenPosition = boardNumbers.indexOf(target.segment) % 2 === 0;

  if (target.ring === "double" || target.ring === "triple") {
    return isEvenPosition ? "fill-[#b3261e]" : "fill-[#2e7d32]";
  }

  return isEvenPosition ? "fill-[#1f1f1f]" : "fill-[#eadfbf]";
}

function getRingClass(target: BoardTarget, canAddDart: boolean) {
  const disabledClass = canAddDart
    ? "cursor-pointer active:brightness-150 hover:brightness-125"
    : "cursor-not-allowed opacity-40";

  return `${disabledClass} ${getBoardFillClass(
    target,
  )} stroke-[var(--color-background)] stroke-[0.65] transition-[filter,opacity]`;
}

function createNumberDart(target: BoardTarget): DartThrow {
  return {
    id: getRandomId(),
    segment: target.segment,
    multiplier: target.multiplier,
    score: target.score,
  };
}

function createSpecialDart(segment: "outer-bull" | "bull" | "miss"): DartThrow {
  if (segment === "outer-bull") {
    return {
      id: getRandomId(),
      segment,
      multiplier: 1,
      score: 25,
    };
  }

  if (segment === "bull") {
    return {
      id: getRandomId(),
      segment,
      multiplier: 2,
      score: 50,
    };
  }

  return {
    id: getRandomId(),
    segment,
    multiplier: 0,
    score: 0,
  };
}

const boardTargets: BoardTarget[] = boardNumbers.flatMap((segment, index) => {
  const centerAngle = -90 + index * 18;
  const startAngle = centerAngle - 9;
  const endAngle = centerAngle + 9;

  return ringDefinitions.map((ringDefinition) => ({
    segment,
    multiplier: ringDefinition.multiplier,
    ring: ringDefinition.ring,
    label: `${getRingPrefix(ringDefinition.ring)}${segment}`,
    score: segment * ringDefinition.multiplier,
    path: describeAnnularSector(
      ringDefinition.innerRadius,
      ringDefinition.outerRadius,
      startAngle,
      endAngle,
    ),
    centerAngle,
  }));
});

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
  const [currentDarts, setCurrentDarts] = useState<DartThrow[]>([]);

  const turnTotal = currentDarts.reduce((total, dart) => total + dart.score, 0);
  const canAddDart = currentDarts.length < 3;
  const nextDartNumber = Math.min(currentDarts.length + 1, 3);
  const isTurnReady = currentDarts.length === 3;

  function addDart(dart: DartThrow) {
    if (!canAddDart) {
      return;
    }

    setCurrentDarts((previousDarts) => [...previousDarts, dart]);
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
  }

  return (
    <section
      className={`rounded-2xl bg-[var(--color-panel)] border border-[var(--color-panel-border)] mb-4 ${
        compact ? "p-3" : "p-6"
      }`}
    >
      <div className={compact ? "text-base mb-2" : "text-xl mb-4"}>{message}</div>

      {isMatchComplete && (
        <div className="rounded-2xl bg-[var(--color-panel-soft)] border border-[var(--color-panel-border)] p-4 mb-4">
          <div className="text-lg font-bold mb-4">Match complete</div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <button
              onClick={undoLastTurn}
              className="rounded-xl bg-[var(--color-warning)] hover:bg-[var(--color-warning-hover)] p-4 text-xl font-bold"
            >
              Undo Last Turn
            </button>

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
        <div className="rounded-2xl bg-[var(--color-panel-soft)] border border-[var(--color-panel-border)] p-3">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div>
              <div className={compact ? "text-base font-bold" : "text-xl font-bold"}>
                Board Entry
              </div>
              <div className="text-sm text-[var(--color-text-muted)]">
                {isTurnReady ? "Ready to submit" : `Dart ${nextDartNumber} of 3`}
              </div>
            </div>

            <div className="rounded-xl bg-[var(--color-panel)] border border-[var(--color-panel-border)] px-3 py-2 text-right">
              <div className="text-xs text-[var(--color-text-muted)]">Turn total</div>
              <div className={compact ? "text-xl font-bold" : "text-2xl font-bold"}>
                {turnTotal}
              </div>
            </div>
          </div>

          <div
            className={
              compact
                ? "grid grid-cols-1 gap-2"
                : "grid grid-cols-[minmax(260px,380px)_1fr] gap-5 items-start"
            }
          >
            <div className={`rounded-2xl bg-[var(--color-panel)] border border-[var(--color-panel-border)] ${compact ? "p-1" : "p-2"}`}>
              <svg
                viewBox={`0 0 ${boardSize} ${boardSize}`}
                role="img"
                aria-label="Tap a dartboard segment to add a dart"
                className={`mx-auto aspect-square w-full select-none touch-manipulation ${
                  compact ? "max-w-[315px]" : "max-w-[380px]"
                }`}
              >
                <circle
                  cx={boardCenter}
                  cy={boardCenter}
                  r="112"
                  className="fill-[var(--color-background)] stroke-[var(--color-panel-border)] stroke-[2]"
                />

                {boardNumbers.map((segment, index) => {
                  const angle = -90 + index * 18;
                  const labelPoint = polarToCartesian(112, angle);

                  return (
                    <text
                      key={segment}
                      x={labelPoint.x}
                      y={labelPoint.y}
                      textAnchor="middle"
                      dominantBaseline="middle"
                      className="pointer-events-none fill-[var(--color-text-muted)] text-[8px] font-bold"
                    >
                      {segment}
                    </text>
                  );
                })}

                {boardTargets.map((target) => (
                  <path
                    key={`${target.label}-${target.ring}`}
                    d={target.path}
                    role="button"
                    aria-label={`${target.label}, ${target.score} points`}
                    tabIndex={canAddDart ? 0 : -1}
                    onClick={() => addDart(createNumberDart(target))}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        addDart(createNumberDart(target));
                      }
                    }}
                    className={getRingClass(target, canAddDart)}
                  />
                ))}

                <circle
                  cx={boardCenter}
                  cy={boardCenter}
                  r="15"
                  role="button"
                  aria-label="Outer Bull, 25 points"
                  tabIndex={canAddDart ? 0 : -1}
                  onClick={() => addDart(createSpecialDart("outer-bull"))}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      addDart(createSpecialDart("outer-bull"));
                    }
                  }}
                  className={`fill-[#2e7d32] hover:brightness-125 active:brightness-150 stroke-[var(--color-background)] stroke-[1] transition-[filter,opacity] ${
                    canAddDart ? "cursor-pointer" : "cursor-not-allowed opacity-40"
                  }`}
                />

                <circle
                  cx={boardCenter}
                  cy={boardCenter}
                  r="7"
                  role="button"
                  aria-label="Bull, 50 points"
                  tabIndex={canAddDart ? 0 : -1}
                  onClick={() => addDart(createSpecialDart("bull"))}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      addDart(createSpecialDart("bull"));
                    }
                  }}
                  className={`fill-[#b3261e] hover:brightness-125 active:brightness-150 stroke-[var(--color-background)] stroke-[1] transition-[filter,opacity] ${
                    canAddDart ? "cursor-pointer" : "cursor-not-allowed opacity-40"
                  }`}
                />
              </svg>
            </div>

            <div className={compact ? "space-y-2" : "space-y-3"}>
              <div className={`rounded-xl bg-[var(--color-panel)] border border-[var(--color-panel-border)] ${compact ? "p-2" : "p-3"}`}>
                <div className="mb-2 text-sm text-[var(--color-text-muted)]">
                  Current darts
                </div>

                <div className="grid grid-cols-3 gap-2">
                  {[0, 1, 2].map((index) => {
                    const dart = currentDarts[index];

                    return (
                      <div
                        key={index}
                        className={`rounded-lg bg-[var(--color-panel-soft)] border border-[var(--color-panel-border)] px-2 text-center ${
                          compact ? "py-1" : "py-2"
                        }`}
                      >
                        <div className="text-xs text-[var(--color-text-muted)]">
                          Dart {index + 1}
                        </div>
                        <div className="font-bold">
                          {dart ? getDartLabel(dart) : "—"}
                        </div>
                        <div className="text-xs text-[var(--color-text-muted)]">
                          {dart ? dart.score : ""}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <button
                  onClick={() => addDart(createSpecialDart("miss"))}
                  disabled={!canAddDart}
                  className={`rounded-xl bg-[var(--color-panel)] hover:bg-[var(--color-panel-border)] disabled:opacity-40 disabled:hover:bg-[var(--color-panel)] border border-[var(--color-panel-border)] font-bold ${
                    compact ? "p-2" : "p-3"
                  }`}
                >
                  Miss
                </button>

                <button
                  onClick={() => addDart(createSpecialDart("outer-bull"))}
                  disabled={!canAddDart}
                  className={`rounded-xl bg-[#2e7d32] hover:brightness-125 disabled:opacity-40 text-white font-bold ${
                    compact ? "p-2" : "p-3"
                  }`}
                >
                  25
                </button>

                <button
                  onClick={() => addDart(createSpecialDart("bull"))}
                  disabled={!canAddDart}
                  className={`rounded-xl bg-[#b3261e] hover:brightness-125 disabled:opacity-40 text-white font-bold ${
                    compact ? "p-2" : "p-3"
                  }`}
                >
                  Bull
                </button>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={undoDart}
                  disabled={currentDarts.length === 0}
                  className={`rounded-xl bg-[var(--color-warning)] hover:bg-[var(--color-warning-hover)] disabled:opacity-40 font-bold ${
                    compact ? "p-2" : "p-3"
                  }`}
                >
                  Undo Dart
                </button>

                <button
                  onClick={clearDarts}
                  disabled={currentDarts.length === 0}
                  className={`rounded-xl bg-[var(--color-panel-border)] hover:bg-[var(--color-panel)] disabled:opacity-40 font-bold ${
                    compact ? "p-2" : "p-3"
                  }`}
                >
                  Clear Turn
                </button>
              </div>

              <button
                onClick={handleSubmitTurn}
                disabled={currentDarts.length === 0}
                className={`w-full rounded-xl bg-[var(--color-success)] hover:bg-[var(--color-success-hover)] disabled:opacity-40 font-bold ${
                  compact ? "p-2 text-base" : "p-3 text-lg"
                }`}
              >
                Submit Turn
              </button>

              <button
                onClick={undoLastTurn}
                className={`w-full rounded-xl bg-[var(--color-warning)] hover:bg-[var(--color-warning-hover)] font-bold ${
                  compact ? "p-2" : "p-3"
                }`}
              >
                Undo Last Turn
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
