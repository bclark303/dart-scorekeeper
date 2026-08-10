import assert from "node:assert/strict";

import {
  archivePlayer,
  listPlayers,
  listRecentX01MatchSummaries,
  savePlayer,
  saveX01MatchArchive,
} from "@/lib/db";
import type { X01MatchArchive } from "@/lib/persistence";

const MATCH_ID = "match-contract-test";
const SIDE_ONE_ID = `${MATCH_ID}:side:side-1`;
const SIDE_TWO_ID = `${MATCH_ID}:side:side-2`;
const PLAYER_ID = "player-contract-test";
const PARTICIPANT_ONE_ID = `${MATCH_ID}:participant:side-1-member-1`;
const PARTICIPANT_TWO_ID = `${MATCH_ID}:participant:side-2-member-1`;

async function run() {
  const now = Date.now();

  const player = await savePlayer({
    id: PLAYER_ID,
    displayName: "Contract Tester",
    createdAt: now,
    updatedAt: now,
  });

  assert.equal(player.id, PLAYER_ID);
  assert.equal(player.displayName, "Contract Tester");

  const renamedPlayer = await savePlayer({
    id: PLAYER_ID,
    displayName: "Contract Tester Renamed",
    createdAt: now,
    updatedAt: now + 1,
  });

  assert.equal(renamedPlayer.displayName, "Contract Tester Renamed");

  const archive: X01MatchArchive = {
    id: MATCH_ID,
    status: "complete",
    winnerSideId: SIDE_ONE_ID,
    createdAt: now,
    startedAt: now,
    updatedAt: now + 10,
    completedAt: now + 10,
    settings: {
      startingScore: 301,
      finishRule: "double-out",
      bestOfLegs: 1,
      scoreEntryMode: "dart",
      rotationMode: "independent",
      dummyScore: 0,
    },
    sides: [
      {
        id: SIDE_ONE_ID,
        sideIndex: 0,
        name: "Side A",
        participants: [
          {
            id: PARTICIPANT_ONE_ID,
            playerId: PLAYER_ID,
            slotIndex: 0,
            displayName: "Contract Tester",
            isDummy: false,
          },
        ],
      },
      {
        id: SIDE_TWO_ID,
        sideIndex: 1,
        name: "Side B",
        participants: [
          {
            id: PARTICIPANT_TWO_ID,
            playerId: null,
            slotIndex: 0,
            displayName: "Guest Tester",
            isDummy: false,
          },
        ],
      },
    ],
    legs: [
      {
        id: `${MATCH_ID}:leg:1`,
        legNumber: 1,
        startingSideId: SIDE_ONE_ID,
        winnerSideId: SIDE_ONE_ID,
        startedAt: now,
        completedAt: now + 10,
        turns: [
          {
            id: `${MATCH_ID}:turn:turn-1`,
            sideId: SIDE_ONE_ID,
            participantId: PARTICIPANT_ONE_ID,
            turnNumber: 1,
            scoreEntered: 180,
            scoreBefore: 301,
            scoreAfter: 121,
            dartsThrown: 3,
            isBust: false,
            isCheckout: false,
            finishRule: "double-out",
            recordedAt: now + 5,
            darts: [
              {
                id: `${MATCH_ID}:dart:dart-1`,
                dartIndex: 0,
                segment: "20",
                multiplier: 3,
                score: 60,
              },
              {
                id: `${MATCH_ID}:dart:dart-2`,
                dartIndex: 1,
                segment: "20",
                multiplier: 3,
                score: 60,
              },
              {
                id: `${MATCH_ID}:dart:dart-3`,
                dartIndex: 2,
                segment: "20",
                multiplier: 3,
                score: 60,
              },
            ],
          },
          {
            id: `${MATCH_ID}:turn:turn-2`,
            sideId: SIDE_ONE_ID,
            participantId: PARTICIPANT_ONE_ID,
            turnNumber: 2,
            scoreEntered: 121,
            scoreBefore: 121,
            scoreAfter: 0,
            dartsThrown: 3,
            isBust: false,
            isCheckout: true,
            finishRule: "double-out",
            recordedAt: now + 10,
            darts: [
              {
                id: `${MATCH_ID}:dart:dart-4`,
                dartIndex: 0,
                segment: "20",
                multiplier: 3,
                score: 60,
              },
              {
                id: `${MATCH_ID}:dart:dart-5`,
                dartIndex: 1,
                segment: "11",
                multiplier: 3,
                score: 33,
              },
              {
                id: `${MATCH_ID}:dart:dart-6`,
                dartIndex: 2,
                segment: "14",
                multiplier: 2,
                score: 28,
              },
            ],
          },
        ],
      },
    ],
  };

  await saveX01MatchArchive(archive);

  const summariesAfterFirstSave = await listRecentX01MatchSummaries(100);
  const firstSummary = summariesAfterFirstSave.find(
    (summary) => summary.id === MATCH_ID,
  );

  assert.ok(firstSummary, "Saved X01 match should appear in recent summaries.");
  assert.equal(firstSummary.startingScore, 301);
  assert.equal(firstSummary.finishRule, "double-out");
  assert.equal(firstSummary.bestOfLegs, 1);
  assert.equal(firstSummary.winnerSideId, SIDE_ONE_ID);

  // Saving the exact same durable match ID again must be safe. The repository
  // replaces the child snapshot transactionally instead of duplicating rows.
  await saveX01MatchArchive({
    ...archive,
    updatedAt: archive.updatedAt + 1,
  });

  const summariesAfterRetry = await listRecentX01MatchSummaries(100);
  assert.equal(
    summariesAfterRetry.filter((summary) => summary.id === MATCH_ID).length,
    1,
    "Retrying the same archive must not create a duplicate match.",
  );

  assert.ok(
    (await listPlayers()).some((candidate) => candidate.id === PLAYER_ID),
    "Active player should appear in the default player list.",
  );

  await archivePlayer(PLAYER_ID, now + 20);

  assert.ok(
    !(await listPlayers()).some((candidate) => candidate.id === PLAYER_ID),
    "Archived player should be hidden from the default player list.",
  );
  assert.ok(
    (await listPlayers(true)).some((candidate) => candidate.id === PLAYER_ID),
    "Archived player should remain queryable when archived records are requested.",
  );

  console.log("Database repository contract test passed.");
}

run().catch((error) => {
  console.error("Database repository contract test failed.", error);
  process.exitCode = 1;
});
