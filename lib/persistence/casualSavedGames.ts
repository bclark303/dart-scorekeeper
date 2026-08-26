export const PAUSED_CASUAL_GAMES_STORAGE_KEY = "dart-scorekeeper-paused-casual-games-v1";
export const MAX_PAUSED_CASUAL_GAMES = 5;

export type PausedCasualGame = {
  schemaVersion: 1;
  id: string;
  name: string;
  gameType: string;
  gameLabel: string;
  participantNames: string[];
  pausedAt: number;
  state: unknown;
};

type StorageLike = Pick<Storage, "getItem" | "setItem">;

function getStorage(storage?: StorageLike): StorageLike | null {
  if (storage) return storage;
  if (typeof window === "undefined") return null;
  return window.localStorage;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isPausedCasualGame(value: unknown): value is PausedCasualGame {
  if (!isRecord(value)) return false;
  return (
    value.schemaVersion === 1 &&
    typeof value.id === "string" &&
    value.id.length > 0 &&
    typeof value.name === "string" &&
    value.name.length > 0 &&
    typeof value.gameType === "string" &&
    value.gameType.length > 0 &&
    typeof value.gameLabel === "string" &&
    Array.isArray(value.participantNames) &&
    value.participantNames.every((name) => typeof name === "string") &&
    typeof value.pausedAt === "number" &&
    Number.isFinite(value.pausedAt) &&
    "state" in value
  );
}

export function listPausedCasualGames(storage?: StorageLike): PausedCasualGame[] {
  const target = getStorage(storage);
  if (!target) return [];

  const raw = target.getItem(PAUSED_CASUAL_GAMES_STORAGE_KEY);
  if (!raw) return [];

  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(isPausedCasualGame)
      .sort((left, right) => right.pausedAt - left.pausedAt)
      .slice(0, MAX_PAUSED_CASUAL_GAMES);
  } catch {
    return [];
  }
}

export function savePausedCasualGame(
  game: PausedCasualGame,
  storage?: StorageLike,
): PausedCasualGame[] {
  const target = getStorage(storage);
  if (!target) throw new Error("Paused-game storage is unavailable.");

  const current = listPausedCasualGames(target);
  const existing = current.find((item) => item.id === game.id);

  if (!existing && current.length >= MAX_PAUSED_CASUAL_GAMES) {
    throw new Error(
      `You can save up to ${MAX_PAUSED_CASUAL_GAMES} paused casual games. Delete one before saving another.`,
    );
  }

  const next = [game, ...current.filter((item) => item.id !== game.id)]
    .sort((left, right) => right.pausedAt - left.pausedAt)
    .slice(0, MAX_PAUSED_CASUAL_GAMES);

  target.setItem(PAUSED_CASUAL_GAMES_STORAGE_KEY, JSON.stringify(next));
  return next;
}

export function deletePausedCasualGame(
  id: string,
  storage?: StorageLike,
): PausedCasualGame[] {
  const target = getStorage(storage);
  if (!target) return [];

  const next = listPausedCasualGames(target).filter((game) => game.id !== id);
  target.setItem(PAUSED_CASUAL_GAMES_STORAGE_KEY, JSON.stringify(next));
  return next;
}
