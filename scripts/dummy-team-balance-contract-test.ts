import assert from "node:assert/strict";

import {
  dummyCountNeeded,
  dummyTargetSizeForTeams,
} from "@/lib/league/dummyTeamBalance";

function run() {
  assert.equal(
    dummyTargetSizeForTeams({
      mode: "balance",
      realPlayerCounts: [3, 3, 2, 2],
      minTeamPlayers: 2,
      maxTeamPlayers: 4,
    }),
    3,
  );
  assert.deepEqual(
    [3, 3, 2, 2].map((count) => dummyCountNeeded(count, 3)),
    [0, 0, 1, 1],
  );

  assert.equal(
    dummyTargetSizeForTeams({
      mode: "balance",
      realPlayerCounts: [1, 1, 1, 1],
      minTeamPlayers: 2,
      maxTeamPlayers: 4,
    }),
    2,
    "Balancing still honors the configured minimum team size.",
  );

  assert.equal(
    dummyTargetSizeForTeams({
      mode: "balance",
      realPlayerCounts: [5, 4, 4, 3],
      minTeamPlayers: 2,
      maxTeamPlayers: 4,
    }),
    4,
    "Balancing never grows teams beyond the configured maximum.",
  );

  assert.equal(
    dummyTargetSizeForTeams({
      mode: "fill",
      realPlayerCounts: [3, 2, 2],
      minTeamPlayers: 2,
      maxTeamPlayers: 4,
    }),
    2,
    "Existing fill behavior remains fill-to-minimum rather than full balancing.",
  );

  console.log("Dummy team balance contract test passed.");
}

run();
