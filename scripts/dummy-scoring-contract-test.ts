import assert from "node:assert/strict";

import { calculateHalfActualDummyTurn } from "@/lib/league/dummyScoring";

function run() {
  const graphical = calculateHalfActualDummyTurn({
    scoreEntered: 79,
    darts: [{ score: 60 }, { score: 0 }, { score: 19 }],
  });
  assert.deepEqual(graphical.perDartScores, [30, 0, 9]);
  assert.equal(graphical.scoreEntered, 39);
  assert.equal(graphical.dartsThrown, 3);

  const twoDarts = calculateHalfActualDummyTurn({
    scoreEntered: 75,
    darts: [{ score: 50 }, { score: 25 }],
  });
  assert.deepEqual(twoDarts.perDartScores, [25, 12]);
  assert.equal(twoDarts.scoreEntered, 37);
  assert.equal(twoDarts.dartsThrown, 2);

  const totalTurn = calculateHalfActualDummyTurn({ scoreEntered: 100 });
  assert.deepEqual(totalTurn.perDartScores, [16, 16, 16]);
  assert.equal(totalTurn.scoreEntered, 48);
  assert.equal(totalTurn.dartsThrown, 3);

  const evenTotal = calculateHalfActualDummyTurn({ scoreEntered: 60 });
  assert.deepEqual(evenTotal.perDartScores, [10, 10, 10]);
  assert.equal(evenTotal.scoreEntered, 30);

  const noPartner = calculateHalfActualDummyTurn(null);
  assert.deepEqual(noPartner.perDartScores, [0, 0, 0]);
  assert.equal(noPartner.scoreEntered, 0);

  console.log("Dummy scoring contract test passed.");
}

run();
