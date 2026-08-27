import type {
  BoardRotationType,
  FixturePairingStrategy,
} from "./gameNightContracts";

export type FixtureHistoryPairing = {
  roundNumber: number;
  boardId: string;
  teamAId: string;
  teamBId: string;
  winnerTeamId?: string | null;
};

export type FixtureStanding = {
  teamId: string;
  wins: number;
  losses: number;
};

export type FixtureRoundPairing = {
  boardId: string;
  teamAId: string;
  teamBId: string;
};

export type FixtureRoundPlan = {
  pairings: FixtureRoundPairing[];
  byeTeamIds: string[];
};

type RandomSource = () => number;

function shuffled<T>(items: T[], random: RandomSource): T[] {
  const result = [...items];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(random() * (index + 1));
    [result[index], result[swap]] = [result[swap], result[index]];
  }
  return result;
}

function opponentKey(a: string, b: string) {
  return a < b ? `${a}:${b}` : `${b}:${a}`;
}

function opponentCounts(history: FixtureHistoryPairing[]) {
  const counts = new Map<string, number>();
  for (const pairing of history) {
    const key = opponentKey(pairing.teamAId, pairing.teamBId);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return counts;
}

function byeCounts(teamIds: string[], history: FixtureHistoryPairing[]) {
  const counts = new Map(teamIds.map((teamId) => [teamId, 0]));
  const rounds = new Set(history.map((pairing) => pairing.roundNumber));
  for (const roundNumber of rounds) {
    const played = new Set(
      history
        .filter((pairing) => pairing.roundNumber === roundNumber)
        .flatMap((pairing) => [pairing.teamAId, pairing.teamBId]),
    );
    for (const teamId of teamIds) {
      if (!played.has(teamId)) counts.set(teamId, (counts.get(teamId) ?? 0) + 1);
    }
  }
  return counts;
}

function chooseFairBye(
  teamIds: string[],
  history: FixtureHistoryPairing[],
  random: RandomSource,
) {
  if (teamIds.length % 2 === 0) return { playing: [...teamIds], byeTeamIds: [] as string[] };
  const counts = byeCounts(teamIds, history);
  const minimum = Math.min(...teamIds.map((teamId) => counts.get(teamId) ?? 0));
  const candidates = shuffled(
    teamIds.filter((teamId) => (counts.get(teamId) ?? 0) === minimum),
    random,
  );
  const bye = candidates[0];
  return {
    playing: teamIds.filter((teamId) => teamId !== bye),
    byeTeamIds: [bye],
  };
}

function pairingPenalty(
  pairings: Array<[string, string]>,
  history: FixtureHistoryPairing[],
) {
  const counts = opponentCounts(history);
  return pairings.reduce((penalty, [a, b]) => {
    const repeats = counts.get(opponentKey(a, b)) ?? 0;
    return penalty + repeats * 10_000;
  }, 0);
}

function randomPairings(
  teamIds: string[],
  history: FixtureHistoryPairing[],
  random: RandomSource,
) {
  let best: Array<[string, string]> = [];
  let bestPenalty = Number.POSITIVE_INFINITY;

  // A bounded candidate search gives good rematch avoidance without turning
  // larger social leagues into an exponential matching problem.
  for (let attempt = 0; attempt < 192; attempt += 1) {
    const order = shuffled(teamIds, random);
    const candidate: Array<[string, string]> = [];
    for (let index = 0; index < order.length; index += 2) {
      candidate.push([order[index], order[index + 1]]);
    }
    const penalty = pairingPenalty(candidate, history);
    if (penalty < bestPenalty) {
      best = candidate;
      bestPenalty = penalty;
      if (penalty === 0) break;
    }
  }

  return best;
}

function fixedPairings(
  teamIds: string[],
  history: FixtureHistoryPairing[],
  random: RandomSource,
) {
  const available = new Set(teamIds);
  const firstRound = history.filter((pairing) => pairing.roundNumber === 1);
  if (firstRound.length) {
    const pairs: Array<[string, string]> = [];
    const used = new Set<string>();
    for (const pairing of firstRound) {
      if (!available.has(pairing.teamAId) || !available.has(pairing.teamBId)) continue;
      if (used.has(pairing.teamAId) || used.has(pairing.teamBId)) continue;
      pairs.push([pairing.teamAId, pairing.teamBId]);
      used.add(pairing.teamAId);
      used.add(pairing.teamBId);
    }
    return {
      pairings: pairs,
      byeTeamIds: teamIds.filter((teamId) => !used.has(teamId)),
    };
  }

  const byePlan = chooseFairBye(teamIds, history, random);
  return {
    pairings: randomPairings(byePlan.playing, [], random),
    byeTeamIds: byePlan.byeTeamIds,
  };
}

function roundRobinPairings(teamIds: string[], roundNumber: number) {
  const participants: Array<string | null> = [...teamIds];
  if (participants.length % 2 === 1) participants.push(null);
  if (participants.length < 2) return { pairings: [] as Array<[string, string]>, byeTeamIds: [] as string[] };

  const rotations = participants.length - 1;
  const targetRotation = (roundNumber - 1) % rotations;
  let current = [...participants];
  for (let rotation = 0; rotation < targetRotation; rotation += 1) {
    current = [current[0], current[current.length - 1], ...current.slice(1, -1)];
  }

  const pairings: Array<[string, string]> = [];
  const byeTeamIds: string[] = [];
  for (let index = 0; index < current.length / 2; index += 1) {
    const a = current[index];
    const b = current[current.length - 1 - index];
    if (a && b) pairings.push([a, b]);
    else if (a) byeTeamIds.push(a);
    else if (b) byeTeamIds.push(b);
  }
  return { pairings, byeTeamIds };
}

function standingsFromHistory(
  teamIds: string[],
  history: FixtureHistoryPairing[],
): FixtureStanding[] {
  const byTeam = new Map(
    teamIds.map((teamId) => [teamId, { teamId, wins: 0, losses: 0 }]),
  );
  for (const pairing of history) {
    if (!pairing.winnerTeamId) continue;
    const winner = byTeam.get(pairing.winnerTeamId);
    const loserId = pairing.winnerTeamId === pairing.teamAId ? pairing.teamBId : pairing.teamAId;
    const loser = byTeam.get(loserId);
    if (winner) winner.wins += 1;
    if (loser) loser.losses += 1;
  }
  return [...byTeam.values()];
}

function swissPairings(
  teamIds: string[],
  history: FixtureHistoryPairing[],
  random: RandomSource,
) {
  const counts = opponentCounts(history);
  const standings = standingsFromHistory(teamIds, history);
  const randomOrder = new Map(shuffled(teamIds, random).map((id, index) => [id, index]));
  const remaining = standings
    .sort((a, b) => b.wins - a.wins || a.losses - b.losses || (randomOrder.get(a.teamId) ?? 0) - (randomOrder.get(b.teamId) ?? 0))
    .map((standing) => standing.teamId);

  const pairings: Array<[string, string]> = [];
  while (remaining.length >= 2) {
    const a = remaining.shift()!;
    let bestIndex = 0;
    let bestScore = Number.POSITIVE_INFINITY;
    for (let index = 0; index < remaining.length; index += 1) {
      const b = remaining[index];
      const repeatPenalty = (counts.get(opponentKey(a, b)) ?? 0) * 10_000;
      const distancePenalty = index * 10;
      const score = repeatPenalty + distancePenalty;
      if (score < bestScore) {
        bestScore = score;
        bestIndex = index;
      }
    }
    const [b] = remaining.splice(bestIndex, 1);
    pairings.push([a, b]);
  }
  return pairings;
}

function boardUseCounts(history: FixtureHistoryPairing[]) {
  const result = new Map<string, Map<string, number>>();
  for (const pairing of history) {
    for (const teamId of [pairing.teamAId, pairing.teamBId]) {
      const map = result.get(teamId) ?? new Map<string, number>();
      map.set(pairing.boardId, (map.get(boardId) ?? 0) + 1);
      result.set(teamId, map);
    }
  }
  return result;
}

function assignBoards(
  pairs: Array<[string, string]>,
  boardIds: string[],
  history: FixtureHistoryPairing[],
  rotationType: BoardRotationType,
  roundNumber: number,
) {
  if (pairs.length > boardIds.length) {
    throw new Error("Not enough boards are available for this round.");
  }

  if (rotationType !== "rotate") {
    return pairs.map(([teamAId, teamBId], index) => ({
      boardId: boardIds[index],
      teamAId,
      teamBId,
    }));
  }

  const useCounts = boardUseCounts(history);
  const available = [...boardIds];
  const rotated = [...pairs.slice((roundNumber - 1) % Math.max(1, pairs.length)), ...pairs.slice(0, (roundNumber - 1) % Math.max(1, pairs.length))];

  return rotated.map(([teamAId, teamBId]) => {
    let bestIndex = 0;
    let bestPenalty = Number.POSITIVE_INFINITY;
    for (let index = 0; index < available.length; index += 1) {
      const boardId = available[index];
      const penalty =
        (useCounts.get(teamAId)?.get(boardId) ?? 0) +
        (useCounts.get(teamBId)?.get(boardId) ?? 0);
      if (penalty < bestPenalty) {
        bestPenalty = penalty;
        bestIndex = index;
      }
    }
    const [boardId] = available.splice(bestIndex, 1);
    return { boardId, teamAId, teamBId };
  });
}

export function generateFixtureRound(input: {
  teamIds: string[];
  boardIds: string[];
  roundNumber: number;
  strategy: FixturePairingStrategy;
  boardRotationType: BoardRotationType;
  history: FixtureHistoryPairing[];
  random?: RandomSource;
}): FixtureRoundPlan {
  const random = input.random ?? Math.random;
  const uniqueTeams = [...new Set(input.teamIds)];
  if (uniqueTeams.length < 2) return { pairings: [], byeTeamIds: [...uniqueTeams] };

  let pairs: Array<[string, string]>;
  let byeTeamIds: string[];

  if (input.strategy === "fixed") {
    const plan = fixedPairings(uniqueTeams, input.history, random);
    pairs = plan.pairings;
    byeTeamIds = plan.byeTeamIds;
  } else if (input.strategy === "round_robin") {
    const plan = roundRobinPairings(uniqueTeams, input.roundNumber);
    pairs = plan.pairings;
    byeTeamIds = plan.byeTeamIds;
  } else {
    const byePlan = chooseFairBye(uniqueTeams, input.history, random);
    byeTeamIds = byePlan.byeTeamIds;
    if (input.strategy === "swiss") {
      pairs = swissPairings(byePlan.playing, input.history, random);
    } else if (input.strategy === "manual") {
      // Manual mode intentionally starts from a predictable editable draft.
      pairs = [];
      for (let index = 0; index < byePlan.playing.length; index += 2) {
        pairs.push([byePlan.playing[index], byePlan.playing[index + 1]]);
      }
    } else {
      pairs = randomPairings(byePlan.playing, input.history, random);
    }
  }

  return {
    pairings: assignBoards(
      pairs,
      input.boardIds,
      input.history,
      input.boardRotationType,
      input.roundNumber,
    ),
    byeTeamIds,
  };
}
