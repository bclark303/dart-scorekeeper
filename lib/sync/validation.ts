import type { X01MatchArchive } from "@/lib/persistence/contracts";

const MAX_MATCHES_PER_REQUEST = 25;
const MAX_SIDES = 2;
const MAX_PARTICIPANTS_PER_SIDE = 5;
const MAX_LEGS = 31;
const MAX_TURNS_PER_LEG = 200;
const MAX_STRING_LENGTH = 200;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function requireString(value: unknown, field: string) {
  if (
    typeof value !== "string" ||
    value.length === 0 ||
    value.length > MAX_STRING_LENGTH
  ) {
    throw new Error(`${field} is invalid.`);
  }
  return value;
}

function requireNullableString(value: unknown, field: string) {
  if (value === null) return null;
  return requireString(value, field);
}

function requireNumber(value: unknown, field: string) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new Error(`${field} is invalid.`);
  }
  return value;
}

function requireNullableNumber(value: unknown, field: string) {
  if (value === null) return null;
  return requireNumber(value, field);
}

function requireInteger(value: unknown, field: string, min: number, max: number) {
  const number = requireNumber(value, field);
  if (!Number.isInteger(number) || number < min || number > max) {
    throw new Error(`${field} is out of range.`);
  }
  return number;
}

function requireBoolean(value: unknown, field: string) {
  if (typeof value !== "boolean") {
    throw new Error(`${field} is invalid.`);
  }
  return value;
}

function requireEnum<T extends string | number>(
  value: unknown,
  field: string,
  allowed: readonly T[],
): T {
  if (!allowed.includes(value as T)) {
    throw new Error(`${field} is invalid.`);
  }
  return value as T;
}

function parseArchive(raw: unknown): X01MatchArchive {
  if (!isRecord(raw)) throw new Error("Match archive is invalid.");

  const settings = raw.settings;
  if (!isRecord(settings)) throw new Error("Match settings are invalid.");

  const sides = raw.sides;
  if (!Array.isArray(sides) || sides.length < 2 || sides.length > MAX_SIDES) {
    throw new Error("Match sides are invalid.");
  }

  const parsedSides = sides.map((rawSide) => {
    if (!isRecord(rawSide)) throw new Error("Match side is invalid.");
    if (!Array.isArray(rawSide.participants)) {
      throw new Error("Match participants are invalid.");
    }
    if (
      rawSide.participants.length < 1 ||
      rawSide.participants.length > MAX_PARTICIPANTS_PER_SIDE
    ) {
      throw new Error("Match participant count is invalid.");
    }

    return {
      id: requireString(rawSide.id, "side.id"),
      sideIndex: requireInteger(rawSide.sideIndex, "side.sideIndex", 0, 1),
      name: requireString(rawSide.name, "side.name"),
      participants: rawSide.participants.map((rawParticipant) => {
        if (!isRecord(rawParticipant)) {
          throw new Error("Match participant is invalid.");
        }
        return {
          id: requireString(rawParticipant.id, "participant.id"),
          playerId: requireNullableString(
            rawParticipant.playerId,
            "participant.playerId",
          ),
          slotIndex: requireInteger(
            rawParticipant.slotIndex,
            "participant.slotIndex",
            0,
            MAX_PARTICIPANTS_PER_SIDE - 1,
          ),
          displayName: requireString(
            rawParticipant.displayName,
            "participant.displayName",
          ),
          isDummy: requireBoolean(rawParticipant.isDummy, "participant.isDummy"),
        };
      }),
    };
  });

  const legs = raw.legs;
  if (!Array.isArray(legs) || legs.length < 1 || legs.length > MAX_LEGS) {
    throw new Error("Match legs are invalid.");
  }

  const parsedLegs = legs.map((rawLeg) => {
    if (!isRecord(rawLeg)) throw new Error("Match leg is invalid.");
    if (!Array.isArray(rawLeg.turns) || rawLeg.turns.length > MAX_TURNS_PER_LEG) {
      throw new Error("Match turns are invalid.");
    }

    return {
      id: requireString(rawLeg.id, "leg.id"),
      legNumber: requireInteger(rawLeg.legNumber, "leg.legNumber", 1, MAX_LEGS),
      startingSideId: requireString(rawLeg.startingSideId, "leg.startingSideId"),
      winnerSideId: requireString(rawLeg.winnerSideId, "leg.winnerSideId"),
      startedAt: requireNullableNumber(rawLeg.startedAt, "leg.startedAt"),
      completedAt: requireNullableNumber(rawLeg.completedAt, "leg.completedAt"),
      turns: rawLeg.turns.map((rawTurn) => {
        if (!isRecord(rawTurn)) throw new Error("Match turn is invalid.");
        if (!Array.isArray(rawTurn.darts) || rawTurn.darts.length > 3) {
          throw new Error("Turn darts are invalid.");
        }

        return {
          id: requireString(rawTurn.id, "turn.id"),
          sideId: requireString(rawTurn.sideId, "turn.sideId"),
          participantId: requireNullableString(
            rawTurn.participantId,
            "turn.participantId",
          ),
          turnNumber: requireInteger(
            rawTurn.turnNumber,
            "turn.turnNumber",
            1,
            MAX_TURNS_PER_LEG,
          ),
          scoreEntered: requireInteger(rawTurn.scoreEntered, "turn.scoreEntered", 0, 180),
          scoreBefore: requireInteger(rawTurn.scoreBefore, "turn.scoreBefore", 0, 1001),
          scoreAfter: requireInteger(rawTurn.scoreAfter, "turn.scoreAfter", 0, 1001),
          dartsThrown: requireInteger(rawTurn.dartsThrown, "turn.dartsThrown", 1, 3),
          isBust: requireBoolean(rawTurn.isBust, "turn.isBust"),
          isCheckout: requireBoolean(rawTurn.isCheckout, "turn.isCheckout"),
          finishRule: requireEnum(rawTurn.finishRule, "turn.finishRule", [
            "straight_out",
            "double_out",
          ] as const),
          recordedAt: requireNullableNumber(rawTurn.recordedAt, "turn.recordedAt"),
          darts: rawTurn.darts.map((rawDart) => {
            if (!isRecord(rawDart)) throw new Error("Dart is invalid.");
            return {
              id: requireString(rawDart.id, "dart.id"),
              dartIndex: requireInteger(rawDart.dartIndex, "dart.dartIndex", 0, 2),
              segment: requireString(rawDart.segment, "dart.segment"),
              multiplier: requireInteger(rawDart.multiplier, "dart.multiplier", 0, 3),
              score: requireInteger(rawDart.score, "dart.score", 0, 60),
            };
          }),
        };
      }),
    };
  });

  return {
    id: requireString(raw.id, "match.id"),
    status: requireEnum(raw.status, "match.status", ["complete"] as const),
    winnerSideId: requireNullableString(raw.winnerSideId, "match.winnerSideId"),
    createdAt: requireNumber(raw.createdAt, "match.createdAt"),
    startedAt: requireNullableNumber(raw.startedAt, "match.startedAt"),
    updatedAt: requireNumber(raw.updatedAt, "match.updatedAt"),
    completedAt: requireNullableNumber(raw.completedAt, "match.completedAt"),
    settings: {
      startingScore: requireEnum(settings.startingScore, "settings.startingScore", [
        301,
        501,
        701,
      ] as const),
      finishRule: requireEnum(settings.finishRule, "settings.finishRule", [
        "straight_out",
        "double_out",
      ] as const),
      bestOfLegs: requireInteger(
        settings.bestOfLegs,
        "settings.bestOfLegs",
        1,
        MAX_LEGS,
      ) as X01MatchArchive["settings"]["bestOfLegs"],
      scoreEntryMode: requireEnum(settings.scoreEntryMode, "settings.scoreEntryMode", [
        "turn",
        "dart",
      ] as const),
      rotationMode: requireEnum(settings.rotationMode, "settings.rotationMode", [
        "independent",
        "dummy",
      ] as const),
      dummyScore: requireInteger(settings.dummyScore, "settings.dummyScore", 0, 180),
    },
    sides: parsedSides,
    legs: parsedLegs,
  };
}

export function parseMatchSyncUpload(input: unknown): X01MatchArchive[] {
  if (!isRecord(input) || !Array.isArray(input.matches)) {
    throw new Error("Sync request must contain a matches array.");
  }
  if (input.matches.length > MAX_MATCHES_PER_REQUEST) {
    throw new Error(`A sync request may contain at most ${MAX_MATCHES_PER_REQUEST} matches.`);
  }
  return input.matches.map(parseArchive);
}
