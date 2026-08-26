import type { BoardDeviceSummary, PhysicalBoardSummary } from "@/lib/league/boardDeviceContracts";
import {
  GAME_NIGHT_SCORER_ONLINE_WINDOW_MS,
  type GameNightReadinessCheck,
  type GameNightReadinessResponse,
} from "@/lib/league/gameNightReadiness";
import { resolveGameNightSettings } from "@/lib/league/gameNightContracts";

import { getVenueHardwareForUser } from "./boardDevices";
import { listGameNightBoardUsagesForUser } from "./gameNightBoardOperations";
import { getGameNightForUser } from "./gameNightReadModel";

function boardName(board: PhysicalBoardSummary | undefined, fallback: string) {
  return board?.name ?? fallback;
}

/**
 * Build the operator-facing preflight for one Game Night.
 *
 * This intentionally lives in the repository layer rather than only in React:
 * every admin surface gets the same definition of "ready", and the contract is
 * testable without a browser. The server's existing structural start guards are
 * still authoritative; this layer adds the human/operator checks (especially
 * scorer connectivity) that make a walk-up workflow predictable.
 */
export async function getGameNightReadinessForUser(input: {
  gameNightId: string;
  userId: string;
  now?: number;
}): Promise<GameNightReadinessResponse> {
  const now = input.now ?? Date.now();
  const night = await getGameNightForUser(input.gameNightId, input.userId);
  const settings = resolveGameNightSettings(night.settings);
  const checkedIn = night.attendance.filter((item) => item.status === "checked_in");
  const duesPending = checkedIn.filter((item) => item.duesStatus === "unpaid");
  const activeTeams = night.teams.filter((team) => team.status !== "withdrawn");
  const roundOnePairings =
    night.rounds?.find((round) => round.roundNumber === 1)?.pairings ??
    night.pairings.filter((pairing) => pairing.roundNumber === 1);

  let venueStatus: "active" | "archived" | null = null;
  let physicalBoards: PhysicalBoardSummary[] = [];
  let devices: BoardDeviceSummary[] = [];
  let usages: Awaited<ReturnType<typeof listGameNightBoardUsagesForUser>> = [];

  if (night.venueId) {
    const [hardware, boardUsages] = await Promise.all([
      getVenueHardwareForUser({
        leagueId: night.leagueId,
        venueId: night.venueId,
        userId: input.userId,
      }),
      listGameNightBoardUsagesForUser(night.id, input.userId),
    ]);
    venueStatus = hardware.venue?.status ?? null;
    physicalBoards = hardware.boards ?? [];
    devices = hardware.devices ?? [];
    usages = boardUsages;
  }

  const physicalById = new Map(physicalBoards.map((board) => [board.id, board]));
  const deviceByBoard = new Map(
    devices
      .filter((device) => device.physicalBoardId)
      .map((device) => [device.physicalBoardId!, device]),
  );
  const allocatedPhysicalIds = night.boards
    .map((board) => board.physicalBoardId)
    .filter((id): id is string => Boolean(id));
  const allocationBoards = night.boards.map((board) => ({
    nightBoard: board,
    physical: board.physicalBoardId ? physicalById.get(board.physicalBoardId) : undefined,
  }));

  const checks: GameNightReadinessCheck[] = [];

  checks.push(
    night.venueId && venueStatus === "active"
      ? {
          id: "venue",
          title: "Venue",
          status: "pass",
          blocksStart: true,
          summary: night.venueName ?? "Venue selected",
          detail: "The Game Night is attached to an active venue.",
          href: "/game-nights/boards",
          action: "Review venue",
        }
      : {
          id: "venue",
          title: "Venue",
          status: "block",
          blocksStart: true,
          summary: night.venueId ? "Venue is not active" : "No venue selected",
          detail: night.venueId
            ? "Restore the venue or move this Game Night to another active venue."
            : "Choose the physical location where this Game Night will be played.",
          href: "/game-nights/boards",
          action: "Choose venue",
        },
  );

  const minimumHumans = settings.dummyPlayerMode === "none"
    ? Math.max(2, settings.targetTeamCount * settings.minTeamPlayers)
    : 2;
  checks.push(
    checkedIn.length >= minimumHumans
      ? {
          id: "attendance",
          title: "Players",
          status: "pass",
          blocksStart: true,
          summary: `${checkedIn.length} checked in`,
          detail:
            settings.dummyPlayerMode === "none"
              ? `At least ${minimumHumans} checked-in players are required by tonight's team settings.`
              : "Enough players are present to build at least two teams; configured dummy rules can fill permitted gaps.",
          href: "/game-nights/check-in",
          action: "Review check-in",
        }
      : {
          id: "attendance",
          title: "Players",
          status: "block",
          blocksStart: true,
          summary: `${checkedIn.length}/${minimumHumans} required players checked in`,
          detail: "Check in the players who are present before preparing the final teams.",
          href: "/game-nights/check-in",
          action: "Check in players",
        },
  );

  const invalidTeams = activeTeams.filter(
    (team) =>
      team.members.length < settings.minTeamPlayers ||
      team.members.length > settings.maxTeamPlayers,
  );
  const teamsReady = activeTeams.length === settings.targetTeamCount && invalidTeams.length === 0;
  checks.push(
    teamsReady
      ? {
          id: "teams",
          title: "Teams",
          status: "pass",
          blocksStart: true,
          summary: `${activeTeams.length} valid teams`,
          detail: "Every active team is within tonight's configured team-size limits.",
          href: "/game-nights/teams",
          action: "Review teams",
        }
      : {
          id: "teams",
          title: "Teams",
          status: "block",
          blocksStart: true,
          summary: `${activeTeams.length}/${settings.targetTeamCount} teams ready`,
          detail: invalidTeams.length
            ? `${invalidTeams.length} team${invalidTeams.length === 1 ? " is" : "s are"} outside the configured size limits.`
            : "Prepare or regenerate the configured teams for tonight.",
          href: "/game-nights/teams",
          action: "Fix teams",
        },
  );

  const badBoardAllocations = allocationBoards.filter(
    ({ physical }) => !physical || physical.status !== "active",
  );
  const boardsReady =
    night.boards.length === settings.boardCount &&
    new Set(allocatedPhysicalIds).size === settings.boardCount &&
    badBoardAllocations.length === 0;
  checks.push(
    boardsReady
      ? {
          id: "boards",
          title: "Physical boards",
          status: "pass",
          blocksStart: true,
          summary: `${night.boards.length}/${settings.boardCount} boards ready`,
          detail: night.boards.map((board) => board.name).join(" · "),
          href: "/game-nights/boards",
          action: "Review boards",
        }
      : {
          id: "boards",
          title: "Physical boards",
          status: "block",
          blocksStart: true,
          summary: `${Math.min(night.boards.length, settings.boardCount)}/${settings.boardCount} boards ready`,
          detail: badBoardAllocations.length
            ? `${badBoardAllocations.map(({ nightBoard, physical }) => boardName(physical, nightBoard.name)).join(", ")} ${badBoardAllocations.length === 1 ? "is" : "are"} missing or out of service.`
            : `Select exactly ${settings.boardCount} active physical ${settings.boardCount === 1 ? "board" : "boards"}.`,
          href: "/game-nights/boards",
          action: "Fix board allocation",
        },
  );

  const scorerProblems = allocationBoards.flatMap(({ nightBoard, physical }) => {
    if (!physical || physical.status !== "active") return [];
    const device = deviceByBoard.get(physical.id);
    if (!device) return [`${physical.name}: no scorer`];
    if (device.status !== "active") return [`${physical.name}: scorer disabled`];
    if (!device.lastSeenAt) return [`${physical.name}: scorer never connected`];
    if (now - device.lastSeenAt > GAME_NIGHT_SCORER_ONLINE_WINDOW_MS) {
      return [`${physical.name}: scorer offline`];
    }
    return [];
  });
  const scorersReady = boardsReady && scorerProblems.length === 0;
  checks.push(
    scorersReady
      ? {
          id: "scorers",
          title: "Scorers",
          status: "pass",
          blocksStart: true,
          summary: `${settings.boardCount}/${settings.boardCount} scorers online`,
          detail: "Every board has an enabled scoring device that checked in recently.",
          href: "/game-nights/boards",
          action: "Review scorers",
        }
      : {
          id: "scorers",
          title: "Scorers",
          status: "block",
          blocksStart: true,
          summary: scorerProblems.length
            ? `${scorerProblems.length} scorer ${scorerProblems.length === 1 ? "issue" : "issues"}`
            : "Scorer health cannot be confirmed yet",
          detail: scorerProblems.length
            ? scorerProblems.join(" · ")
            : "Finish the physical board allocation before scorer health can be verified.",
          href: "/game-nights/boards",
          action: "Fix scorers",
        },
  );

  const fixturesReady =
    roundOnePairings.length > 0 &&
    roundOnePairings.every((pairing) => Boolean(pairing.matchSessionId));
  checks.push(
    fixturesReady
      ? {
          id: "fixtures",
          title: "Round 1",
          status: "pass",
          blocksStart: true,
          summary: `${roundOnePairings.length} match${roundOnePairings.length === 1 ? "" : "es"} prepared`,
          detail: "Round 1 has board assignments and persistent match sessions ready to release.",
          href: "/game-nights/fixtures",
          action: "Review fixtures",
        }
      : {
          id: "fixtures",
          title: "Round 1",
          status: "block",
          blocksStart: true,
          summary: "Fixtures are not ready",
          detail: "Generate and review Round 1 after players, teams, and boards are prepared.",
          href: "/game-nights/fixtures",
          action: "Prepare fixtures",
        },
  );

  const selectedIdSet = new Set(allocatedPhysicalIds);
  const relevantUsages = usages.filter((usage) => selectedIdSet.has(usage.physicalBoardId));
  const activeConflicts = relevantUsages.filter((usage) => usage.gameNightStatus === "active");
  const plannedSharing = relevantUsages.filter((usage) => usage.gameNightStatus !== "active");
  checks.push(
    activeConflicts.length
      ? {
          id: "conflicts",
          title: "Board conflicts",
          status: "block",
          blocksStart: true,
          summary: `${activeConflicts.length} active board conflict${activeConflicts.length === 1 ? "" : "s"}`,
          detail: activeConflicts.map((usage) => usage.gameNightName).join(" · "),
          href: "/game-nights/boards",
          action: "Choose different boards",
        }
      : plannedSharing.length
        ? {
            id: "conflicts",
            title: "Board conflicts",
            status: "warn",
            blocksStart: true,
            summary: "No active conflict · future sharing noted",
            detail: `${plannedSharing.length} other unfinished Game Night allocation${plannedSharing.length === 1 ? " uses" : "s use"} one of these boards. Simultaneous active use will still be blocked.`,
            href: "/game-nights/boards",
            action: "Review sharing",
          }
        : {
            id: "conflicts",
            title: "Board conflicts",
            status: "pass",
            blocksStart: true,
            summary: "No active conflicts",
            detail: "No other active Game Night is using tonight's selected boards.",
            href: "/game-nights/boards",
            action: "Review allocation",
          },
  );

  checks.push(
    duesPending.length
      ? {
          id: "dues",
          title: "Dues",
          status: "warn",
          blocksStart: false,
          summary: `${duesPending.length} payment${duesPending.length === 1 ? "" : "s"} pending`,
          detail: "Dues do not block play, but the outstanding check-ins still need administrative attention.",
          href: "/game-nights/check-in",
          action: "Review dues",
        }
      : {
          id: "dues",
          title: "Dues",
          status: "pass",
          blocksStart: false,
          summary: "No dues flags",
          detail: "Every checked-in player is marked paid or waived.",
          href: "/game-nights/check-in",
          action: "Review check-in",
        },
  );

  const requiredChecks = checks.filter((check) => check.blocksStart);
  const blockingCount = requiredChecks.filter((check) => check.status === "block").length;
  const warningCount = checks.filter((check) => check.status === "warn").length;

  return {
    ready: blockingCount === 0,
    requiredPassed: requiredChecks.length - blockingCount,
    requiredTotal: requiredChecks.length,
    blockingCount,
    warningCount,
    checkedAt: now,
    checks,
  };
}
