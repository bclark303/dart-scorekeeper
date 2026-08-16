import assert from "node:assert/strict";

import {
  addLeaguePlayerToSeasonForUser,
  assignGameNightPhysicalBoardsForUser,
  authenticateBoardDeviceCredential,
  createGameNightForUser,
  createLeagueForUser,
  createLeaguePlayerForUser,
  createPhysicalBoardForUser,
  getGameNightReadinessForUser,
  getVenueHardwareForUser,
  populateGameNightBoardsForUser,
  prepareGameNightTeamsForUser,
  registerBoardDeviceForUser,
  setGameNightVenueForUser,
  updateGameNightAttendanceForUser,
  updatePhysicalBoardForUser,
} from "@/lib/db";
import { DEFAULT_GAME_NIGHT_SETTINGS } from "@/lib/league/gameNightContracts";

async function run() {
  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const ownerUserId = `readiness-owner-${suffix}`;
  const leagueId = `readiness-league-${suffix}`;
  const seasonId = `readiness-season-${suffix}`;
  const gameNightId = `readiness-night-${suffix}`;

  await createLeagueForUser({
    id: leagueId,
    membershipId: `readiness-membership-${suffix}`,
    userId: ownerUserId,
    name: "Readiness League",
    firstSeason: { id: seasonId, name: "Readiness Season" },
    now: Date.now(),
  });

  const leaguePlayerIds: string[] = [];
  for (let index = 0; index < 2; index += 1) {
    const leaguePlayerId = `readiness-league-player-${index}-${suffix}`;
    leaguePlayerIds.push(leaguePlayerId);
    await createLeaguePlayerForUser({
      playerId: `readiness-player-${index}-${suffix}`,
      leaguePlayerId,
      leagueId,
      userId: ownerUserId,
      displayName: `Readiness Player ${index + 1}`,
      now: Date.now() + index,
    });
    await addLeaguePlayerToSeasonForUser({
      rosterEntryId: `readiness-roster-${index}-${suffix}`,
      leagueId,
      seasonId,
      leaguePlayerId,
      userId: ownerUserId,
      now: Date.now() + 10 + index,
    });
  }

  const hardware = await getVenueHardwareForUser({ leagueId, userId: ownerUserId });
  assert.ok(hardware.venue, "New league should have an active default venue.");
  const venueId = hardware.venue.id;
  const physicalBoard = await createPhysicalBoardForUser({
    leagueId,
    venueId,
    userId: ownerUserId,
    boardNumber: 1,
    name: "Readiness Board",
    now: Date.now() + 20,
  });

  await createGameNightForUser({
    id: gameNightId,
    leagueId,
    seasonId,
    userId: ownerUserId,
    name: "Readiness Night",
    scheduledAt: Date.now() + 60_000,
    settings: {
      ...DEFAULT_GAME_NIGHT_SETTINGS,
      teamCreationMode: "automatic",
      targetTeamCount: 2,
      minTeamPlayers: 1,
      maxTeamPlayers: 1,
      dummyPlayerMode: "none",
      boardCount: 1,
      roundCount: 1,
      legsPerMatch: 1,
      startingScore: 301,
      finishRule: "straight",
    },
    now: Date.now() + 30,
  });
  await setGameNightVenueForUser(gameNightId, venueId, ownerUserId);
  await assignGameNightPhysicalBoardsForUser(gameNightId, [physicalBoard.id], ownerUserId);

  const initial = await getGameNightReadinessForUser({ gameNightId, userId: ownerUserId });
  assert.equal(initial.ready, false);
  assert.equal(initial.checks?.find((check) => check.id === "attendance")?.status, "block");
  assert.equal(initial.checks?.find((check) => check.id === "teams")?.status, "block");
  assert.equal(initial.checks?.find((check) => check.id === "fixtures")?.status, "block");

  for (let index = 0; index < leaguePlayerIds.length; index += 1) {
    await updateGameNightAttendanceForUser({
      gameNightId,
      leaguePlayerId: leaguePlayerIds[index],
      userId: ownerUserId,
      checkedIn: true,
      duesStatus: index === 0 ? "unpaid" : "paid",
      now: Date.now() + 40 + index,
    });
  }
  await prepareGameNightTeamsForUser(gameNightId, ownerUserId);
  await populateGameNightBoardsForUser(gameNightId, ownerUserId);

  const registered = await registerBoardDeviceForUser({
    id: `readiness-device-${suffix}`,
    leagueId,
    venueId,
    userId: ownerUserId,
    name: "Readiness Scorer",
    physicalBoardId: physicalBoard.id,
    now: Date.now() + 50,
  });

  const beforeScorerConnect = await getGameNightReadinessForUser({
    gameNightId,
    userId: ownerUserId,
  });
  assert.equal(beforeScorerConnect.ready, false);
  assert.equal(
    beforeScorerConnect.checks?.find((check) => check.id === "scorers")?.status,
    "block",
    "A registered but never-connected scorer must not make the admin preflight green.",
  );

  await authenticateBoardDeviceCredential(registered.deviceKey);
  const ready = await getGameNightReadinessForUser({
    gameNightId,
    userId: ownerUserId,
    now: Date.now(),
  });
  assert.equal(ready.ready, true, "A fully prepared night with a live scorer should be ready.");
  assert.equal(ready.requiredPassed, ready.requiredTotal);
  assert.equal(ready.blockingCount, 0);
  assert.equal(
    ready.checks?.find((check) => check.id === "dues")?.status,
    "warn",
    "Unpaid dues should remain visible without blocking Start.",
  );

  await updatePhysicalBoardForUser({
    boardId: physicalBoard.id,
    userId: ownerUserId,
    status: "out_of_service",
    now: Date.now() + 60,
  });
  const boardFailure = await getGameNightReadinessForUser({
    gameNightId,
    userId: ownerUserId,
    now: Date.now(),
  });
  assert.equal(boardFailure.ready, false);
  assert.equal(boardFailure.checks?.find((check) => check.id === "boards")?.status, "block");

  await updatePhysicalBoardForUser({
    boardId: physicalBoard.id,
    userId: ownerUserId,
    status: "active",
    now: Date.now() + 70,
  });
  await authenticateBoardDeviceCredential(registered.deviceKey);
  const recovered = await getGameNightReadinessForUser({
    gameNightId,
    userId: ownerUserId,
    now: Date.now(),
  });
  assert.equal(recovered.ready, true, "Restoring the board should restore readiness without rebuilding fixtures.");

  const stale = await getGameNightReadinessForUser({
    gameNightId,
    userId: ownerUserId,
    now: Date.now() + 60_000,
  });
  assert.equal(stale.ready, false);
  assert.equal(
    stale.checks?.find((check) => check.id === "scorers")?.status,
    "block",
    "A scorer that stops checking in must turn the operator preflight red.",
  );

  console.log("Game Night readiness contract passed.");
}

void run();
