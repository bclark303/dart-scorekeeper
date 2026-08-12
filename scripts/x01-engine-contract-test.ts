import assert from "node:assert/strict";

import { scoreTurn } from "@/lib/scoring";
import { evaluateX01Turn, X01RuleError } from "@/lib/x01Engine";

function run() {
  const player = { id: "p1", name: "Player 1", score: 50 };

  const localStraight = scoreTurn(player, 50, "straight_out");
  const sharedStraight = evaluateX01Turn({
    scoreBefore: 50,
    scoreEntered: 50,
    finishRule: "straight_out",
  });
  assert.equal(localStraight.turn.scoreAfter, sharedStraight.scoreAfter);
  assert.equal(localStraight.turn.isBust, sharedStraight.isBust);
  assert.equal(localStraight.turn.isCheckout, sharedStraight.isCheckout);
  assert.equal(localStraight.isLegComplete, true);

  const localBust = scoreTurn({ ...player, score: 32 }, 31, "double_out");
  const sharedBust = evaluateX01Turn({
    scoreBefore: 32,
    scoreEntered: 31,
    finishRule: "double_out",
  });
  assert.equal(localBust.turn.scoreAfter, sharedBust.scoreAfter);
  assert.equal(localBust.turn.isBust, sharedBust.isBust);
  assert.equal(sharedBust.scoreAfter, 32);

  const pendingDouble = scoreTurn({ ...player, score: 40 }, 40, "double_out");
  assert.equal(pendingDouble.needsDoubleOutConfirmation, true);
  assert.equal(pendingDouble.turn.scoreAfter, 0);

  const rejectedManualCheckout = evaluateX01Turn({
    scoreBefore: 40,
    scoreEntered: 40,
    finishRule: "double_out",
    checkoutConfirmed: false,
  });
  assert.equal(rejectedManualCheckout.isBust, true);
  assert.equal(rejectedManualCheckout.scoreAfter, 40);

  const confirmedManualCheckout = evaluateX01Turn({
    scoreBefore: 40,
    scoreEntered: 40,
    finishRule: "double_out",
    checkoutConfirmed: true,
  });
  assert.equal(confirmedManualCheckout.isCheckout, true);
  assert.equal(confirmedManualCheckout.scoreAfter, 0);

  const graphicalCheckout = evaluateX01Turn({
    scoreBefore: 40,
    scoreEntered: 40,
    finishRule: "double_out",
    dartsThrown: 1,
    darts: [{ id: "d1", segment: 20, multiplier: 2, score: 40 }],
  });
  assert.equal(graphicalCheckout.isCheckout, true);
  assert.equal(graphicalCheckout.isBust, false);

  const graphicalInvalidCheckout = evaluateX01Turn({
    scoreBefore: 20,
    scoreEntered: 20,
    finishRule: "double_out",
    dartsThrown: 1,
    darts: [{ id: "d2", segment: 20, multiplier: 1, score: 20 }],
  });
  assert.equal(graphicalInvalidCheckout.isBust, true);
  assert.equal(graphicalInvalidCheckout.scoreAfter, 20);

  assert.throws(
    () =>
      evaluateX01Turn({
        scoreBefore: 100,
        scoreEntered: 60,
        finishRule: "straight_out",
        dartsThrown: 3,
        darts: [
          { id: "bad1", segment: 20, multiplier: 1, score: 20 },
          { id: "bad2", segment: 20, multiplier: 1, score: 20 },
          { id: "bad3", segment: 5, multiplier: 1, score: 5 },
        ],
      }),
    (error: unknown) => error instanceof X01RuleError && /total does not match/.test(error.message),
  );

  console.log("Shared X01 rules engine contract test passed.");
}

run();
