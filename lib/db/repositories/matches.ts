import { desc, eq } from "drizzle-orm";
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

/**
 * Save a complete X01 archive as one transaction.
 *
 * Re-saving the same match ID replaces its child snapshot, which makes local
 * sync retries idempotent instead of producing duplicate legs/turns/darts.
 */
export async function saveX01MatchArchive(archive: X01MatchArchive) {
  const db = getDatabase();

  await db.transaction(async (tx) => {
    await tx
      .insert(matches)
      .values({
        id: archive.id,
        gameType: "x01",
        status: archive.status,
        winnerSideId: archive.winnerSideId,
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
