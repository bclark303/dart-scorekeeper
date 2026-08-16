import assert from "node:assert/strict";

import {
  addLeaguePlayerToSeasonForUser,
  assignGameNightPhysicalBoardsForUser,
  createGameNightForUser,
  createLeagueForUser,
  createLeaguePlayerForUser,
  createPhysicalBoardForUser,
  createVenueForLeagueForUser,
  deleteEmptyVenueForUser,
  getBoardDeviceConnectionForCredential,
  getVenueHardwareForUser,
  linkVenueToLeagueForUser,
  listVenuesForLeagueForUser,
  populateGameNightBoardsForUser,
  prepareGameNightTeamsForUser,
  registerBoardDeviceForUser,
  setGameNightStatusForUser,
  setGameNightVenueForUser,
  unlinkVenueFromLeagueForUser,
  updateBoardDeviceForUser,
  updateGameNightAttendanceForUser,
  updateVenueForUser,
} from "@/lib/db";
import { DEFAULT_GAME_NIGHT_SETTINGS } from "@/lib/league/gameNightContracts";

const BASE_NOW = 1_930_000_000_000;

async function createLeagueWithTwoPlayers(input: {
  suffix: string;
  label: string;
  ownerUserId: string;
  nowOffset: number;
}) {
  const leagueId = `${input.label}-league-${input.suffix}`;
  const seasonId = `${input.label}-season-${input.suffix}`;

  await createLeagueForUser({
    id: leagueId,
    membershipId: `${input.label}-membership-${input.suffix}`,
    userId: input.ownerUserId,
    name: `${input.label} League`,
    firstSeason: { id: seasonId, name: "Season One" },
    now: BASE_NOW + input.nowOffset,
  });

  const leaguePlayerIds: string[] = [];
  for (let index = 0; index < 2; index += 1) {
    const leaguePlayerId = `${input.label}-league-player-${index}-${input.suffix}`;
    leaguePlayerIds.push(leaguePlayerId);
    await createLeaguePlayerForUser({
      playerId: `${input.label}-player-${index}-${input.suffix}`,
      leaguePlayerId,
      leagueId,
      userId: input.ownerUserId,
      displayName: `${input.label} Player ${index + 1}`,
      now: BASE_NOW + input.nowOffset + 10 + index,
    });
    await addLeaguePlayerToSeasonForUser({
      rosterEntryId: `${input.label}-roster-${index}-${input.suffix}`,
      leagueId,
      seasonId,
      leaguePlayerId,
      userId: input.ownerUserId,
      now: BASE_NOW + input.nowOffset + 20 + index,
    });
  }

  return { leagueId, seasonId, leaguePlayerIds };
}

async function createReadyNight(input: {
  suffix: string;
  label: string;
  leagueId: string;
  seasonId: string;
  leaguePlayerIds: string[];
  ownerUserId: string;
  venueId: string;
  physicalBoardId: string;
  scheduledAt: number;
  nowOffset: number;
}) {
  const gameNightId = `${input.label}-night-${input.suffix}`;
  await createGameNightForUser({
    id: gameNightId,
    leagueId: input.leagueId,
    seasonId: input.seasonId,
    userId: input.ownerUserId,
    name: `${input.label} Game Night`,
    scheduledAt: input.scheduledAt,
    settings: {
      ...DEFAULT_GAME_NIGHT_SETTINGS,
      targetTeamCount: 2,
      minTeamPlayers: 1,
      maxTeamPlayers: 1,
      dummyPlayerMode: "none",
      boardCount: 1,
      roundCount: 1,
      legsPerMatch: 1,
      startingScore: 301,
      finishRule: "double",
    },
    now: BASE_NOW + input.nowOffset,
  });

  await setGameNightVenueForUser(gameNightId, input.venueId, input.ownerUserId);
  await assignGameNightPhysicalBoardsForUser(
    gameNightId,
    [input.physicalBoardId],
    input.ownerUserId,
  );

  for (let index = 0; index < input.leaguePlayerIds.length; index += 1) {
    await updateGameNightAttendanceForUser({
      gameNightId,
      leaguePlayerId: input.leaguePlayerIds[index],
      userId: input.ownerUserId,
      checkedIn: true,
      duesStatus: "paid",
      now: BASE_NOW + input.nowOffset + 100 + index,
    });
  }

  await prepareGameNightTeamsForUser(gameNightId, input.ownerUserId);
  const ready = await populateGameNightBoardsForUser(gameNightId, input.ownerUserId);
  assert.equal(ready.boards.length, 1);
  assert.equal(ready.boards[0].physicalBoardId, input.physicalBoardId);
  assert.ok(ready.rounds?.[0].pairings[0]?.matchSessionId);
  return gameNightId;
}

async function run() {
  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const ownerUserId = `venue-owner-${suffix}`;

  const leagueA = await createLeagueWithTwoPlayers({
    suffix,
    label: "alpha",
    ownerUserId,
    nowOffset: 0,
  });
  const leagueB = await createLeagueWithTwoPlayers({
    suffix,
    label: "bravo",
    ownerUserId,
    nowOffset: 1_000,
  });

  // Archiving the only venue is an intentional administrative state. A later
// Game Night must not silently invent a replacement venue.
const leagueC = await createLeagueWithTwoPlayers({
  suffix,
  label: "charlie",
  ownerUserId,
  nowOffset: 1_250,
});
const hardwareC = await getVenueHardwareForUser({
  leagueId: leagueC.leagueId,
  userId: ownerUserId,
});
assert.ok(hardwareC.venue, "League C should start with a default venue.");
await updateVenueForUser({
  venueId: hardwareC.venue.id,
  userId: ownerUserId,
  status: "archived",
  now: BASE_NOW + 1_300,
});
await assert.rejects(
  () => createGameNightForUser({
    id: `archived-only-night-${suffix}`,
    leagueId: leagueC.leagueId,
    seasonId: leagueC.seasonId,
    userId: ownerUserId,
    name: "Archived Only Venue Night",
    scheduledAt: BASE_NOW + 250_000,
    settings: { ...DEFAULT_GAME_NIGHT_SETTINGS, boardCount: 1 },
    now: BASE_NOW + 1_350,
  }),
  /does not have an active venue/i,
  "Game Night creation must require an explicit restore/create when all linked venues are archived.",
);

  const hardwareA = await getVenueHardwareForUser({
    leagueId: leagueA.leagueId,
    userId: ownerUserId,
  });
  assert.ok(hardwareA.venue, "League A should have a default venue.");
  const sharedVenueId = hardwareA.venue.id;

  // Venue administration: a newly created empty venue can be renamed and
  // permanently deleted because it has no hardware or history yet.
  const temporaryVenue = await createVenueForLeagueForUser({
    leagueId: leagueA.leagueId,
    userId: ownerUserId,
    name: "Temporary Venue",
    now: BASE_NOW + 1_500,
  });
  const renamedTemporaryVenue = await updateVenueForUser({
    venueId: temporaryVenue.id,
    userId: ownerUserId,
    name: "Temporary Venue Renamed",
    now: BASE_NOW + 1_501,
  });
  assert.equal(renamedTemporaryVenue.name, "Temporary Venue Renamed");
  await deleteEmptyVenueForUser({ venueId: temporaryVenue.id, userId: ownerUserId });
  assert.equal(
    (await listVenuesForLeagueForUser(leagueA.leagueId, ownerUserId)).some(
      (venue) => venue.id === temporaryVenue.id,
    ),
    false,
    "An empty venue should be permanently deletable.",
  );

  await linkVenueToLeagueForUser({
    leagueId: leagueB.leagueId,
    venueId: sharedVenueId,
    userId: ownerUserId,
    now: BASE_NOW + 2_000,
  });

  const hardwareB = await getVenueHardwareForUser({
    leagueId: leagueB.leagueId,
    venueId: sharedVenueId,
    userId: ownerUserId,
  });
  assert.equal(hardwareB.venue?.id, sharedVenueId);
  assert.ok(
    hardwareB.venues?.some((venue) => venue.id === sharedVenueId),
    "A second league should be able to use the same venue instead of receiving an isolated hardware pool.",
  );

  const board1 = await createPhysicalBoardForUser({
    leagueId: leagueA.leagueId,
    venueId: sharedVenueId,
    userId: ownerUserId,
    boardNumber: 1,
    name: "Main Board 1",
    now: BASE_NOW + 3_000,
  });
  const board2 = await createPhysicalBoardForUser({
    leagueId: leagueA.leagueId,
    venueId: sharedVenueId,
    userId: ownerUserId,
    boardNumber: 2,
    name: "Main Board 2",
    now: BASE_NOW + 3_001,
  });

  await assert.rejects(
    () => deleteEmptyVenueForUser({ venueId: sharedVenueId, userId: ownerUserId }),
    /Archive it instead/i,
    "A venue with real hardware must not be permanently deleted.",
  );

  const scorerA = await registerBoardDeviceForUser({
    id: `scorer-a-${suffix}`,
    leagueId: leagueA.leagueId,
    venueId: sharedVenueId,
    userId: ownerUserId,
    name: "Scorer A",
    physicalBoardId: board1.id,
    now: BASE_NOW + 4_000,
  });
  const spareScorer = await registerBoardDeviceForUser({
    id: `scorer-spare-${suffix}`,
    leagueId: leagueA.leagueId,
    venueId: sharedVenueId,
    userId: ownerUserId,
    name: "Spare Scorer",
    physicalBoardId: null,
    now: BASE_NOW + 4_001,
  });
  assert.equal(scorerA.device.physicalBoardId, board1.id);
  assert.equal(spareScorer.device.physicalBoardId, null);

  const nightA = await createReadyNight({
    suffix,
    label: "alpha",
    leagueId: leagueA.leagueId,
    seasonId: leagueA.seasonId,
    leaguePlayerIds: leagueA.leaguePlayerIds,
    ownerUserId,
    venueId: sharedVenueId,
    physicalBoardId: board1.id,
    scheduledAt: BASE_NOW + 100_000,
    nowOffset: 10_000,
  });
  await setGameNightStatusForUser(nightA, ownerUserId, "active");

  await assert.rejects(
    () => updateVenueForUser({
      venueId: sharedVenueId,
      userId: ownerUserId,
      status: "archived",
      now: BASE_NOW + 10_500,
    }),
    /unfinished Game Night/i,
    "A venue with an active or otherwise unfinished Game Night must not be archived.",
  );

  const scorerAConnection = await getBoardDeviceConnectionForCredential(
    scorerA.deviceKey,
  );
  assert.equal(scorerAConnection.assignment?.gameNightId, nightA);
  assert.equal(scorerAConnection.assignment?.physicalBoardId, board1.id);
  const nightAMatchId = scorerAConnection.assignment?.matchSessionId;
  assert.ok(nightAMatchId, "Scorer A should see the active match on physical Board 1.");

  // The second league may be PREPARED on the same board. Exclusivity belongs
  // at start time, not schedule/setup time.
  const nightB = await createReadyNight({
    suffix,
    label: "bravo",
    leagueId: leagueB.leagueId,
    seasonId: leagueB.seasonId,
    leaguePlayerIds: leagueB.leaguePlayerIds,
    ownerUserId,
    venueId: sharedVenueId,
    physicalBoardId: board1.id,
    scheduledAt: BASE_NOW + 100_000,
    nowOffset: 20_000,
  });

  await assert.rejects(
    () => setGameNightStatusForUser(nightB, ownerUserId, "active"),
    /already in use by another active Game Night/i,
    "Two active Game Nights must not claim the same physical board.",
  );

  // Move League B to a different real board and rebuild the board/fixture
  // mapping. Both leagues may then run simultaneously in the same venue.
  await assignGameNightPhysicalBoardsForUser(nightB, [board2.id], ownerUserId);
  const rePreparedB = await populateGameNightBoardsForUser(nightB, ownerUserId);
  assert.equal(rePreparedB.boards[0].physicalBoardId, board2.id);
  await setGameNightStatusForUser(nightB, ownerUserId, "active");

  // Replace the scorer serving Board 1 while League A is live. The old device
  // becomes a spare and the new device must inherit the BOARD'S active match,
  // proving that the match is attached to hardware location rather than device.
  await updateBoardDeviceForUser({
    deviceId: spareScorer.device.id,
    userId: ownerUserId,
    physicalBoardId: board1.id,
    now: BASE_NOW + 30_000,
  });

  const afterSwap = await getVenueHardwareForUser({
    leagueId: leagueA.leagueId,
    venueId: sharedVenueId,
    userId: ownerUserId,
  });
  const oldScorer = afterSwap.devices?.find((device) => device.id === scorerA.device.id);
  const replacement = afterSwap.devices?.find((device) => device.id === spareScorer.device.id);
  assert.equal(oldScorer?.physicalBoardId, null, "The replaced scorer should become a spare automatically.");
  assert.equal(replacement?.physicalBoardId, board1.id);

  const replacementConnection = await getBoardDeviceConnectionForCredential(
    spareScorer.deviceKey,
  );
  assert.equal(replacementConnection.assignment?.gameNightId, nightA);
  assert.equal(replacementConnection.assignment?.physicalBoardId, board1.id);
  assert.equal(
    replacementConnection.assignment?.matchSessionId,
    nightAMatchId,
    "Replacing a scorer must not create, move, or restart the active match.",
  );

  const oldConnection = await getBoardDeviceConnectionForCredential(scorerA.deviceKey);
  assert.equal(oldConnection.assignment, null, "The old scorer should remain paired but idle as a spare.");

  // Finish/cancel the live work so the venue is safe to archive. Completed and
  // cancelled history remains attached and does not prevent archival.
  await setGameNightStatusForUser(nightA, ownerUserId, "cancelled");
  await setGameNightStatusForUser(nightB, ownerUserId, "cancelled");
  const archived = await updateVenueForUser({
    venueId: sharedVenueId,
    userId: ownerUserId,
    status: "archived",
    now: BASE_NOW + 40_000,
  });
  assert.equal(archived.status, "archived");

  // Keep another active venue available so a fresh Game Night can be created,
  // then prove the archived shared venue cannot be selected for it.
  const fallbackVenue = await createVenueForLeagueForUser({
    leagueId: leagueA.leagueId,
    userId: ownerUserId,
    name: "Fallback Active Venue",
    now: BASE_NOW + 40_100,
  });
  const freshNightId = `archive-guard-night-${suffix}`;
  await createGameNightForUser({
    id: freshNightId,
    leagueId: leagueA.leagueId,
    seasonId: leagueA.seasonId,
    userId: ownerUserId,
    name: "Archive Guard Night",
    scheduledAt: BASE_NOW + 200_000,
    settings: {
      ...DEFAULT_GAME_NIGHT_SETTINGS,
      boardCount: 1,
    },
    now: BASE_NOW + 40_200,
  });
  await assert.rejects(
    () => setGameNightVenueForUser(freshNightId, sharedVenueId, ownerUserId),
    /Archived venues cannot be assigned/i,
    "Archived venues must not be assignable to new Game Nights.",
  );

  const restored = await updateVenueForUser({
    venueId: sharedVenueId,
    userId: ownerUserId,
    status: "active",
    now: BASE_NOW + 40_300,
  });
  assert.equal(restored.status, "active");

  // A shared venue can be removed from one league after that league has no
  // unfinished work there, without affecting the other league's access.
  await unlinkVenueFromLeagueForUser({
    leagueId: leagueB.leagueId,
    venueId: sharedVenueId,
    userId: ownerUserId,
  });
  assert.equal(
    (await listVenuesForLeagueForUser(leagueB.leagueId, ownerUserId)).some(
      (venue) => venue.id === sharedVenueId,
    ),
    false,
    "Removing a shared venue from League B must leave the venue itself intact.",
  );
  assert.equal(
    (await listVenuesForLeagueForUser(leagueA.leagueId, ownerUserId)).some(
      (venue) => venue.id === sharedVenueId,
    ),
    true,
    "League A must retain access to the shared venue.",
  );

  // Once only League A remains linked, unlinking the venue would orphan its
  // hardware/history. The safe choices are archive or empty-delete instead.
  await assert.rejects(
    () => unlinkVenueFromLeagueForUser({
      leagueId: leagueA.leagueId,
      venueId: sharedVenueId,
      userId: ownerUserId,
    }),
    /only league link/i,
  );

  // Clean up the fallback venue only if it stayed empty. Creating the fresh
  // Game Night may have selected it automatically, so it should now be protected
  // from destructive deletion as historical/structural data.
  await assert.rejects(
    () => deleteEmptyVenueForUser({ venueId: fallbackVenue.id, userId: ownerUserId }),
    /Archive it instead/i,
  );

  console.log("Venue hardware and administration contract passed.");
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
