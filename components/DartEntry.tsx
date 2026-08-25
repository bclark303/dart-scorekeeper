"use client";

import { useEffect, useRef, useState } from "react";
import { DartThrow, FinishRule, Turn, getCheckoutSuggestion } from "@/lib/scoring";
import { getDartLabel } from "@/lib/darts";
import type { ScoringViewSessionState } from "@/lib/types";

type DartEntryProps = {
  message: string;
  compact: boolean;
  currentScore: number;
  currentSideName: string;
  currentThrowerName: string;
  currentLegNumber: number;
  finishRule: FinishRule;
  fullscreenScoreCards: FullscreenScoreCard[];
  lastTurn: Turn | null;
  submitDartTurn: (darts: DartThrow[]) => void;
  undoLastTurn: () => void;
  startNextLeg: () => void;
  replayMatch: () => void;
  newGameSetup: () => void;
  viewFinishedGame: () => void;
  isLegComplete: boolean;
  isMatchComplete: boolean;
  isCurrentThrowerDummy: boolean;
  dummyScore: number;
  submitDummyScore: () => void;
  initialSessionState?: ScoringViewSessionState | null;
  onSessionStateChange?: (state: ScoringViewSessionState) => void;
  onExitGame?: () => void;
};

type TurnPreview = {
  label: string;
  detail: string;
  tone: "neutral" | "good" | "warning" | "danger";
};

type NumberRing = "single-inner" | "triple" | "single-outer" | "double";
type DartInputStyle = ScoringViewSessionState["dartInputStyle"];

type FullscreenScoreCard = {
  id: string;
  name: string;
  throwerName: string;
  score: number;
  isCurrent: boolean;
};

const AUTO_FULLSCREEN_BOARD_STORAGE_KEY =
  "dart-scorekeeper-auto-fullscreen-board";

const FULLSCREEN_BOARD_ACTIVE_STORAGE_KEY =
  "dart-scorekeeper-fullscreen-board-active";

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

function getRingClass(
  target: BoardTarget,
  canAddDart: boolean,
  isSelected: boolean,
) {
  const stateClass = canAddDart
    ? "cursor-pointer active:brightness-150 hover:brightness-125"
    : "cursor-not-allowed opacity-40";
  const selectedClass = isSelected
    ? "brightness-150 stroke-[#facc15] stroke-[2.6]"
    : "stroke-[var(--color-background)] stroke-[0.65]";

  return `${stateClass} ${selectedClass} ${getBoardFillClass(
    target,
  )} transition-[filter,opacity]`;
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

function dartMatchesTarget(dart: DartThrow, target: BoardTarget) {
  return (
    dart.segment === target.segment &&
    dart.multiplier === target.multiplier &&
    dart.score === target.score
  );
}

function specialDartIsSelected(
  darts: DartThrow[],
  segment: "outer-bull" | "bull" | "miss",
) {
  return darts.some((dart) => dart.segment === segment);
}

function isDoubleOutDart(dart: DartThrow | undefined) {
  return dart?.segment === "bull" || dart?.multiplier === 2;
}

function getPreviewToneClass(tone: TurnPreview["tone"]) {
  if (tone === "good") {
    return "border-[var(--color-success)] bg-[var(--color-panel)]";
  }

  if (tone === "warning") {
    return "border-[var(--color-warning)] bg-[var(--color-panel)]";
  }

  if (tone === "danger") {
    return "border-[#b3261e] bg-[var(--color-panel)]";
  }

  return "border-[var(--color-panel-border)] bg-[var(--color-panel)]";
}

function getTurnPreview(
  currentScore: number,
  turnTotal: number,
  darts: DartThrow[],
  finishRule: FinishRule,
): TurnPreview {
  if (darts.length === 0) {
    const checkout = getCheckoutSuggestion(currentScore);

    return {
      label: `${currentScore} remaining`,
      detail: checkout
        ? `Checkout: ${checkout}`
        : "Tap the board to build this turn.",
      tone: "neutral",
    };
  }

  const remaining = currentScore - turnTotal;

  if (remaining < 0) {
    return {
      label: "Bust if submitted",
      detail: `${turnTotal} scored from ${currentScore}.`,
      tone: "danger",
    };
  }

  if (finishRule === "double_out" && remaining === 1) {
    return {
      label: "Bust if submitted",
      detail: "Double-out cannot leave 1.",
      tone: "danger",
    };
  }

  if (remaining === 0) {
    if (
      finishRule === "double_out" &&
      !isDoubleOutDart(darts[darts.length - 1])
    ) {
      return {
        label: "Invalid checkout",
        detail: "Final dart must be a double or bull.",
        tone: "danger",
      };
    }

    return {
      label: "Checkout ready",
      detail: `Submit to finish the leg in ${darts.length} dart${darts.length === 1 ? "" : "s"}.`,
      tone: "good",
    };
  }

  const checkout = getCheckoutSuggestion(remaining);

  return {
    label: `${remaining} remaining`,
    detail: checkout ? `Next checkout: ${checkout}` : `${turnTotal} this turn.`,
    tone: checkout ? "good" : "neutral",
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
  currentScore,
  currentSideName,
  currentThrowerName,
  currentLegNumber,
  finishRule,
  fullscreenScoreCards,
  lastTurn,
  submitDartTurn,
  undoLastTurn,
  startNextLeg,
  replayMatch,
  newGameSetup,
  viewFinishedGame,
  isLegComplete,
  isMatchComplete,
  isCurrentThrowerDummy,
  dummyScore,
  submitDummyScore,
  initialSessionState,
  onSessionStateChange,
  onExitGame,
}: DartEntryProps) {
  const [currentDarts, setCurrentDarts] = useState<DartThrow[]>(initialSessionState?.currentDarts ?? []);
  const hasAppliedInitialSessionState = useRef(initialSessionState != null);
  const [isBoardFullscreen, setIsBoardFullscreen] = useState(() => {
    if (initialSessionState) return initialSessionState.isScoringView;
    if (typeof window === "undefined") {
      return false;
    }

    return (
      window.sessionStorage.getItem(FULLSCREEN_BOARD_ACTIVE_STORAGE_KEY) ===
      "true"
    );
  });
  const [autoFullscreenBoard, setAutoFullscreenBoard] = useState(() => {
    if (typeof window === "undefined") {
      return false;
    }

    return (
      window.localStorage.getItem(AUTO_FULLSCREEN_BOARD_STORAGE_KEY) === "true"
    );
  });
  const [hasAutoOpenedBoard, setHasAutoOpenedBoard] = useState(false);
  const [dartInputStyle, setDartInputStyle] = useState<DartInputStyle>(initialSessionState?.dartInputStyle ?? "board");
  const [numericMultiplier, setNumericMultiplier] = useState<1 | 2 | 3 | null>(initialSessionState?.numericMultiplier ?? null);
  const [showFullscreenScorecard, setShowFullscreenScorecard] = useState(initialSessionState?.showScorecard ?? false);
  const turnTotal = currentDarts.reduce((total, dart) => total + dart.score, 0);
  const remainingAfterCurrentDarts = currentScore - turnTotal;
  const activeCheckoutSuggestion =
    remainingAfterCurrentDarts > 1
      ? getCheckoutSuggestion(remainingAfterCurrentDarts)
      : null;
  const canAddDart = currentDarts.length < 3;
  const nextDartNumber = Math.min(currentDarts.length + 1, 3);
  const isTurnReady = currentDarts.length === 3;
  const turnPreview = getTurnPreview(
    currentScore,
    turnTotal,
    currentDarts,
    finishRule,
  );

  const fullscreenStatusText =
    turnPreview.tone === "danger"
      ? turnPreview.label
      : activeCheckoutSuggestion
        ? `CO: ${activeCheckoutSuggestion}`
        : turnPreview.tone === "good"
          ? turnPreview.label
          : "CO: —";

  const isOuterBullSelected = specialDartIsSelected(currentDarts, "outer-bull");
  const isBullSelected = specialDartIsSelected(currentDarts, "bull");
  const isPreviewAnimated =
    turnPreview.tone === "good" || turnPreview.tone === "danger";
  const shouldAutoOpenBoard =
    compact &&
    autoFullscreenBoard &&
    dartInputStyle === "board" &&
    !isLegComplete &&
    !isMatchComplete;

  const shouldShowBoardFullscreen =
    isBoardFullscreen &&
    ((!isLegComplete && !isMatchComplete) || showFullscreenScorecard);


  useEffect(() => {
    if (!initialSessionState || hasAppliedInitialSessionState.current) return;
    hasAppliedInitialSessionState.current = true;
    setCurrentDarts(initialSessionState.currentDarts);
    setDartInputStyle(initialSessionState.dartInputStyle);
    setNumericMultiplier(initialSessionState.numericMultiplier);
    setIsBoardFullscreen(initialSessionState.isScoringView);
    setShowFullscreenScorecard(initialSessionState.showScorecard);
  }, [initialSessionState]);

  useEffect(() => {
    if (!shouldAutoOpenBoard || hasAutoOpenedBoard || isBoardFullscreen) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setIsBoardFullscreen(true);
      setHasAutoOpenedBoard(true);
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, [hasAutoOpenedBoard, isBoardFullscreen, shouldAutoOpenBoard]);

  useEffect(() => {
    window.sessionStorage.setItem(
      FULLSCREEN_BOARD_ACTIVE_STORAGE_KEY,
      String(isBoardFullscreen),
    );

    if (!shouldShowBoardFullscreen) {
      return;
    }

    const originalBodyOverflow = document.body.style.overflow;
    const originalHtmlOverflow = document.documentElement.style.overflow;

    document.body.style.overflow = "hidden";
    document.documentElement.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = originalBodyOverflow;
      document.documentElement.style.overflow = originalHtmlOverflow;
    };
  }, [isBoardFullscreen, shouldShowBoardFullscreen]);

  useEffect(() => {
    onSessionStateChange?.({
      currentDarts,
      dartInputStyle,
      numericMultiplier,
      isScoringView: isBoardFullscreen,
      showScorecard: showFullscreenScorecard,
    });
  }, [currentDarts, dartInputStyle, isBoardFullscreen, numericMultiplier, onSessionStateChange, showFullscreenScorecard]);

  function setAutoFullscreenPreference(enabled: boolean) {
    setAutoFullscreenBoard(enabled);
    window.localStorage.setItem(
      AUTO_FULLSCREEN_BOARD_STORAGE_KEY,
      String(enabled),
    );

    if (enabled) {
      setHasAutoOpenedBoard(false);
    }
  }

  function addDart(dart: DartThrow) {
    if (!canAddDart) {
      return;
    }

    setShowFullscreenScorecard(false);
    setCurrentDarts((previousDarts) => [...previousDarts, dart]);
  }

  function undoDart() {
    setCurrentDarts((previousDarts) => previousDarts.slice(0, -1));
  }

  function clearDarts() {
    setCurrentDarts([]);
  }

  function addNumericDart(segment: number) {
    if (!numericMultiplier) {
      return;
    }

    addDart({
      id: getRandomId(),
      segment,
      multiplier: numericMultiplier,
      score: segment * numericMultiplier,
    });
    setNumericMultiplier(null);
  }

  function renderAutoFullscreenToggle(isFullscreen = false) {
    if (isFullscreen) {
      return (
        <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-white/15 bg-white/5 px-2 py-1 text-xs font-bold text-white/80 hover:bg-white/10">
          <input
            type="checkbox"
            checked={autoFullscreenBoard}
            onChange={(event) =>
              setAutoFullscreenPreference(event.target.checked)
            }
            className="h-4 w-4 accent-[var(--color-primary)]"
          />
          Auto-open
        </label>
      );
    }

    return (
      <button
        type="button"
        onClick={() => setAutoFullscreenPreference(!autoFullscreenBoard)}
        className={`rounded-lg border px-3 py-1 text-xs font-bold transition ${autoFullscreenBoard
          ? "border-[#facc15] bg-[var(--color-primary)] text-white ring-1 ring-[#facc15]"
          : "border-[var(--color-panel-border)] bg-[var(--color-panel-soft)] text-[var(--color-text-main)] hover:bg-[var(--color-panel-border)]"
          }`}
        aria-pressed={autoFullscreenBoard}
        title="Automatically open Scoring View while a match is active"
      >
        {autoFullscreenBoard ? "Auto Scoring View: On" : "Auto Scoring View: Off"}
      </button>
    );
  }

  function renderDartInputStyleToggle(isFullscreen = false) {
    if (isFullscreen) {
      return (
        <div className="rounded-xl border border-white/15 bg-white/5 p-2">
          <div className="mb-1 text-[0.65rem] font-bold uppercase tracking-wide text-white/60">
            Dart input
          </div>
          <div className="grid grid-cols-2 gap-1">
            <label
              className={`flex cursor-pointer items-center justify-center gap-2 rounded-lg border px-2 py-2 text-sm font-bold ${dartInputStyle === "board" ? "border-[var(--color-primary)] bg-[var(--color-primary)] text-white" : "border-white/15 bg-white/5 text-white/75 hover:bg-white/10"}`}
            >
              <input
                type="radio"
                name="fullscreen-dart-input-style"
                checked={dartInputStyle === "board"}
                onChange={() => {
                  setDartInputStyle("board");
                  setHasAutoOpenedBoard(false);
                }}
                className="sr-only"
              />
              Board
            </label>
            <label
              className={`flex cursor-pointer items-center justify-center gap-2 rounded-lg border px-2 py-2 text-sm font-bold ${dartInputStyle === "numeric" ? "border-[var(--color-primary)] bg-[var(--color-primary)] text-white" : "border-white/15 bg-white/5 text-white/75 hover:bg-white/10"}`}
            >
              <input
                type="radio"
                name="fullscreen-dart-input-style"
                checked={dartInputStyle === "numeric"}
                onChange={() => setDartInputStyle("numeric")}
                className="sr-only"
              />
              Numeric
            </label>
          </div>
        </div>
      );
    }

    return (
      <div className="flex items-center justify-between gap-2 rounded-xl border border-[var(--color-panel-border)] bg-[var(--color-panel)] p-2">
        <div>
          <div className="text-xs font-bold uppercase tracking-wide opacity-70">
            Dart input
          </div>
          <div className="text-sm font-bold">
            {dartInputStyle === "board"
              ? "Graphical board"
              : "Numeric dart pad"}
          </div>
        </div>

        <div className="grid grid-cols-2 rounded-lg border border-[var(--color-panel-border)] bg-[var(--color-panel-soft)] p-1">
          <button
            type="button"
            onClick={() => {
              setDartInputStyle("board");
              setHasAutoOpenedBoard(false);
            }}
            className={`rounded-md px-3 py-2 text-sm font-bold transition ${dartInputStyle === "board"
              ? "bg-[var(--color-primary)] text-white shadow"
              : "text-[var(--color-text-muted)] hover:bg-[var(--color-panel-border)] hover:text-[var(--color-text-main)]"
              }`}
            aria-pressed={dartInputStyle === "board"}
          >
            Board
          </button>

          <button
            type="button"
            onClick={() => setDartInputStyle("numeric")}
            className={`rounded-md px-3 py-2 text-sm font-bold transition ${dartInputStyle === "numeric"
              ? "bg-[var(--color-primary)] text-white shadow"
              : "text-[var(--color-text-muted)] hover:bg-[var(--color-panel-border)] hover:text-[var(--color-text-main)]"
              }`}
            aria-pressed={dartInputStyle === "numeric"}
          >
            Numeric
          </button>
        </div>
      </div>
    );
  }

  function handleSubmitTurn() {
    if (currentDarts.length === 0) {
      return;
    }

    submitDartTurn(currentDarts);
    setCurrentDarts([]);

    if (isBoardFullscreen && dartInputStyle === "board") {
      setShowFullscreenScorecard(true);
    }
  }

  function renderDartBoard(sizeClass: string) {
    return (
      <svg
        viewBox={`0 0 ${boardSize} ${boardSize}`}
        role="img"
        aria-label="Tap a dartboard segment to add a dart"
        className={`mx-auto aspect-square select-none touch-manipulation ${sizeClass}`}
      >
        <circle
          cx={boardCenter}
          cy={boardCenter}
          r="112"
          className="fill-[var(--color-background)] stroke-[var(--color-panel-border)] stroke-[2]"
        />

        {boardTargets.map((target) => {
          const isSelected = currentDarts.some((dart) =>
            dartMatchesTarget(dart, target),
          );

          return (
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
              className={getRingClass(target, canAddDart, isSelected)}
            />
          );
        })}

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
          className={`fill-[#2e7d32] hover:brightness-125 active:brightness-150 transition-[filter,opacity] ${isOuterBullSelected
            ? "brightness-150 stroke-[#facc15] stroke-[2.6]"
            : "stroke-[var(--color-background)] stroke-[1]"
            } ${canAddDart ? "cursor-pointer" : "cursor-not-allowed opacity-40"}`}
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
          className={`fill-[#b3261e] hover:brightness-125 active:brightness-150 transition-[filter,opacity] ${isBullSelected
            ? "brightness-150 stroke-[#facc15] stroke-[2.6]"
            : "stroke-[var(--color-background)] stroke-[1]"
            } ${canAddDart ? "cursor-pointer" : "cursor-not-allowed opacity-40"}`}
        />

        {boardNumbers.map((segment, index) => {
          const angle = -90 + index * 18;
          const labelPoint = polarToCartesian(113, angle);

          return (
            <text
              key={segment}
              x={labelPoint.x}
              y={labelPoint.y}
              textAnchor="middle"
              dominantBaseline="middle"
              className="pointer-events-none fill-white stroke-black stroke-[3.8] text-[16px] font-black drop-shadow-[0_1px_2px_rgba(0,0,0,0.9)]"
              paintOrder="stroke"
            >
              {segment}
            </text>
          );
        })}
      </svg>
    );
  }

  function renderNumericDartInput(isFullscreen = false) {
    const multiplierOptions: Array<{ label: string; value: 1 | 2 | 3 }> = [
      { label: "Single", value: 1 },
      { label: "Double", value: 2 },
      { label: "Triple", value: 3 },
    ];

    return (
      <div
        className={`rounded-2xl border ${isFullscreen
          ? "border-white/20 bg-neutral-950 p-3"
          : "border-[var(--color-panel-border)] bg-[var(--color-panel)] p-3"
          }`}
      >
        <div className="mb-3 grid grid-cols-3 gap-2">
          {multiplierOptions.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => setNumericMultiplier(option.value)}
              className={`rounded-xl border font-black transition ${numericMultiplier === option.value
                ? "border-[#facc15] bg-[var(--color-primary)] text-white ring-2 ring-[#facc15]"
                : isFullscreen
                  ? "border-white/20 bg-white/10 text-white hover:bg-white/20"
                  : "border-[var(--color-panel-border)] bg-[var(--color-panel-soft)] hover:bg-[var(--color-panel-border)]"
                } ${isFullscreen ? "p-4 text-lg" : compact ? "p-2 text-sm" : "p-3 text-base"}`}
              aria-pressed={numericMultiplier === option.value}
            >
              {option.label}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-5 gap-2">
          {Array.from({ length: 20 }, (_, index) => index + 1).map(
            (segment) => {
              const value = numericMultiplier
                ? segment * numericMultiplier
                : segment;
              const prefix =
                numericMultiplier === 1
                  ? "S"
                  : numericMultiplier === 2
                    ? "D"
                    : numericMultiplier === 3
                      ? "T"
                      : "—";
              const label = numericMultiplier
                ? `${prefix}${segment}`
                : `Segment ${segment}`;
              const isNumberDisabled = !canAddDart || !numericMultiplier;

              return (
                <button
                  key={segment}
                  type="button"
                  onClick={() => addNumericDart(segment)}
                  disabled={isNumberDisabled}
                  className={`rounded-xl border font-black transition disabled:cursor-not-allowed disabled:opacity-40 ${isFullscreen
                    ? "border-white/20 bg-white/10 text-white hover:bg-white/20"
                    : "border-[var(--color-panel-border)] bg-[var(--color-panel-soft)] hover:bg-[var(--color-panel-border)]"
                    } ${isFullscreen ? "p-4 text-xl" : compact ? "p-2 text-base" : "p-3 text-lg"}`}
                  aria-label={
                    numericMultiplier
                      ? `${label}, ${value} points`
                      : `Choose multiplier before segment ${segment}`
                  }
                >
                  <span className="block">{segment}</span>
                  <span className="block text-[0.65rem] font-bold opacity-70">
                    {numericMultiplier ? `${label} · ${value}` : "Pick S/D/T"}
                  </span>
                </button>
              );
            },
          )}
        </div>
      </div>
    );
  }

  function renderTurnStatus(isFullscreen = false) {
    return (
      <div
        className={`grid gap-2 ${isFullscreen
          ? "grid-cols-[1fr_auto] xl:grid-cols-[1fr_auto_minmax(220px,1fr)]"
          : compact
            ? "grid-cols-[1fr_auto]"
            : "grid-cols-[1fr_auto_minmax(180px,1fr)] items-stretch"
          }`}
      >
        <div className="rounded-xl bg-[var(--color-panel)] border border-[var(--color-panel-border)] px-3 py-2">
          <div
            className={
              isFullscreen
                ? "text-2xl font-black"
                : compact
                  ? "text-base font-bold"
                  : "text-xl font-bold"
            }
          >
            Board Entry
          </div>
          <div
            className={
              isFullscreen
                ? "text-base text-[var(--color-text-muted)]"
                : "text-sm text-[var(--color-text-muted)]"
            }
          >
            {isTurnReady ? "Ready to submit" : `Dart ${nextDartNumber} of 3`}
          </div>
        </div>

        <div className="rounded-xl bg-[var(--color-panel)] border border-[var(--color-panel-border)] px-4 py-2 text-right">
          <div className="text-xs text-[var(--color-text-muted)]">
            Turn total
          </div>
          <div
            className={
              isFullscreen
                ? "text-6xl font-black leading-none"
                : compact
                  ? "text-3xl font-black leading-none"
                  : "text-5xl font-black leading-none"
            }
          >
            {turnTotal}
          </div>
        </div>

        <div
          className={`rounded-xl border px-3 py-2 ${getPreviewToneClass(turnPreview.tone)} ${isPreviewAnimated ? "animate-pulse" : ""
            } ${!isFullscreen && compact ? "col-span-2" : ""}`}
        >
          <div
            className={
              isFullscreen ? "text-lg font-black" : "text-sm font-bold"
            }
          >
            {turnPreview.label}
          </div>
          <div
            className={
              isFullscreen
                ? "text-sm text-[var(--color-text-muted)]"
                : "text-xs text-[var(--color-text-muted)]"
            }
          >
            {turnPreview.detail}
          </div>
        </div>
      </div>
    );
  }

  function renderFullscreenScorecard() {
    const lastThrowerName =
      lastTurn?.throwerName ?? lastTurn?.playerName ?? "Last player";
    const lastDartSummary = lastTurn?.darts?.length
      ? lastTurn.darts.map(getDartLabel).join(" + ")
      : null;

    const whatHappened = lastTurn
      ? lastTurn.isCheckout
        ? `${lastThrowerName} checked out with ${lastTurn.scoreEntered}.`
        : lastTurn.isBust
          ? `${lastThrowerName} busts with ${lastTurn.scoreEntered}.`
          : `${lastThrowerName} scored ${lastTurn.scoreEntered}.`
      : message;

    const scoreChange = lastTurn
      ? lastTurn.isBust
        ? `Score stayed at ${lastTurn.scoreBefore}`
        : `${lastTurn.scoreBefore} → ${lastTurn.scoreAfter}`
      : "";

    return (
      <div className="flex h-full min-h-0 items-center justify-center rounded-2xl border border-white/20 bg-neutral-900 p-4 shadow-2xl">
        <div className="grid w-full max-w-[820px] gap-4 text-center">
          <div className="rounded-2xl border border-white/20 bg-white/5 p-4">
            <div className="text-xs font-bold uppercase tracking-[0.2em] text-white/55">
              What happened
            </div>
            <div className="mt-1 text-3xl font-black leading-tight sm:text-4xl">
              {whatHappened}
            </div>
            {lastDartSummary && (
              <div className="mt-2 text-base font-bold text-white/65">
                {lastDartSummary}
              </div>
            )}
            {scoreChange && (
              <div className="mt-2 text-lg font-bold text-white/75">
                {scoreChange}
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            {fullscreenScoreCards.map((scoreCard) => (
              <div
                key={scoreCard.id}
                className={`rounded-2xl border p-4 ${scoreCard.isCurrent
                  ? "border-[var(--color-success)] bg-[var(--color-success)]/20"
                  : "border-white/20 bg-white/5"
                  }`}
              >
                <div className="text-xs font-bold uppercase tracking-wide text-white/55">
                  {scoreCard.name}
                </div>
                <div className="text-5xl font-black leading-none sm:text-6xl">
                  {scoreCard.score}
                </div>
                <div className="mt-1 text-sm font-bold text-white/60">
                  {scoreCard.throwerName}
                </div>
              </div>
            ))}
          </div>

          <div className="rounded-2xl border border-white/20 bg-white/5 p-4">
            <div className="text-xs font-bold uppercase tracking-wide text-white/55">
              Throws next
            </div>
            <div className="mt-1 text-4xl font-black leading-tight sm:text-5xl">
              {currentThrowerName}
            </div>
            <div className="mt-1 text-lg font-bold text-white/70">
              {currentSideName} • Leg {currentLegNumber}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setShowFullscreenScorecard(false)}
              className="rounded-2xl bg-[var(--color-success)] px-4 py-5 text-2xl font-black hover:bg-[var(--color-success-hover)]"
            >
              Next Turn
            </button>

            <button
              type="button"
              onClick={() => {
                undoLastTurn();
                setShowFullscreenScorecard(false);
              }}
              className="rounded-2xl bg-[var(--color-warning)] px-4 py-5 text-xl font-black hover:bg-[var(--color-warning-hover)]"
            >
              Undo Last Turn
            </button>
          </div>
        </div>
      </div>
    );
  }

  function renderDummyTurnPrompt(isFullscreen = false) {
    return (
      <div
        className={`rounded-2xl border ${isFullscreen
          ? "border-white/20 bg-white/5 p-6 text-white"
          : "border-[var(--color-panel-border)] bg-[var(--color-panel)] p-4"
          }`}
      >
        <div
          className={
            isFullscreen
              ? "text-3xl font-black leading-tight"
              : "text-lg font-bold"
          }
        >
          Dummy player turn
        </div>

        <p
          className={
            isFullscreen
              ? "mt-2 text-lg font-bold text-white/70"
              : "mt-2 text-[var(--color-text-muted)]"
          }
        >
          This slot will automatically score{" "}
          <span className={isFullscreen ? "text-white" : "text-[var(--color-text-main)]"}>
            {dummyScore}
          </span>
          .
        </p>

        <button
          type="button"
          onClick={submitDummyScore}
          className={`mt-4 w-full rounded-xl bg-[var(--color-accent)] font-black hover:bg-[var(--color-accent-hover)] ${isFullscreen ? "px-4 py-5 text-2xl" : "p-4 text-xl"
            }`}
        >
          Apply Dummy Score
        </button>
      </div>
    );
  }

  function renderTurnControls(isFullscreen = false) {
    return (
      <div
        className={
          isFullscreen ? "space-y-3" : compact ? "space-y-2" : "space-y-3"
        }
      >
        <div
          className={`rounded-xl bg-[var(--color-panel)] border border-[var(--color-panel-border)] ${isFullscreen ? "p-4" : compact ? "p-2" : "p-3"}`}
        >
          <div className="mb-2 flex items-baseline justify-between gap-2">
            <div
              className={
                isFullscreen ? "text-lg font-black" : "text-sm font-bold"
              }
            >
              Current darts
            </div>
            <div className="text-xs text-[var(--color-text-muted)]">
              Tap order
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2">
            {[0, 1, 2].map((index) => {
              const dart = currentDarts[index];

              return (
                <div
                  key={index}
                  className={`rounded-xl border px-2 text-center ${dart
                    ? "border-[var(--color-success)] bg-[var(--color-panel)]"
                    : "border-[var(--color-panel-border)] bg-[var(--color-panel-soft)]"
                    } ${isFullscreen ? "py-4" : compact ? "py-2" : "py-3"}`}
                >
                  <div className="text-xs text-[var(--color-text-muted)]">
                    Dart {index + 1}
                  </div>
                  <div
                    className={
                      isFullscreen
                        ? "text-3xl font-black"
                        : compact
                          ? "text-lg font-black"
                          : "text-2xl font-black"
                    }
                  >
                    {dart ? getDartLabel(dart) : "—"}
                  </div>
                  <div className="text-xs font-semibold text-[var(--color-text-muted)]">
                    {dart ? `${dart.score} pts` : ""}
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
            className={`rounded-xl bg-[var(--color-panel)] hover:bg-[var(--color-panel-border)] disabled:opacity-40 disabled:hover:bg-[var(--color-panel)] border border-[var(--color-panel-border)] font-bold ${specialDartIsSelected(currentDarts, "miss")
              ? "ring-2 ring-[#facc15]"
              : ""
              } ${isFullscreen ? "p-4 text-xl" : compact ? "p-2" : "p-3"}`}
          >
            Miss
          </button>

          <button
            onClick={() => addDart(createSpecialDart("outer-bull"))}
            disabled={!canAddDart}
            className={`rounded-xl bg-[#2e7d32] hover:brightness-125 disabled:opacity-40 text-white font-bold ${isOuterBullSelected ? "ring-2 ring-[#facc15]" : ""
              } ${isFullscreen ? "p-4 text-xl" : compact ? "p-2" : "p-3"}`}
          >
            25
          </button>

          <button
            onClick={() => addDart(createSpecialDart("bull"))}
            disabled={!canAddDart}
            className={`rounded-xl bg-[#b3261e] hover:brightness-125 disabled:opacity-40 text-white font-bold ${isBullSelected ? "ring-2 ring-[#facc15]" : ""
              } ${isFullscreen ? "p-4 text-xl" : compact ? "p-2" : "p-3"}`}
          >
            Bull
          </button>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={undoDart}
            disabled={currentDarts.length === 0}
            className={`rounded-xl bg-[var(--color-warning)] hover:bg-[var(--color-warning-hover)] disabled:opacity-40 font-bold ${isFullscreen ? "p-4 text-lg" : compact ? "p-2" : "p-3"
              }`}
          >
            Undo Dart
          </button>

          <button
            onClick={clearDarts}
            disabled={currentDarts.length === 0}
            className={`rounded-xl bg-[var(--color-panel-border)] hover:bg-[var(--color-panel)] disabled:opacity-40 font-bold ${isFullscreen ? "p-4 text-lg" : compact ? "p-2" : "p-3"
              }`}
          >
            Clear Turn
          </button>
        </div>

        <button
          onClick={handleSubmitTurn}
          disabled={currentDarts.length === 0}
          className={`w-full rounded-xl bg-[var(--color-success)] hover:bg-[var(--color-success-hover)] disabled:opacity-40 font-bold ${isFullscreen
            ? "p-5 text-2xl"
            : compact
              ? "p-2 text-base"
              : "p-3 text-lg"
            }`}
        >
          {currentDarts.length === 0 ? "Submit Turn" : `Submit ${turnTotal}`}
        </button>

        <button
          onClick={undoLastTurn}
          className={`w-full rounded-xl bg-[var(--color-warning)] hover:bg-[var(--color-warning-hover)] font-bold ${isFullscreen ? "p-4 text-lg" : compact ? "p-2" : "p-3"
            }`}
        >
          Undo Last Turn
        </button>
      </div>
    );
  }

  return (
    <section
      className={`rounded-2xl bg-[var(--color-panel)] border border-[var(--color-panel-border)] mb-4 ${compact ? "p-3" : "p-6"
        }`}
    >
      <div className={compact ? "text-base mb-2" : "text-xl mb-4"}>
        {message}
      </div>

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
          <div className="mb-3 space-y-2">
            {renderDartInputStyleToggle()}
            {renderTurnStatus()}
          </div>

          <div
            className={
              compact
                ? "grid grid-cols-1 gap-2"
                : "grid grid-cols-[minmax(260px,380px)_1fr] gap-5 items-start"
            }
          >
            {isCurrentThrowerDummy ? (
              renderDummyTurnPrompt()
            ) : dartInputStyle === "board" ? (
              <div
                className={`rounded-2xl bg-[var(--color-panel)] border border-[var(--color-panel-border)] ${compact ? "p-1" : "p-2"}`}
              >
                <div className="mb-2 flex flex-wrap justify-end gap-2">
                  {compact && renderAutoFullscreenToggle()}
                  <button
                    onClick={() => {
                      setShowFullscreenScorecard(false);
                      setIsBoardFullscreen(true);
                    }}
                    className="rounded-lg bg-[var(--color-panel-soft)] border border-[var(--color-panel-border)] px-3 py-1 text-xs font-bold hover:bg-[var(--color-panel-border)]"
                  >
                    Scoring View
                  </button>
                </div>
                {renderDartBoard(
                  compact ? "w-full max-w-[315px]" : "w-full max-w-[380px]",
                )}
              </div>
            ) : (
              renderNumericDartInput()
            )}

            {!isCurrentThrowerDummy && renderTurnControls()}
          </div>
        </div>
      )}

      {shouldShowBoardFullscreen && (
        <div className="fixed inset-0 z-[90] h-[100dvh] overflow-hidden bg-neutral-950 p-2 text-white">
          <div className="mx-auto grid h-full max-w-[1600px] grid-rows-[auto_minmax(0,1fr)_auto] gap-2 overflow-hidden">
            <div className="shrink-0 rounded-2xl border border-white/20 bg-neutral-900 px-4 py-2 shadow-2xl">
              <div className="min-w-0">
                <div className="flex min-w-0 flex-wrap items-baseline gap-x-3 gap-y-1">
                  <span className="truncate text-2xl font-black leading-tight sm:text-3xl">
                    {currentThrowerName}
                  </span>

                  <span className="truncate text-sm font-bold uppercase tracking-wide text-white/60 sm:text-base">
                    {currentSideName}
                  </span>

                  <span className="text-4xl font-black leading-none text-white sm:text-5xl">
                    {currentScore}
                  </span>

                  <span className="rounded-full border border-white/15 bg-white/10 px-3 py-1 text-sm font-black text-white/85 sm:text-base">
                    {isTurnReady ? "Ready" : `Dart ${nextDartNumber}/3`}
                  </span>

                  <span className="rounded-full border border-white/15 bg-white/10 px-3 py-1 text-sm font-black text-white/85 sm:text-base">
                    Turn {turnTotal}
                  </span>

                  <span
                    className={`rounded-full border px-3 py-1 text-sm font-black sm:text-base ${turnPreview.tone === "danger"
                      ? "border-[#b3261e] bg-[#b3261e]/25 text-white"
                      : turnPreview.tone === "good"
                        ? "border-[var(--color-success)] bg-[var(--color-success)]/20 text-white"
                        : "border-white/15 bg-white/10 text-white/75"
                      }`}
                  >
                    {fullscreenStatusText}
                  </span>
                </div>
              </div>
            </div>

            <div className="grid min-h-0 grid-rows-[minmax(0,1fr)_auto] gap-2 overflow-hidden min-[760px]:grid-cols-[minmax(0,1fr)_minmax(220px,300px)] min-[760px]:grid-rows-none">
              <div className="min-h-0 overflow-hidden rounded-2xl border border-white/20 bg-neutral-900 p-2 shadow-2xl">
                {showFullscreenScorecard ? (
                  renderFullscreenScorecard()
                ) : isCurrentThrowerDummy ? (
                  <div className="flex h-full min-h-0 items-center justify-center overflow-y-auto p-3">
                    <div className="w-full max-w-xl">
                      {renderDummyTurnPrompt(true)}
                    </div>
                  </div>
                ) : dartInputStyle === "board" ? (
                  <div className="flex h-full min-h-0 items-center justify-center overflow-hidden">
                    {renderDartBoard("h-full max-h-full w-auto max-w-full")}
                  </div>
                ) : (
                  <div className="h-full min-h-0 overflow-y-auto">
                    {renderNumericDartInput(true)}
                  </div>
                )}
              </div>

              <div className="grid max-h-[42dvh] min-h-0 grid-rows-[auto_auto_auto] gap-2 overflow-y-auto rounded-2xl border border-white/20 bg-neutral-900 p-2 shadow-2xl min-[760px]:max-h-none min-[760px]:overflow-y-auto">


                <div className="grid gap-2">
                  {!isCurrentThrowerDummy && (
                    <div className="grid grid-cols-4 gap-2">
                      <button
                        type="button"
                        onClick={() => addDart(createSpecialDart("miss"))}
                        disabled={!canAddDart}
                        className={`rounded-xl border border-white/15 bg-white/5 px-2 py-3 text-sm font-black hover:bg-white/10 disabled:opacity-40 ${specialDartIsSelected(currentDarts, "miss")
                          ? "ring-2 ring-[#facc15]"
                          : ""
                          }`}
                      >
                        Miss
                      </button>

                      <button
                        type="button"
                        onClick={handleSubmitTurn}
                        disabled={currentDarts.length === 0}
                        className="col-span-2 rounded-xl bg-[var(--color-success)] px-2 py-3 text-xl font-black hover:bg-[var(--color-success-hover)] disabled:opacity-40"
                      >
                        {currentDarts.length === 0 ? "Submit" : `Submit ${turnTotal}`}
                      </button>

                      <button
                        type="button"
                        onClick={undoDart}
                        disabled={currentDarts.length === 0}
                        className="rounded-xl bg-[var(--color-warning)] px-2 py-3 text-sm font-black hover:bg-[var(--color-warning-hover)] disabled:opacity-40"
                      >
                        Undo
                      </button>
                    </div>
                  )}

                  {!isCurrentThrowerDummy && (
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={clearDarts}
                        disabled={currentDarts.length === 0}
                        className="rounded-xl bg-white/10 px-2 py-2 text-sm font-bold hover:bg-white/20 disabled:opacity-40"
                      >
                        Clear Turn
                      </button>

                      <button
                        type="button"
                        onClick={undoLastTurn}
                        className="rounded-xl bg-white/10 px-2 py-2 text-sm font-bold text-white/75 hover:bg-white/20"
                      >
                        Undo Last Turn
                      </button>
                    </div>


                  )}

                  <div className="grid grid-cols-2 gap-2">
                    {fullscreenScoreCards.map((card) => (
                      <div
                        key={card.id}
                        className={`rounded-2xl border px-3 py-3 text-center ${card.isCurrent
                          ? "border-[var(--color-primary)] bg-[var(--color-primary)]/25 ring-2 ring-[#facc15]/70"
                          : "border-white/15 bg-white/5"
                          }`}
                      >
                        <div className="truncate text-xs font-black uppercase tracking-wide text-white/60">
                          {card.name}
                        </div>

                        {card.throwerName !== card.name && (
                          <div className="truncate text-sm font-bold text-white/75">
                            {card.throwerName}
                          </div>
                        )}

                        <div className={`${card.throwerName !== card.name ? "mt-1" : "mt-2"} text-5xl font-black leading-none`}>
                          {card.score}
                        </div>
                      </div>
                    ))}
                  </div>

                </div>





              </div>
            </div>

            <div className="flex shrink-0 flex-wrap items-center gap-2 rounded-xl border border-white/20 bg-neutral-900 p-2 shadow-2xl">
              <label className="flex min-h-10 cursor-pointer items-center justify-center gap-2 rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-xs font-bold text-white/80 hover:bg-white/10">
                <input
                  type="checkbox"
                  checked={autoFullscreenBoard}
                  onChange={(event) =>
                    setAutoFullscreenPreference(event.target.checked)
                  }
                  className="h-4 w-4 accent-[var(--color-primary)]"
                />
                Auto
              </label>

              <button
                type="button"
                onClick={() => {
                  setDartInputStyle("board");
                  setHasAutoOpenedBoard(false);
                }}
                className={`min-h-10 rounded-lg border px-3 py-2 text-xs font-bold ${dartInputStyle === "board"
                  ? "border-[var(--color-primary)] bg-[var(--color-primary)] text-white"
                  : "border-white/15 bg-white/5 text-white/75 hover:bg-white/10"
                  }`}
              >
                Board
              </button>

              <button
                type="button"
                onClick={() => setDartInputStyle("numeric")}
                className={`min-h-10 rounded-lg border px-3 py-2 text-xs font-bold ${dartInputStyle === "numeric"
                  ? "border-[var(--color-primary)] bg-[var(--color-primary)] text-white"
                  : "border-white/15 bg-white/5 text-white/75 hover:bg-white/10"
                  }`}
              >
                Numeric
              </button>

              <button
                type="button"
                onClick={() => {
                  setShowFullscreenScorecard(false);
                  setIsBoardFullscreen(false);
                  setHasAutoOpenedBoard(true);
                }}
                className="min-h-10 rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-xs font-bold text-white/75 hover:bg-white/10"
              >
                App View
              </button>

              {onExitGame && (
                <button
                  type="button"
                  onClick={onExitGame}
                  className="ml-auto min-h-10 rounded-lg border border-[var(--color-danger)]/40 bg-[var(--color-danger)]/10 px-3 py-2 text-xs font-bold text-white/80 hover:bg-[var(--color-danger)]/20"
                >
                  Exit Game
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
