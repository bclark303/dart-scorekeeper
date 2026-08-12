export type DummyPartnerDart = {
  score: number;
};

export type DummyPartnerTurn = {
  scoreEntered: number;
  darts?: DummyPartnerDart[];
};

export type CalculatedDummyTurn = {
  scoreEntered: number;
  dartsThrown: 1 | 2 | 3;
  perDartScores: number[];
};

/**
 * Calculate the automatic dummy turn from the partner's previous real turn.
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
    scoreEntered,
    dartsThrown: sourceScores.length as 1 | 2 | 3,
    perDartScores,
  };
}
