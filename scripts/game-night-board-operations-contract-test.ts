import assert from "node:assert/strict";

import {
  addLeaguePlayerToSeasonForUser,
  assignGameNightPhysicalBoardsForUser,
  createGameNightForUser,
  createLeagueForUser,
  createLeaguePlayerForUser,
  createPhysicalBoardForUser,
  getBoardDeviceConnectionForCredential,
  getGameNightForUser,
  getVenueHardwareForUser,
  linkVenueToLeagueForUser,
  listGameNightBoardUsagesForUser,
  populateGameNightBoardsForUser,
  prepareGameNightTeamsForUser,
  registerBoardDeviceForUser,
  relocateGameNightBoardForUser,
  setGameNightStatusForUser,
  setGameNightVenueForUser,
  updateGameNightAttendanceForUser,
  updatePhysicalBoardForUser,
} from "@/lib/db";
import { DEFAULT_GAME_NIGHT_SETTINGS } from "@/lib/league/gameNightContracts";

const BASE_NOW = 1_940_000_000_000;

async function createLeagueWithTwoPlayers(input: {
  suffix: string;
  label: string;
  ownerUserId: string;
  nowOffset: number;
}) {
  const leagueId = `${input.label}-ops-league-${input.suffix}`;
  const seasonId = `${input.label}-ops-season-${input.suffix}`;
  await createLeagueForUser({
    id: leagueId,
    membershipId: `${input.label}-ops-membership-${input.suffix}`,
    userId: input.ownerUserId,
    name: `${input.label} Operations League`,
    firstSeason: { id: seasonId, name: "Season One" },
    now: BASE_NOW + input.nowOffset,
  });

  const leaguePlayerIds: string[] = [];
  for (let index = 0; index < 2; index += 1) {
    const leaguePlayerId = `${input.label}-ops-league-player-${index}-${input.suffix}`;
    leaguePlayerIds.push(leaguePlayerId);
    await createLeaguePlayerForUser({
      playerId: `${input.label}-ops-player-${index}-${input.suffix}`,
      leaguePlayerId,
      leagueId,
      userId: input.ownerUserId,
      displayName: `${input.label} Player ${index + 1}`,
      now: BASE_NOW + input.nowOffset + 10 + index,
    });
    await addLeaguePlayerToSeasonForUser({
      rosterEntryId: `${input.label}-ops-roster-${index}-${input.suffix}`,
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
  nowOffset: number;
}) {
  const gameNightId = `${input.label}-ops-night-${input.suffix}`;
  await createGameNightForUser({
    id: gameNightId,
    leagueId: input.leagueId,
    seasonId: input.seasonId,
    userId: input.ownerUserId,
    name: `${input.label} Operations Night`,
    scheduledAt: BASE_NOW + 100_000 + input.nowOffset,
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
  await populateGameNightBoardsForUser(gameNightId, input.ownerUserId);
  return gameNightId;
}

async function run() {
  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const ownerUserId = `board-ops-owner-${suffix}`;
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
  assert.ok(hardwareA.venue);
  const venueId = hardwareA.venue.id;
  await linkVenueToLeagueForUser({
    leagueId: leagueB.leagueId,
    venueId,
    userId: ownerUserId,
    now: BASE_NOW + 2_000,
  });

  const board1 = await createPhysicalBoardForUser({
    leagueId: leagueA.leagueId,
    venueId,
    userId: ownerUserId,
    boardNumber: 1,
    name: "Board 1",
    now: BASE_NOW + 3_000,
  });
  const board2 = await createPhysicalBoardForUser({
    leagueId: leagueA.leagueId,
    venueId,
    userId: ownerUserId,
    boardNumber: 2,
    name: "Board 2",
    now: BASE_NOW + 3_001,
  });
  const board3 = await createPhysicalBoardForUser({
    leagueId: leagueA.leagueId,
    venueId,
    userId: ownerUserId,
    boardNumber: 3,
    name: "Board 3",
    now: BASE_NOW + 3_002,
  });

  const scorer1 = await registerBoardDeviceForUser({
    id: `board-ops-scorer-1-${suffix}`,
    leagueId: leagueA.leagueId,
    venueId,
    userId: ownerUserId,
    name: "Board 1 Scorer",
    physicalBoardId: board1.id,
    now: BASE_NOW + 4_000,
  });
  const scorer3 = await registerBoardDeviceForUser({
    id: `board-ops-scorer-3-${suffix}`,
    leagueId: leagueA.leagueId,
    venueId,
    userId: ownerUserId,
    name: "Board 3 Scorer",
    physicalBoardId: board3.id,
    now: BASE_NOW + 4_001,
  });

  const nightA = await createReadyNight({
    suffix,
    label: "alpha",
    leagueId: leagueA.leagueId,
    seasonId: leagueA.seasonId,
    leaguePlayerIds: leagueA.leaguePlayerIds,
    ownerUserId,
    venueId,
    physicalBoardId: board1.id,
    nowOffset: 10_000,
  });
  await setGameNightStatusForUser(nightA, ownerUserId, "active");
  const activeA = await getGameNightForUser(nightA, ownerUserId);
  const boardSlotId = activeA.boards[0].id;
  const matchSessionId = activeA.pairings[0]?.matchSessionId;
  assert.ok(matchSessionId, "Night A should have an active match session.");

  const nightB = await createReadyNight({
    suffix,
    label: "bravo",
    leagueId: leagueB.leagueId,
    seasonId: leagueB.seasonId,
    leaguePlayerIds: leagueB.leaguePlayerIds,
    ownerUserId,
    venueId,
    physicalBoardId: board1.id,
    nowOffset: 20_000,
  });

  const plannedUsages = await listGameNightBoardUsagesForUser(nightA, ownerUserId);
  assert.ok(
    plannedUsages.some(
      (usage) =>
        usage.physicalBoardId === board1.id &&
        usage.gameNightId === nightB &&
        usage.gameNightStatus === "ready",
    ),
    "Pre-play board sharing should be visible as an allocation warning.",
  );
  await assert.rejects(
    () => setGameNightStatusForUser(nightB, ownerUserId, "active"),
    /already in use by another active Game Night/i,
  );

  await assignGameNightPhysicalBoardsForUser(nightB, [board2.id], ownerUserId);
  await populateGameNightBoardsForUser(nightB, ownerUserId);
  await setGameNightStatusForUser(nightB, ownerUserId, "active");

  await updatePhysicalBoardForUser({
    boardId: board1.id,
    userId: ownerUserId,
    status: "out_of_service",
    now: BASE_NOW + 30_000,
  });

  await assert.rejects(
    () =>
      relocateGameNightBoardForUser({
        gameNightId: nightA,
        gameNightBoardId: boardSlotId,
        physicalBoardId: board2.id,
        userId: ownerUserId,
        now: BASE_NOW + 30_100,
      }),
    /already in use/i,
    "A live match cannot move onto a physical board used by another active Game Night.",
  );

  const relocated = await relocateGameNightBoardForUser({
    gameNightId: nightA,
    gameNightBoardId: boardSlotId,
    physicalBoardId: board3.id,
    userId: ownerUserId,
    now: BASE_NOW + 30_200,
  });
  assert.equal(relocated.boards[0].id, boardSlotId, "The logical Game Night board ID must be preserved.");
  assert.equal(relocated.boards[0].physicalBoardId, board3.id);
  assert.equal(
    relocated.pairings[0]?.matchSessionId,
    matchSessionId,
    "Moving a live board must preserve the match-session identity and score history.",
  );

  const destinationConnection = await getBoardDeviceConnectionForCredential(scorer3.deviceKey);
  assert.equal(destinationConnection.assignment?.gameNightId, nightA);
  assert.equal(destinationConnection.assignment?.physicalBoardId, board3.id);
  assert.equal(destinationConnection.assignment?.matchSessionId, matchSessionId);

  const oldBoardConnection = await getBoardDeviceConnectionForCredential(scorer1.deviceKey);
  assert.equal(
    oldBoardConnection.assignment,
    null,
    "A scorer left on the old physical board should no longer receive the moved match.",
  );

  const activeUsages = await listGameNightBoardUsagesForUser(nightA, ownerUserId);
  assert.ok(
    activeUsages.some(
      (usage) =>
        usage.physicalBoardId === board2.id &&
        usage.gameNightId === nightB &&
        usage.gameNightStatus === "active",
    ),
    "Live operations should expose active board conflicts for destination filtering.",
  );

  await setGameNightStatusForUser(nightA, ownerUserId, "cancelled");
  await setGameNightStatusForUser(nightB, ownerUserId, "cancelled");
  console.log("Game Night board operations contract test passed.");
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
