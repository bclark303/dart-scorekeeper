import type { ResolvedGameNightSettings } from "@/lib/league/gameNightContracts";
import { isSupportedBestOfLegs } from "@/lib/league/matchFormat";
import { isSupportedX01StartingScore } from "@/lib/scoring";

/**
 * Validate a fully resolved Game Night rule set at the domain boundary.
 *
 * APIs, persisted templates, and future Quick Start presets should all use the
 * same validation rather than growing separate copies of league-rule logic.
 */
export function isValidResolvedGameNightSettings(
  settings: ResolvedGameNightSettings,
) {
  return (
    ["manual", "automatic", "hybrid"].includes(settings.teamCreationMode) &&
    ["manual", "automatic"].includes(settings.teamCountMode) &&
    Number.isInteger(settings.targetTeamCount) &&
    settings.targetTeamCount >= 2 &&
    settings.targetTeamCount <= 64 &&
    ["manual", "automatic"].includes(settings.teamSizeMode) &&
    Number.isInteger(settings.minTeamPlayers) &&
    settings.minTeamPlayers >= 1 &&
    settings.minTeamPlayers <= 16 &&
    Number.isInteger(settings.maxTeamPlayers) &&
    settings.maxTeamPlayers >= settings.minTeamPlayers &&
    settings.maxTeamPlayers <= 32 &&
    ["none", "allow", "fill", "balance"].includes(settings.dummyPlayerMode) &&
    Number.isInteger(settings.dummyScore) &&
    settings.dummyScore >= 0 &&
    settings.dummyScore <= 180 &&
    ["manual", "automatic"].includes(settings.boardCountMode) &&
    Number.isInteger(settings.boardCount) &&
    settings.boardCount >= 1 &&
    settings.boardCount <= 32 &&
    ["fixed", "rotate", "manual"].includes(settings.boardRotationType) &&
    Number.isInteger(settings.roundCount) &&
    settings.roundCount >= 1 &&
    settings.roundCount <= 32 &&
    ["random", "round_robin", "swiss", "manual"].includes(
      settings.pairingStrategy,
    ) &&
    ["manual", "automatic"].includes(settings.roundAdvanceMode) &&
    Number.isInteger(settings.roundAdvanceDelaySeconds) &&
    settings.roundAdvanceDelaySeconds >= 0 &&
    settings.roundAdvanceDelaySeconds <= 3600 &&
    Array.isArray(settings.intermissionAfterRounds) &&
    settings.intermissionAfterRounds.every(
      (round) =>
        Number.isInteger(round) && round >= 1 && round < settings.roundCount,
    ) &&
    Number.isInteger(settings.intermissionDurationMinutes) &&
    settings.intermissionDurationMinutes >= 0 &&
    settings.intermissionDurationMinutes <= 180 &&
    isSupportedBestOfLegs(settings.legsPerMatch) &&
    isSupportedX01StartingScore(settings.startingScore) &&
    ["straight", "double"].includes(settings.finishRule)
  );
}
