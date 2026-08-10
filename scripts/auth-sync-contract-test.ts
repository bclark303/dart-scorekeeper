import assert from "node:assert/strict";

import { getAuth } from "@/lib/auth/server";
import {
  listX01MatchArchivesForUser,
  MatchOwnershipError,
  saveX01MatchArchiveForUser,
} from "@/lib/db";
import type { X01MatchArchive } from "@/lib/persistence";

const PASSWORD = "contract-test-password-123";

function buildArchive(matchId: string): X01MatchArchive {
  const now = Date.now();
  const sideOneId = `${matchId}:side:side-1`;
  const sideTwoId = `${matchId}:side:side-2`;
  const participantOneId = `${matchId}:participant:player-1`;
  const participantTwoId = `${matchId}:participant:player-2`;

  return {
    id: matchId,
    status: "complete",
    winnerSideId: sideOneId,
    createdAt: now,
    startedAt: now,
    updatedAt: now + 5,
    completedAt: now + 5,
    settings: {
      startingScore: 301,
      finishRule: "double_out",
      bestOfLegs: 1,
      scoreEntryMode: "turn",
      rotationMode: "independent",
      dummyScore: 0,
    },
    sides: [
      {
        id: sideOneId,
        sideIndex: 0,
        name: "Alice",
        participants: [
          {
            id: participantOneId,
            playerId: null,
            slotIndex: 0,
            displayName: "Alice",
            isDummy: false,
          },
        ],
      },
      {
        id: sideTwoId,
        sideIndex: 1,
        name: "Bob",
        participants: [
          {
            id: participantTwoId,
            playerId: null,
            slotIndex: 0,
            displayName: "Bob",
            isDummy: false,
          },
        ],
      },
    ],
    legs: [
      {
        id: `${matchId}:leg:1`,
        legNumber: 1,
        startingSideId: sideOneId,
        winnerSideId: sideOneId,
        startedAt: now,
        completedAt: now + 5,
        turns: [
          {
            id: `${matchId}:turn:1`,
            sideId: sideOneId,
            participantId: participantOneId,
            turnNumber: 1,
            scoreEntered: 301,
            scoreBefore: 301,
            scoreAfter: 0,
            dartsThrown: 3,
            isBust: false,
            isCheckout: true,
            finishRule: "double_out",
            recordedAt: now + 5,
            darts: [],
          },
        ],
      },
    ],
  };
}

async function run() {
  const auth = getAuth();

  const firstSignUp = await auth.api.signUpEmail({
    body: {
      name: "Auth Contract One",
      email: "auth-contract-one@example.test",
      password: PASSWORD,
    },
  });
  const secondSignUp = await auth.api.signUpEmail({
    body: {
      name: "Auth Contract Two",
      email: "auth-contract-two@example.test",
      password: PASSWORD,
    },
  });

  assert.ok(firstSignUp.user.id, "First auth user should have an ID.");
  assert.ok(secondSignUp.user.id, "Second auth user should have an ID.");
  assert.notEqual(firstSignUp.user.id, secondSignUp.user.id);

  const signedIn = await auth.api.signInEmail({
    body: {
      email: "auth-contract-one@example.test",
      password: PASSWORD,
    },
  });
  assert.equal(
    signedIn.user.id,
    firstSignUp.user.id,
    "Email/password sign-in should resolve the created account.",
  );

  const archive = buildArchive("match-auth-sync-contract");

  await saveX01MatchArchiveForUser(firstSignUp.user.id, archive);
  await saveX01MatchArchiveForUser(firstSignUp.user.id, archive);

  const firstUserMatches = await listX01MatchArchivesForUser(
    firstSignUp.user.id,
  );
  assert.equal(
    firstUserMatches.filter((candidate) => candidate.id === archive.id).length,
    1,
    "Retrying the same owned match must remain idempotent.",
  );
  assert.equal(firstUserMatches[0]?.sides[0]?.name, "Alice");
  assert.equal(firstUserMatches[0]?.legs[0]?.turns[0]?.scoreEntered, 301);

  const secondUserMatches = await listX01MatchArchivesForUser(
    secondSignUp.user.id,
  );
  assert.equal(
    secondUserMatches.some((candidate) => candidate.id === archive.id),
    false,
    "Another account must not be able to read the first user's match.",
  );

  await assert.rejects(
    () => saveX01MatchArchiveForUser(secondSignUp.user.id, archive),
    (error: unknown) => error instanceof MatchOwnershipError,
    "Another account must not be able to overwrite the first user's match ID.",
  );

  console.log("Authentication and sync ownership contract test passed.");
}

run().catch((error) => {
  console.error("Authentication and sync ownership contract test failed.", error);
  process.exitCode = 1;
});
