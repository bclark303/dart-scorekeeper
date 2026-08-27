export type SeasonLegResultInput = {
  gameNightId: string;
  winnerTeamId: string;
  loserTeamId: string;
};

export type SeasonTeamMemberInput = {
  teamId: string;
  leaguePlayerId: string | null;
  displayName: string;
  isDummy: boolean;
};

export type SeasonLegStanding = {
  leaguePlayerId: string;
  displayName: string;
  nightsPlayed: number;
  legWins: number;
  legLosses: number;
  legDifferential: number;
  legWinPercentage: number;
};

export function buildSeasonLegStandings(
  legs: SeasonLegResultInput[],
  members: SeasonTeamMemberInput[],
): SeasonLegStanding[] {
  const membersByTeam = new Map<string, SeasonTeamMemberInput[]>();
  for (const member of members) {
    if (member.isDummy || !member.leaguePlayerId) continue;
    const current = membersByTeam.get(member.teamId) ?? [];
    current.push(member);
    membersByTeam.set(member.teamId, current);
  }

  const byPlayer = new Map<
    string,
    Omit<SeasonLegStanding, "nightsPlayed" | "legDifferential" | "legWinPercentage"> & {
      nightIds: Set<string>;
    }
  >();

  function apply(
    teamId: string,
    gameNightId: string,
    result: "win" | "loss",
  ) {
    for (const member of membersByTeam.get(teamId) ?? []) {
      const current = byPlayer.get(member.leaguePlayerId!) ?? {
        leaguePlayerId: member.leaguePlayerId!,
        displayName: member.displayName,
        legWins: 0,
        legLosses: 0,
        nightIds: new Set<string>(),
      };
      current.displayName = member.displayName;
      current.nightIds.add(gameNightId);
      if (result === "win") current.legWins += 1;
      else current.legLosses += 1;
      byPlayer.set(member.leaguePlayerId!, current);
    }
  }

  for (const leg of legs) {
    apply(leg.winnerTeamId, leg.gameNightId, "win");
    apply(leg.loserTeamId, leg.gameNightId, "loss");
  }

  return [...byPlayer.values()]
    .map((player) => {
      const total = player.legWins + player.legLosses;
      return {
        leaguePlayerId: player.leaguePlayerId,
        displayName: player.displayName,
        nightsPlayed: player.nightIds.size,
        legWins: player.legWins,
        legLosses: player.legLosses,
        legDifferential: player.legWins - player.legLosses,
        legWinPercentage: total > 0 ? (player.legWins / total) * 100 : 0,
      };
    })
    .sort(
      (a, b) =>
        b.legWins - a.legWins ||
        b.legWinPercentage - a.legWinPercentage ||
        b.legDifferential - a.legDifferential ||
        a.displayName.localeCompare(b.displayName),
    );
}
