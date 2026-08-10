import { and, desc, eq, inArray } from "drizzle-orm";
import type {
  X01MatchArchive,
  X01MatchSummary,
} from "@/lib/persistence/contracts";
import { getDatabase } from "../client";
import {
  matchParticipants,
  matches,
  matchSides,
  x01Darts,
  x01Legs,
  x01MatchSettings,
  x01Turns,
} from "../schema";

export class MatchOwnershipError extends Error {
  constructor(matchId: string) {
    super(`Match ${matchId} belongs to another account.`);
    this.name = "MatchOwnershipError";
  }
}

async function saveX01MatchArchiveInternal(
  archive: X01MatchArchive,
  ownerUserId?: string,
) {
  const db = getDatabase();

  await db.transaction(async (tx) => {
    const existing = await tx
      .select({ createdByUserId: matches.createdByUserId })
      .from(matches)
      .where(eq(matches.id, archive.id))
      .limit(1);

    const existingOwner = existing[0]?.createdByUserId ?? null;

    if (ownerUserId && existingOwner && existingOwner !== ownerUserId) {
      throw new MatchOwnershipError(archive.id);
    }

    // Existing owned rows keep their owner. Legacy/unowned rows may be claimed
    // by the first authenticated sync of that durable match ID.
    const resolvedOwner = ownerUserId ?? existingOwner;

    await tx
      .insert(matches)
      .values({
        id: archive.id,
        gameType: "x01",
        status: archive.status,
        winnerSideId: archive.winnerSideId,
        createdByUserId: resolvedOwner,
        createdAt: archive.createdAt,
        startedAt: archive.startedAt,
        updatedAt: archive.updatedAt,
        completedAt: archive.completedAt,
      })
      .onConflictDoUpdate({
        target: matches.id,
        set: {
          gameType: "x01",
          status: archive.status,
          winnerSideId: archive.winnerSideId,
          createdByUserId: resolvedOwner,
          startedAt: archive.startedAt,
          updatedAt: archive.updatedAt,
          completedAt: archive.completedAt,
        },
      });

    await tx
      .insert(x01MatchSettings)
      .values({
        matchId: archive.id,
        startingScore: archive.settings.startingScore,
        finishRule: archive.settings.finishRule,
        bestOfLegs: archive.settings.bestOfLegs,
        scoreEntryMode: archive.settings.scoreEntryMode,
        rotationMode: archive.settings.rotationMode,
        dummyScore: archive.settings.dummyScore,
      })
      .onConflictDoUpdate({
        target: x01MatchSettings.matchId,
        set: {
          startingScore: archive.settings.startingScore,
          finishRule: archive.settings.finishRule,
          bestOfLegs: archive.settings.bestOfLegs,
          scoreEntryMode: archive.settings.scoreEntryMode,
          rotationMode: archive.settings.rotationMode,
          dummyScore: archive.settings.dummyScore,
        },
      });

    // Delete children from the deepest game layer upward. Foreign-key cascades
    // remove turns/darts and participants before the replacement snapshot is
    // inserted with the same durable IDs.
    await tx.delete(x01Legs).where(eq(x01Legs.matchId, archive.id));
    await tx.delete(matchSides).where(eq(matchSides.matchId, archive.id));

    if (archive.sides.length > 0) {
      await tx.insert(matchSides).values(
        archive.sides.map((side) => ({
          id: side.id,
          matchId: archive.id,
          sideIndex: side.sideIndex,
          name: side.name,
        })),
      );
    }

    const participants = archive.sides.flatMap((side) =>
      side.participants.map((participant) => ({
        id: participant.id,
        sideId: side.id,
        playerId: participant.playerId,
        slotIndex: participant.slotIndex,
        displayName: participant.displayName,
        isDummy: participant.isDummy,
      })),
    );

    if (participants.length > 0) {
      await tx.insert(matchParticipants).values(participants);
    }

    for (const leg of archive.legs) {
      await tx.insert(x01Legs).values({
        id: leg.id,
        matchId: archive.id,
        legNumber: leg.legNumber,
        startingSideId: leg.startingSideId,
        winnerSideId: leg.winnerSideId,
        startedAt: leg.startedAt,
        completedAt: leg.completedAt,
      });

      if (leg.turns.length > 0) {
        await tx.insert(x01Turns).values(
          leg.turns.map((turn) => ({
            id: turn.id,
            legId: leg.id,
            sideId: turn.sideId,
            participantId: turn.participantId,
            turnNumber: turn.turnNumber,
            scoreEntered: turn.scoreEntered,
            scoreBefore: turn.scoreBefore,
            scoreAfter: turn.scoreAfter,
            dartsThrown: turn.dartsThrown,
            isBust: turn.isBust,
            isCheckout: turn.isCheckout,
            finishRule: turn.finishRule,
            recordedAt: turn.recordedAt,
          })),
        );
      }

      const darts = leg.turns.flatMap((turn) =>
        turn.darts.map((dart) => ({
          id: dart.id,
          turnId: turn.id,
          dartIndex: dart.dartIndex,
          segment: dart.segment,
          multiplier: dart.multiplier,
          score: dart.score,
        })),
      );

      if (darts.length > 0) {
        await tx.insert(x01Darts).values(darts);
      }
    }
  });

  return archive.id;
}

/** Save an archive without assigning a synchronization owner (tests/admin use). */
export async function saveX01MatchArchive(archive: X01MatchArchive) {
  return saveX01MatchArchiveInternal(archive);
}

/** Save/retry an archive as one authenticated user's synchronized match. */
export async function saveX01MatchArchiveForUser(
  userId: string,
  archive: X01MatchArchive,
) {
  return saveX01MatchArchiveInternal(archive, userId);
}

/** Lightweight history query; detailed match loading can be added separately. */
export async function listRecentX01MatchSummaries(
  limit = 25,
): Promise<X01MatchSummary[]> {
  return getDatabase()
    .select({
      id: matches.id,
      status: matches.status,
      winnerSideId: matches.winnerSideId,
      startingScore: x01MatchSettings.startingScore,
      finishRule: x01MatchSettings.finishRule,
      bestOfLegs: x01MatchSettings.bestOfLegs,
      createdAt: matches.createdAt,
      completedAt: matches.completedAt,
    })
    .from(matches)
    .innerJoin(x01MatchSettings, eq(x01MatchSettings.matchId, matches.id))
    .where(eq(matches.gameType, "x01"))
    .orderBy(desc(matches.completedAt), desc(matches.updatedAt))
    .limit(Math.max(1, Math.min(limit, 100)));
}

/**
 * Rehydrate complete X01 archives owned by one authenticated user.
 *
 * The query is intentionally batched by table instead of issuing N queries per
 * match so cross-device history remains efficient on a remote libSQL database.
 */
export async function listX01MatchArchivesForUser(
  userId: string,
  limit = 100,
): Promise<X01MatchArchive[]> {
  const db = getDatabase();
  const matchRows = await db
    .select({
      id: matches.id,
      status: matches.status,
      winnerSideId: matches.winnerSideId,
      createdAt: matches.createdAt,
      startedAt: matches.startedAt,
      updatedAt: matches.updatedAt,
      completedAt: matches.completedAt,
      startingScore: x01MatchSettings.startingScore,
      finishRule: x01MatchSettings.finishRule,
      bestOfLegs: x01MatchSettings.bestOfLegs,
      scoreEntryMode: x01MatchSettings.scoreEntryMode,
      rotationMode: x01MatchSettings.rotationMode,
      dummyScore: x01MatchSettings.dummyScore,
    })
    .from(matches)
    .innerJoin(x01MatchSettings, eq(x01MatchSettings.matchId, matches.id))
    .where(
      and(
        eq(matches.gameType, "x01"),
        eq(matches.status, "complete"),
        eq(matches.createdByUserId, userId),
      ),
    )
    .orderBy(desc(matches.completedAt), desc(matches.updatedAt))
    .limit(Math.max(1, Math.min(limit, 100)));

  const matchIds = matchRows.map((row) => row.id);
  if (matchIds.length === 0) return [];

  const sideRows = await db
    .select()
    .from(matchSides)
    .where(inArray(matchSides.matchId, matchIds));
  const sideIds = sideRows.map((row) => row.id);

  const participantRows =
    sideIds.length === 0
      ? []
      : await db
          .select()
          .from(matchParticipants)
          .where(inArray(matchParticipants.sideId, sideIds));

  const legRows = await db
    .select()
    .from(x01Legs)
    .where(inArray(x01Legs.matchId, matchIds));
  const legIds = legRows.map((row) => row.id);

  const turnRows =
    legIds.length === 0
      ? []
      : await db.select().from(x01Turns).where(inArray(x01Turns.legId, legIds));
  const turnIds = turnRows.map((row) => row.id);

  const dartRows =
    turnIds.length === 0
      ? []
      : await db.select().from(x01Darts).where(inArray(x01Darts.turnId, turnIds));

  return matchRows.map((match) => {
    const sidesForMatch = sideRows
      .filter((side) => side.matchId === match.id)
      .sort((left, right) => left.sideIndex - right.sideIndex)
      .map((side) => ({
        id: side.id,
        sideIndex: side.sideIndex,
        name: side.name,
        participants: participantRows
          .filter((participant) => participant.sideId === side.id)
          .sort((left, right) => left.slotIndex - right.slotIndex)
          .map((participant) => ({
            id: participant.id,
            playerId: participant.playerId,
            slotIndex: participant.slotIndex,
            displayName: participant.displayName,
            isDummy: participant.isDummy,
          })),
      }));

    const legsForMatch = legRows
      .filter((leg) => leg.matchId === match.id)
      .sort((left, right) => left.legNumber - right.legNumber)
      .map((leg) => ({
        id: leg.id,
        legNumber: leg.legNumber,
        startingSideId: leg.startingSideId,
        winnerSideId: leg.winnerSideId ?? "",
        startedAt: leg.startedAt,
        completedAt: leg.completedAt,
        turns: turnRows
          .filter((turn) => turn.legId === leg.id)
          .sort((left, right) => left.turnNumber - right.turnNumber)
          .map((turn) => ({
            id: turn.id,
            sideId: turn.sideId,
            participantId: turn.participantId,
            turnNumber: turn.turnNumber,
            scoreEntered: turn.scoreEntered,
            scoreBefore: turn.scoreBefore,
            scoreAfter: turn.scoreAfter,
            dartsThrown: turn.dartsThrown,
            isBust: turn.isBust,
            isCheckout: turn.isCheckout,
            finishRule:
              turn.finishRule as X01MatchArchive["settings"]["finishRule"],
            recordedAt: turn.recordedAt,
            darts: dartRows
              .filter((dart) => dart.turnId === turn.id)
              .sort((left, right) => left.dartIndex - right.dartIndex)
              .map((dart) => ({
                id: dart.id,
                dartIndex: dart.dartIndex,
                segment: dart.segment,
                multiplier: dart.multiplier,
                score: dart.score,
              })),
          })),
      }));

    return {
      id: match.id,
      status: match.status as X01MatchArchive["status"],
      winnerSideId: match.winnerSideId,
      createdAt: match.createdAt,
      startedAt: match.startedAt,
      updatedAt: match.updatedAt,
      completedAt: match.completedAt,
      settings: {
        startingScore:
          match.startingScore as X01MatchArchive["settings"]["startingScore"],
        finishRule:
          match.finishRule as X01MatchArchive["settings"]["finishRule"],
        bestOfLegs:
          match.bestOfLegs as X01MatchArchive["settings"]["bestOfLegs"],
        scoreEntryMode:
          match.scoreEntryMode as X01MatchArchive["settings"]["scoreEntryMode"],
        rotationMode:
          match.rotationMode as X01MatchArchive["settings"]["rotationMode"],
        dummyScore: match.dummyScore,
      },
      sides: sidesForMatch,
      legs: legsForMatch,
    } satisfies X01MatchArchive;
  });
}
