import { DartThrow } from "@/lib/scoring";

/**
 * Converts a dart into a short readable label.
 *
 * Examples:
 * T20
 * D16
 * S5
 * Bull
 * Outer Bull
 * Miss
 */
export function getDartLabel(dart: DartThrow) {
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

/**
 * Converts a list of darts into a readable turn summary.
 *
 * Example:
 * T20, S20, D10
 */
export function getDartSummary(darts: DartThrow[]) {
  return darts.map(getDartLabel).join(", ");
}
