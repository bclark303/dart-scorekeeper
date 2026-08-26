/**
 * Shared X01 match-format helpers.
 *
 * League play intentionally follows the same "Best of N" semantics as the
 * casual scorer: Best of 3 means the first side to 2 legs wins.
 */
export const X01_BEST_OF_OPTIONS = [1, 3, 5, 7, 9] as const;

export type X01BestOfLegs = (typeof X01_BEST_OF_OPTIONS)[number];

export function isSupportedBestOfLegs(value: number): value is X01BestOfLegs {
  return X01_BEST_OF_OPTIONS.includes(value as X01BestOfLegs);
}

export function legsNeededToWin(bestOfLegs: number) {
  if (!isSupportedBestOfLegs(bestOfLegs)) {
    throw new Error(`Unsupported best-of format: ${bestOfLegs}`);
  }
  return Math.floor(bestOfLegs / 2) + 1;
}
