import type { LeagueMatchDartInput, LeagueMatchSummary } from "@/lib/league/matchContracts";
import { calculateConfiguredDummyTurn } from "@/lib/league/dummyScoring";

import { BoardDeviceAssignmentError } from "./boardDevices";
import { getBoardDeviceConnectionForCredential } from "./fixtureBoardDevices";
import { prepareNextRoundAfterCompletion } from "./gameNightFixtures";
import {
  getLeagueMatchForUser,
  submitLeagueMatchTurnAfterAuthorization as submitRawAfterAuthorization,
  submitLeagueMatchTurnForUser as submitRawForUser,
} from "./leagueMatches";

type LeagueTurnSubmission = {
  matchId: string;
  turnId: string;
  scoreEntered: number;
  dartsThrown: 1 | 2 | 3;
  checkoutConfirmed?: boolean;
  darts?: LeagueMatchDartInput[];
};

function normalizeDummySubmission(
  match: LeagueMatchSummary,
  input: LeagueTurnSubmission,
): LeagueTurnSubmission {
  if (!match.currentTeamId || !match.currentMemberId) return input;

  const currentTeam =
    match.currentTeamId === match.teamA.id
      ? match.teamA
      : match.currentTeamId === match.teamB.id
        ? match.teamB
        : null;
  const currentMember = currentTeam?.members.find(
    (member) => member.id === match.currentMemberId,
  );

  if (!currentTeam || !currentMember?.isDummy) return input;

  // Only the current leg is eligible. A dummy who starts a new leg must not
  // inherit a partner turn from the previous leg.
  const partnerTurn = match.turns.find(
    (turn) =>
      turn.legNumber === match.currentLegNumber &&
      turn.teamId === currentTeam.id &&
      !turn.isDummy,
  );

  const calculated = calculateConfiguredDummyTurn({
    dummyScore: match.dummyScore,
    partnerTurn: partnerTurn
      ? {
          scoreEntered: partnerTurn.scoreEntered,
          darts: partnerTurn.darts,
        }
      : null,
  });

  return {
    ...input,
    scoreEntered: calculated.scoreEntered,
    dartsThrown: calculated.dartsThrown,
    // Automatic dummy turns have no literal final dart to confirm. Treat an
    // exact automatic finish as a valid checkout while still allowing the X01
    // engine to enforce all normal bust/remainder rules.
    checkoutConfirmed: true,
    // A dummy's synthetic score is not real dartboard history.
    darts: undefined,
  };
}

async function prepareFollowingRound(updated: LeagueMatchSummary) {
  if (updated.status === "completed") {
    await prepareNextRoundAfterCompletion(updated.gameNightId);
  }
  return updated;
}

export async function submitLeagueMatchTurnForUser(input: LeagueTurnSubmission & {
  userId: string;
}): Promise<LeagueMatchSummary> {
  const match = await getLeagueMatchForUser(input.matchId, input.userId);
  const normalized = normalizeDummySubmission(match, input);

  const updated = await submitRawForUser({
    ...normalized,
    userId: input.userId,
  });
  return prepareFollowingRound(updated);
}

export async function submitBoardDeviceTurnForCredential(input: LeagueTurnSubmission & {
  deviceKey: string;
}): Promise<LeagueMatchSummary> {
  const connection = await getBoardDeviceConnectionForCredential(input.deviceKey);
  if (!connection.assignment?.matchSessionId) {
    throw new BoardDeviceAssignmentError(
      "This board does not currently have a match assignment.",
    );
  }
  if (connection.assignment.matchSessionId !== input.matchId) {
    throw new BoardDeviceAssignmentError(
      "That match is not assigned to this board device.",
    );
  }
  if (!connection.match) {
    throw new BoardDeviceAssignmentError(
      "This board's assigned match could not be loaded.",
    );
  }

  const normalized = normalizeDummySubmission(connection.match, input);
  const updated = await submitRawAfterAuthorization(normalized);
  return prepareFollowingRound(updated);
}
