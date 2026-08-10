import { asc, eq, isNull } from "drizzle-orm";
import type { PersistedPlayer } from "@/lib/persistence/contracts";
import { getDatabase } from "../client";
import { players } from "../schema";

export type SavePlayerInput = {
  id: string;
  displayName: string;
  createdAt?: number;
  updatedAt?: number;
  archivedAt?: number | null;
};

export async function savePlayer(
  input: SavePlayerInput,
): Promise<PersistedPlayer> {
  const updatedAt = input.updatedAt ?? Date.now();
  const createdAt = input.createdAt ?? updatedAt;
  const archivedAt = input.archivedAt ?? null;

  await getDatabase()
    .insert(players)
    .values({
      id: input.id,
      displayName: input.displayName.trim(),
      createdAt,
      updatedAt,
      archivedAt,
    })
    .onConflictDoUpdate({
      target: players.id,
      set: {
        displayName: input.displayName.trim(),
        updatedAt,
        archivedAt,
      },
    });

  const saved = await getPlayerById(input.id);

  if (!saved) {
    throw new Error(`Player ${input.id} was not saved.`);
  }

  return saved;
}

export async function getPlayerById(
  playerId: string,
): Promise<PersistedPlayer | null> {
  const [player] = await getDatabase()
    .select()
    .from(players)
    .where(eq(players.id, playerId))
    .limit(1);

  return player ?? null;
}

export async function listPlayers(
  includeArchived = false,
): Promise<PersistedPlayer[]> {
  if (includeArchived) {
    return getDatabase().select().from(players).orderBy(asc(players.displayName));
  }

  return getDatabase()
    .select()
    .from(players)
    .where(isNull(players.archivedAt))
    .orderBy(asc(players.displayName));
}

export async function archivePlayer(playerId: string, archivedAt = Date.now()) {
  await getDatabase()
    .update(players)
    .set({ archivedAt, updatedAt: archivedAt })
    .where(eq(players.id, playerId));
}
