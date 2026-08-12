export type DummyPartnerDart = {
  score: number;
};

export type DummyPartnerTurn = {
  scoreEntered: number;
  darts?: DummyPartnerDart[];
};

export type DummyScoringRule = "half_actual" | "fixed";

export type CalculatedDummyTurn = {
  rule: DummyScoringRule;
  scoreEntered: number;
  dartsThrown: 1 | 2 | 3;
  perDartScores: number[];
};

/**
 * The existing persisted dummyScore value doubles as the rule selector:
 * - 0 => half of the partner's actual turn
 * - 1..180 => fixed score per dummy turn
 *
 * This keeps existing Game Nights backwards compatible and avoids a schema
 * migration solely to add a rule discriminator.
 */
export function getDummyScoringRule(dummyScore: number): DummyScoringRule {
  return dummyScore > 0 ? "fixed" : "half_actual";
}

/**
 * Calculate the automatic half-actual dummy turn from the partner's previous
 * real turn in the current leg.
 *
 * Graphical scoring keeps the partner's actual dart count and halves each dart
 * independently, rounding down. A miss is already represented by a dart score
 * of zero, so it remains zero.
 *
 * Total-turn entry has no individual dart history. For that mode we split the
 * entered turn total into three equal baseline darts, then apply the same
 * floor(score / 2) rule independently to each baseline dart.
 */
export function calculateHalfActualDummyTurn(
  partnerTurn: DummyPartnerTurn | null,
): CalculatedDummyTurn {
  const sourceScores =
    partnerTurn?.darts && partnerTurn.darts.length >= 1 && partnerTurn.darts.length <= 3
      ? partnerTurn.darts.map((dart) => dart.score)
      : Array.from({ length: 3 }, () => (partnerTurn?.scoreEntered ?? 0) / 3);

  const perDartScores = sourceScores.map((score) => Math.floor(score / 2));
  const scoreEntered = perDartScores.reduce((total, score) => total + score, 0);

  return {
    rule: "half_actual",
    scoreEntered,
    dartsThrown: sourceScores.length as 1 | 2 | 3,
    perDartScores,
  };
}

/**
 * Calculate the active dummy rule for a league match.
 *
 * Fixed-score turns are recorded as three-dart turns because no individual dart
 * history exists for a synthetic fixed score. Normal X01 bust/finish rules are
 * still applied by the authoritative X01 engine after this value is calculated.
 */
export function calculateConfiguredDummyTurn(input: {
  dummyScore: number;
  partnerTurn: DummyPartnerTurn | null;
}): CalculatedDummyTurn {
  if (getDummyScoringRule(input.dummyScore) === "fixed") {
    const scoreEntered = Math.max(1, Math.min(180, Math.floor(input.dummyScore)));
    return {
      rule: "fixed",
      scoreEntered,
      dartsThrown: 3,
      perDartScores: [],
    };
  }

  return calculateHalfActualDummyTurn(input.partnerTurn);
}
