import assert from "node:assert/strict";
import {
  deletePausedCasualGame,
  listPausedCasualGames,
  MAX_PAUSED_CASUAL_GAMES,
  PAUSED_CASUAL_GAMES_STORAGE_KEY,
  savePausedCasualGame,
  type PausedCasualGame,
} from "@/lib/persistence/casualSavedGames";

class MemoryStorage {
  private values = new Map<string, string>();

  getItem(key: string) {
    return this.values.get(key) ?? null;
  }

  setItem(key: string, value: string) {
    this.values.set(key, value);
  }
}

function game(index: number): PausedCasualGame {
  return {
    schemaVersion: 1,
    id: `game-${index}`,
    name: `Saved Game ${index}`,
    gameType: "x01",
    gameLabel: "501 X01 · Double Out · Best of 3",
    participantNames: ["Alice", "Bob"],
    pausedAt: 1_000 + index,
    state: { currentScore: 501 - index },
  };
}

const storage = new MemoryStorage();
assert.deepEqual(listPausedCasualGames(storage), []);

for (let index = 1; index <= MAX_PAUSED_CASUAL_GAMES; index += 1) {
  savePausedCasualGame(game(index), storage);
}

const saved = listPausedCasualGames(storage);
assert.equal(saved.length, MAX_PAUSED_CASUAL_GAMES);
assert.equal(saved[0]?.id, "game-5");
assert.equal(saved.at(-1)?.id, "game-1");

assert.throws(
  () => savePausedCasualGame(game(6), storage),
  /Delete one before saving another/,
);

const updated = savePausedCasualGame(
  { ...game(3), name: "Renamed Game", pausedAt: 2_000 },
  storage,
);
assert.equal(updated.length, MAX_PAUSED_CASUAL_GAMES);
assert.equal(updated[0]?.name, "Renamed Game");

const afterDelete = deletePausedCasualGame("game-2", storage);
assert.equal(afterDelete.length, MAX_PAUSED_CASUAL_GAMES - 1);
assert.equal(afterDelete.some((item) => item.id === "game-2"), false);

storage.setItem(PAUSED_CASUAL_GAMES_STORAGE_KEY, "not-json");
assert.deepEqual(listPausedCasualGames(storage), []);

console.log("Casual paused-game storage contract passed.");
