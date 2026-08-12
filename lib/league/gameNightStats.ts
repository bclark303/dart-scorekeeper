export type GameNightStatTurnInput = {
  leaguePlayerId: string | null;
  displayName: string;
  scoreEntered: number;
  isBust: boolean;
  isCheckout: boolean;
  isDummy: boolean;
  voidedAt: number | null;
  finishRule: string;
};

export type GameNightPlayerStats = {
  leaguePlayerId: string;
  displayName: string;
  turns: number;
  pointsScored: number;
  count100Plus: number;
  count140Plus: number;
  count180s: number;
  highestTurn: number;
  doubleOuts: number;
  highestCheckout: number;
};

export type GameNightLeader = {
  value: number;
  players: Array<{
    leaguePlayerId: string;
    displayName: string;
  }>;
};

export type GameNightStatsSummary = {
  players: GameNightPlayerStats[];
  total180s: number;
  totalDoubleOuts: number;
  most180s: GameNightLeader | null;
  highestTurn: GameNightLeader | null;
};

function emptyPlayer(
  leaguePlayerId: string,
  displayName: string,
): GameNightPlayerStats {
  return {
    leaguePlayerId,
    displayName,
    turns: 0,
    pointsScored: 0,
    count100Plus: 0,
    count140Plus: 0,
    count180s: 0,
    highestTurn: 0,
    doubleOuts: 0,
    highestCheckout: 0,
  };
}

function leaderFor(
  players: GameNightPlayerStats[],
  valueFor: (player: GameNightPlayerStats) => number,
): GameNightLeader | null {
  if (!players.length) return null;
  const value = Math.max(...players.map(valueFor));
  if (value <= 0) return null;

  return {
    value,
    players: players
      .filter((player) => valueFor(player) === value)
      .map((player) => ({
        leaguePlayerId: player.leaguePlayerId,
        displayName: player.displayName,
      })),
  };
}

/**
 * Derive per-player Game Night statistics from authoritative league turns.
 *
 * Voided turns, dummy turns and busts do not contribute to scoring/high-turn
 * contests. A successful checkout in a Double Out match counts as one
 * double-out for the actual league player who threw it.
 */
export function buildGameNightStats(
  turns: GameNightStatTurnInput[],
): GameNightStatsSummary {
  const byPlayer = new Map<string, GameNightPlayerStats>();

  for (const turn of turns) {
    if (turn.voidedAt !== null || turn.isDummy || !turn.leaguePlayerId) continue;

    const player =
      byPlayer.get(turn.leaguePlayerId) ??
      emptyPlayer(turn.leaguePlayerId, turn.displayName);
    player.displayName = turn.displayName;
    player.turns += 1;

    if (!turn.isBust) {
      player.pointsScored += turn.scoreEntered;
      player.highestTurn = Math.max(player.highestTurn, turn.scoreEntered);

      if (turn.scoreEntered >= 100) player.count100Plus += 1;
      if (turn.scoreEntered >= 140) player.count140Plus += 1;
      if (turn.scoreEntered === 180) player.count180s += 1;
    }

    if (turn.isCheckout) {
      player.highestCheckout = Math.max(
        player.highestCheckout,
        turn.scoreEntered,
      );
      if (turn.finishRule === "double") player.doubleOuts += 1;
    }

    byPlayer.set(turn.leaguePlayerId, player);
  }

  const players = [...byPlayer.values()].sort(
    (a, b) =>
      b.count180s - a.count180s ||
      b.highestTurn - a.highestTurn ||
      a.displayName.localeCompare(b.displayName),
  );

  return {
    players,
    total180s: players.reduce((sum, player) => sum + player.count180s, 0),
    totalDoubleOuts: players.reduce(
      (sum, player) => sum + player.doubleOuts,
      0,
    ),
    most180s: leaderFor(players, (player) => player.count180s),
    highestTurn: leaderFor(players, (player) => player.highestTurn),
  };
}
