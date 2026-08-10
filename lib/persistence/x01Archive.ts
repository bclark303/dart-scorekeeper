import type { SavedMatchState } from "@/lib/types";
import type { X01MatchArchive } from "./contracts";
import { createMatchChildId } from "./ids";

/**
 * Only the match/domain fields required to build a completed X01 archive.
 *
 * SavedMatchState contains UI/navigation/preferences too, but those do not
 * belong in the persistent match contract. Keeping this source narrow prevents
 * server/database concerns from absorbing unrelated app settings.
 */
export type CompletedX01MatchSource = Pick<
  SavedMatchState,
  | "matchId"
  | "matchCreatedAt"
  | "startingScore"
  | "finishRule"
  | "bestOfLegs"
  | "scoreEntryMode"
  | "rotationMode"
  | "dummyScore"
  | "sides"
  | "completedLegs"
  | "isMatchComplete"
>;

/**
 * Convert the current browser match into the provider-neutral archive contract.
 *
 * The scorer keeps newest turns/legs first for UI convenience. Persistence is
 * normalized into chronological leg/turn order so ordering remains explicit
 * and queryable in SQL.
 */
export function buildCompletedX01MatchArchive(
  state: CompletedX01MatchSource,
  completedAt = Date.now(),
): X01MatchArchive {
  if (!state.isMatchComplete) {
    throw new Error("Only completed matches can be archived right now.");
  }

  if (!state.matchId) {
    throw new Error("Completed match is missing a durable match ID.");
  }

  const matchId = state.matchId;
  const createdAt = state.matchCreatedAt ?? completedAt;

  const sideIdByLocalId = new Map(
    state.sides.map((side) => [
      side.id,
      createMatchChildId(matchId, "side", side.id),
    ]),
  );

  const participantIdByLocalId = new Map<string, string>();

  const sides = state.sides.map((side, sideIndex) => {
    const persistedSideId = sideIdByLocalId.get(side.id);

    if (!persistedSideId) {
      throw new Error(`Could not namespace side ${side.id}.`);
    }

    return {
      id: persistedSideId,
      sideIndex,
      name: side.name,
      participants: side.members.map((member, slotIndex) => {
        const persistedParticipantId = createMatchChildId(
          matchId,
          "participant",
          member.id,
        );

        participantIdByLocalId.set(member.id, persistedParticipantId);

        return {
          id: persistedParticipantId,
          playerId: null,
          slotIndex,
          displayName: member.name,
          isDummy: member.isDummy === true,
        };
      }),
    };
  });

  const legs = [...state.completedLegs]
    .sort((left, right) => left.legNumber - right.legNumber)
    .map((leg) => {
      const chronologicalTurns = [...leg.turns].reverse();
      const firstTurn = chronologicalTurns[0];

      if (!firstTurn) {
        throw new Error(`Completed leg ${leg.legNumber} has no turns.`);
      }

      const startingSideId = sideIdByLocalId.get(firstTurn.playerId);
      const winnerSideId = sideIdByLocalId.get(leg.winnerId);

      if (!startingSideId || !winnerSideId) {
        throw new Error(`Completed leg ${leg.legNumber} references an unknown side.`);
      }

      return {
        id: createMatchChildId(matchId, "leg", leg.legNumber),
        legNumber: leg.legNumber,
        startingSideId,
        winnerSideId,
        startedAt: null,
        completedAt: null,
        turns: chronologicalTurns.map((turn, turnIndex) => {
          const persistedTurnSideId = sideIdByLocalId.get(turn.playerId);

          if (!persistedTurnSideId) {
            throw new Error(`Turn ${turn.id} references an unknown side.`);
          }

          return {
            id: createMatchChildId(matchId, "turn", turn.id),
            sideId: persistedTurnSideId,
            participantId: turn.throwerId
              ? participantIdByLocalId.get(turn.throwerId) ?? null
              : null,
            turnNumber: turnIndex + 1,
            scoreEntered: turn.scoreEntered,
            scoreBefore: turn.scoreBefore,
            scoreAfter: turn.scoreAfter,
            dartsThrown: turn.dartsThrown,
            isBust: turn.isBust,
            isCheckout: turn.isCheckout,
            finishRule: turn.finishRule,
            recordedAt: null,
            darts: (turn.darts ?? []).map((dart, dartIndex) => ({
              id: createMatchChildId(matchId, "dart", dart.id),
              dartIndex,
              segment: String(dart.segment),
              multiplier: dart.multiplier,
              score: dart.score,
            })),
          };
        }),
      };
    });

  const legsNeededToWin = Math.ceil(state.bestOfLegs / 2);
  const winner = state.sides.find((side) => side.legsWon >= legsNeededToWin);
  const winnerSideId = winner ? sideIdByLocalId.get(winner.id) ?? null : null;

  return {
    id: matchId,
    status: "complete",
    winnerSideId,
    createdAt,
    startedAt: createdAt,
    updatedAt: completedAt,
    completedAt,
    settings: {
      startingScore: state.startingScore,
      finishRule: state.finishRule,
      bestOfLegs: state.bestOfLegs,
      scoreEntryMode: state.scoreEntryMode,
      rotationMode: state.rotationMode,
      dummyScore: state.dummyScore,
    },
    sides,
    legs,
  };
}
