import assert from "node:assert/strict";

import {
  addLeaguePlayerToSeasonForUser,
  assignGameNightPhysicalBoardsForUser,
  createGameNightForUser,
  createLeagueForUser,
  createLeaguePlayerForUser,
  createPhysicalBoardForUser,
  getBoardDeviceConnectionForCredential,
  getVenueHardwareForUser,
  linkVenueToLeagueForUser,
  populateGameNightBoardsForUser,
  prepareGameNightTeamsForUser,
  registerBoardDeviceForUser,
  setGameNightStatusForUser,
  setGameNightVenueForUser,
  updateBoardDeviceForUser,
  updateGameNightAttendanceForUser,
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

  const hardwareA = await getVenueHardwareForUser({
    leagueId: leagueA.leagueId,
    userId: ownerUserId,
  });
  assert.ok(hardwareA.venue, "League A should have a default venue.");
  const sharedVenueId = hardwareA.venue.id;

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

  console.log("Venue hardware architecture contract passed.");
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
