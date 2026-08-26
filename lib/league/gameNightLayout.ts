import {
  resolveGameNightSettings,
  type GameNightSettingsSummary,
  type ResolvedGameNightSettings,
} from "./gameNightContracts";

export type GameNightLayoutRecommendation = {
  checkedInPlayerCount: number;
  targetTeamCount: number;
  minTeamPlayers: number;
  maxTeamPlayers: number;
  boardCount: number;
  hasBye: boolean;
  description: string;
};

function clamp(value: number, minimum: number, maximum: number) {
  return Math.max(minimum, Math.min(maximum, value));
}

function balancedSizes(playerCount: number, teamCount: number) {
  if (playerCount <= 0 || teamCount <= 0) {
    return { minimum: 1, maximum: 1, average: 0, uneven: false };
  }
  const minimum = Math.floor(playerCount / teamCount);
  const maximum = Math.ceil(playerCount / teamCount);
  return {
    minimum,
    maximum,
    average: playerCount / teamCount,
    uneven: minimum !== maximum,
  };
}

function chooseAutomaticTeamCount(
  playerCount: number,
  settings: ResolvedGameNightSettings,
) {
  if (playerCount < 2) return 2;

  const maximumTeams = Math.min(64, playerCount);
  let candidates = Array.from(
    { length: maximumTeams - 1 },
    (_, index) => index + 2,
  );

  if (settings.teamSizeMode !== "automatic") {
    candidates = candidates.filter((teamCount) => {
      const sizes = balancedSizes(playerCount, teamCount);
      return (
        sizes.minimum >= settings.minTeamPlayers &&
        sizes.maximum <= settings.maxTeamPlayers
      );
    });
  }

  if (!candidates.length) {
    const preferred = Math.max(
      1,
      (settings.minTeamPlayers + settings.maxTeamPlayers) / 2,
    );
    return clamp(Math.round(playerCount / preferred), 2, maximumTeams);
  }

  const preferredSize =
    settings.teamSizeMode === "automatic"
      ? 2.5
      : (settings.minTeamPlayers + settings.maxTeamPlayers) / 2;

  return candidates
    .map((teamCount) => {
      const sizes = balancedSizes(playerCount, teamCount);
      let score = 0;

      // Synchronized rounds are simplest when every team can play at once.
      // Prefer an even team count, but not at the cost of wildly unsuitable
      // team sizes.
      if (teamCount % 2 !== 0) score += 1.25;

      // Exact distributions are preferable to one oversized team.
      if (sizes.uneven) score += 0.55;

      // Automatic sizing targets small, practical darts teams (2-3 players)
      // and only expands outside that range when the checked-in count makes it
      // necessary.
      if (settings.teamSizeMode === "automatic") {
        if (sizes.minimum < 2) score += (2 - sizes.minimum) * 8;
        if (sizes.maximum > 3) score += (sizes.maximum - 3) * 2.5;
      }

      score += Math.abs(sizes.average - preferredSize);

      // If two layouts are otherwise equally good, more teams creates more
      // opponents and better use of available boards.
      score -= teamCount * 0.005;

      return { teamCount, score };
    })
    .sort((a, b) => a.score - b.score || b.teamCount - a.teamCount)[0]
    .teamCount;
}

export function optimizeGameNightLayout(
  settingsInput: GameNightSettingsSummary,
  checkedInPlayerCount: number,
): {
  settings: ResolvedGameNightSettings;
  recommendation: GameNightLayoutRecommendation;
} {
  const settings = resolveGameNightSettings(settingsInput);
  const playerCount = Math.max(0, Math.floor(checkedInPlayerCount));

  let targetTeamCount = settings.targetTeamCount;
  if (settings.teamCountMode === "automatic") {
    targetTeamCount = chooseAutomaticTeamCount(playerCount, settings);
  }

  let minTeamPlayers = settings.minTeamPlayers;
  let maxTeamPlayers = settings.maxTeamPlayers;
  if (settings.teamSizeMode === "automatic" && playerCount > 0) {
    const sizes = balancedSizes(playerCount, targetTeamCount);
    minTeamPlayers = clamp(Math.max(1, sizes.minimum), 1, 16);
    maxTeamPlayers = clamp(
      Math.max(minTeamPlayers, sizes.maximum),
      minTeamPlayers,
      32,
    );
  }

  let boardCount = settings.boardCount;
  if (settings.boardCountMode === "automatic") {
    boardCount = clamp(Math.max(1, Math.floor(targetTeamCount / 2)), 1, 32);
  }

  const optimized: ResolvedGameNightSettings = {
    ...settings,
    targetTeamCount,
    minTeamPlayers,
    maxTeamPlayers,
    boardCount,
  };

  const teamSizeText =
    minTeamPlayers === maxTeamPlayers
      ? `${minTeamPlayers} player${minTeamPlayers === 1 ? "" : "s"} per team`
      : `${minTeamPlayers}-${maxTeamPlayers} players per team`;
  const hasBye = targetTeamCount % 2 !== 0;

  return {
    settings: optimized,
    recommendation: {
      checkedInPlayerCount: playerCount,
      targetTeamCount,
      minTeamPlayers,
      maxTeamPlayers,
      boardCount,
      hasBye,
      description:
        playerCount > 0
          ? `${playerCount} checked in → ${targetTeamCount} teams · ${teamSizeText} · ${boardCount} board${boardCount === 1 ? "" : "s"}${hasBye ? " · one rotating bye per round" : ""}`
          : "Check players in to calculate an automatic layout.",
    },
  };
}
