export type X01FinishRule = "straight_out" | "double_out";

/**
 * Structural dart shape shared by browser scoring and server-side validation.
 * Keep this module UI- and persistence-free so every scorer can use it.
 */
export type X01DartInput = {
  id: string;
  segment: number | "outer-bull" | "bull" | "miss";
  multiplier: 0 | 1 | 2 | 3;
  score: number;
};

export type X01TurnEvaluation = {
  scoreBefore: number;
  scoreEntered: number;
  scoreAfter: number;
  isBust: boolean;
  isCheckout: boolean;
  needsDoubleOutConfirmation: boolean;
};

export class X01RuleError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "X01RuleError";
  }
}

export function isDoubleOutDart(dart: X01DartInput | undefined) {
  return dart?.segment === "bull" || dart?.multiplier === 2;
}

export function isValidX01Dart(dart: X01DartInput) {
  if (!dart.id || typeof dart.id !== "string") return false;
  if (![0, 1, 2, 3].includes(dart.multiplier)) return false;
  if (!Number.isInteger(dart.score) || dart.score < 0 || dart.score > 60) return false;

  if (typeof dart.segment === "number") {
    return (
      Number.isInteger(dart.segment) &&
      dart.segment >= 1 &&
      dart.segment <= 20 &&
      [1, 2, 3].includes(dart.multiplier) &&
      dart.score === dart.segment * dart.multiplier
    );
  }

  if (dart.segment === "outer-bull") {
    return dart.multiplier === 1 && dart.score === 25;
  }
  if (dart.segment === "bull") {
    return dart.multiplier === 2 && dart.score === 50;
  }
  return dart.segment === "miss" && dart.multiplier === 0 && dart.score === 0;
}

export function validateX01Darts(
  darts: X01DartInput[] | undefined,
  scoreEntered: number,
  dartsThrown: 1 | 2 | 3,
) {
  if (darts === undefined) return;
  if (darts.length !== dartsThrown || darts.length < 1 || darts.length > 3) {
    throw new X01RuleError("Graphical dart count must match darts thrown.");
  }
  if (!darts.every(isValidX01Dart)) {
    throw new X01RuleError("Graphical dart data contains an invalid board hit.");
  }
  const total = darts.reduce((sum, dart) => sum + dart.score, 0);
  if (total !== scoreEntered) {
    throw new X01RuleError("Graphical dart total does not match the submitted turn score.");
  }
}

/**
 * Authoritative X01 turn evaluator used by local scoring and central league
 * scoring. The caller supplies explicit checkout evidence when available:
 * - graphical turns prove double-out from the final dart;
 * - total entry may pass true/false after confirmation;
 * - undefined preserves the local UI's "ask for confirmation" state.
 */
export function evaluateX01Turn(input: {
  scoreBefore: number;
  scoreEntered: number;
  finishRule: X01FinishRule;
  dartsThrown?: 1 | 2 | 3;
  darts?: X01DartInput[];
  checkoutConfirmed?: boolean;
}): X01TurnEvaluation {
  const dartsThrown = input.dartsThrown ?? 3;
  if (!Number.isInteger(input.scoreBefore) || input.scoreBefore < 0) {
    throw new X01RuleError("Current score must be a non-negative whole number.");
  }
  if (!Number.isInteger(input.scoreEntered) || input.scoreEntered < 0 || input.scoreEntered > 180) {
    throw new X01RuleError("Score must be a whole number from 0 to 180.");
  }
  if (![1, 2, 3].includes(dartsThrown)) {
    throw new X01RuleError("Darts thrown must be 1, 2, or 3.");
  }
  validateX01Darts(input.darts, input.scoreEntered, dartsThrown);

  const calculatedScore = input.scoreBefore - input.scoreEntered;
  const bustForRemainder =
    calculatedScore < 0 ||
    (input.finishRule === "double_out" && calculatedScore === 1);

  if (bustForRemainder) {
    return {
      scoreBefore: input.scoreBefore,
      scoreEntered: input.scoreEntered,
      scoreAfter: input.scoreBefore,
      isBust: true,
      isCheckout: false,
      needsDoubleOutConfirmation: false,
    };
  }

  if (calculatedScore !== 0) {
    return {
      scoreBefore: input.scoreBefore,
      scoreEntered: input.scoreEntered,
      scoreAfter: calculatedScore,
      isBust: false,
      isCheckout: false,
      needsDoubleOutConfirmation: false,
    };
  }

  if (input.finishRule === "straight_out") {
    return {
      scoreBefore: input.scoreBefore,
      scoreEntered: input.scoreEntered,
      scoreAfter: 0,
      isBust: false,
      isCheckout: true,
      needsDoubleOutConfirmation: false,
    };
  }

  if (input.darts !== undefined) {
    const validCheckout = isDoubleOutDart(input.darts[input.darts.length - 1]);
    return validCheckout
      ? {
          scoreBefore: input.scoreBefore,
          scoreEntered: input.scoreEntered,
          scoreAfter: 0,
          isBust: false,
          isCheckout: true,
          needsDoubleOutConfirmation: false,
        }
      : {
          scoreBefore: input.scoreBefore,
          scoreEntered: input.scoreEntered,
          scoreAfter: input.scoreBefore,
          isBust: true,
          isCheckout: false,
          needsDoubleOutConfirmation: false,
        };
  }

  if (input.checkoutConfirmed === true) {
    return {
      scoreBefore: input.scoreBefore,
      scoreEntered: input.scoreEntered,
      scoreAfter: 0,
      isBust: false,
      isCheckout: true,
      needsDoubleOutConfirmation: false,
    };
  }

  if (input.checkoutConfirmed === false) {
    return {
      scoreBefore: input.scoreBefore,
      scoreEntered: input.scoreEntered,
      scoreAfter: input.scoreBefore,
      isBust: true,
      isCheckout: false,
      needsDoubleOutConfirmation: false,
    };
  }

  // Total-score local entry reached zero but cannot prove the final dart.
  // Preserve the existing UI behavior: show zero provisionally and ask.
  return {
    scoreBefore: input.scoreBefore,
    scoreEntered: input.scoreEntered,
    scoreAfter: 0,
    isBust: false,
    isCheckout: true,
    needsDoubleOutConfirmation: true,
  };
}
