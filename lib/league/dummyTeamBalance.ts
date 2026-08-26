import type { DummyPlayerMode } from "./gameNightContracts";

export function dummyTargetSizeForTeams(input: {
  mode: DummyPlayerMode;
  realPlayerCounts: number[];
  minTeamPlayers: number;
  maxTeamPlayers: number;
}) {
  const minimum = Math.max(1, input.minTeamPlayers);
  const maximum = Math.max(minimum, input.maxTeamPlayers);
  if (input.mode !== "balance") return minimum;

  const largestRealTeam = input.realPlayerCounts.length
    ? Math.max(...input.realPlayerCounts)
    : 0;
  return Math.min(maximum, Math.max(minimum, largestRealTeam));
}

export function dummyCountNeeded(currentMemberCount: number, targetSize: number) {
  return Math.max(0, targetSize - currentMemberCount);
}
