export type AnalyticsRosterPlayer = {
  leaguePlayerId: string;
  playerId: string;
  displayName: string;
};

export type AnalyticsNight = {
  id: string;
  name: string;
  scheduledAt: number;
  status: string;
};

export type AnalyticsAttendanceRow = {
  gameNightId: string;
  leaguePlayerId: string;
  checkedIn: boolean;
};

export type AnalyticsTeamMemberRow = {
  gameNightId: string;
  teamId: string;
  leaguePlayerId: string | null;
  displayName: string;
  isDummy: boolean;
};

export type AnalyticsMatchRow = {
  id: string;
  gameNightId: string;
  teamAId: string;
  teamBId: string;
};

export type AnalyticsTurnRow = {
  gameNightId: string;
  matchSessionId: string;
  teamId: string;
  leaguePlayerId: string | null;
  displayName: string;
  isDummy: boolean;
  scoreEntered: number;
  dartsThrown: number;
  isBust: boolean;
  isCheckout: boolean;
};

export type AnalyticsDartRow = {
  leaguePlayerId: string | null;
  segment: string;
  multiplier: number;
  score: number;
};

export type SeasonAnalyticsInput = {
  leagueId: string;
  leagueName: string;
  seasonId: string;
  seasonName: string;
  roster: AnalyticsRosterPlayer[];
  nights: AnalyticsNight[];
  attendance: AnalyticsAttendanceRow[];
  teamMembers: AnalyticsTeamMemberRow[];
  matches: AnalyticsMatchRow[];
  turns: AnalyticsTurnRow[];
  darts: AnalyticsDartRow[];
};

export type SeasonAnalyticsTrendPoint = {
  gameNightId: string;
  gameNightName: string;
  scheduledAt: number;
  turns: number;
  dartsThrown: number;
  pointsScored: number;
  threeDartAverage: number;
};

export type SeasonAnalyticsPlayer = {
  standingsRank: number;
  leaguePlayerId: string;
  playerId: string;
  displayName: string;
  nightsAttended: number;
  totalNights: number;
  attendanceRate: number;
  legWins: number;
  legLosses: number;
  legDifferential: number;
  legWinPercentage: number;
  turns: number;
  dartsThrown: number;
  pointsScored: number;
  threeDartAverage: number;
  recentThreeDartAverage: number;
  count100Plus: number;
  count140Plus: number;
  count180s: number;
  highestTurn: number;
  doubleOuts: number;
  highestCheckout: number;
  trend: SeasonAnalyticsTrendPoint[];
};

export type SeasonAnalyticsPartnership = {
  playerAId: string;
  playerAName: string;
  playerBId: string;
  playerBName: string;
  nightsTogether: number;
  legsTogether: number;
  legWins: number;
  legLosses: number;
  legWinPercentage: number;
};

export type SeasonAnalyticsHeadToHead = {
  playerAId: string;
  playerAName: string;
  playerBId: string;
  playerBName: string;
  nightsOpposed: number;
  legs: number;
  playerAWins: number;
  playerBWins: number;
};

export type SeasonAnalyticsSegment = {
  label: string;
  segment: string;
  multiplier: number;
  count: number;
  percentage: number;
};

export type SeasonAnalyticsScoreBucket = {
  label: string;
  count: number;
  percentage: number;
};

export type SeasonAnalyticsSummary = {
  leagueId: string;
  leagueName: string;
  seasonId: string;
  seasonName: string;
  gameType: "x01";
  totalNights: number;
  completedNights: number;
  totalPlayers: number;
  totalLegs: number;
  totalTurns: number;
  totalDartsThrown: number;
  totalPointsScored: number;
  leagueThreeDartAverage: number;
  detailedDartsRecorded: number;
  detailedDartCoverage: number;
  players: SeasonAnalyticsPlayer[];
  partnerships: SeasonAnalyticsPartnership[];
  headToHead: SeasonAnalyticsHeadToHead[];
  scoreBuckets: SeasonAnalyticsScoreBucket[];
  segments: SeasonAnalyticsSegment[];
};

type MutablePlayer = Omit<
  SeasonAnalyticsPlayer,
  "standingsRank" | "attendanceRate" | "legDifferential" | "legWinPercentage" | "threeDartAverage" | "recentThreeDartAverage" | "trend"
> & {
  attendanceNights: Set<string>;
  trendMap: Map<string, Omit<SeasonAnalyticsTrendPoint, "threeDartAverage">>;
};

type MutablePair = {
  playerAId: string;
  playerAName: string;
  playerBId: string;
  playerBName: string;
  nightIds: Set<string>;
  legWins: number;
  legLosses: number;
};

type MutableHeadToHead = {
  playerAId: string;
  playerAName: string;
  playerBId: string;
  playerBName: string;
  nightIds: Set<string>;
  playerAWins: number;
  playerBWins: number;
};

function pct(numerator: number, denominator: number) {
  return denominator > 0 ? (numerator / denominator) * 100 : 0;
}

function average3(points: number, darts: number) {
  return darts > 0 ? (points / darts) * 3 : 0;
}

function pairKey(a: string, b: string) {
  return a < b ? `${a}::${b}` : `${b}::${a}`;
}

function pairNames(
  a: { id: string; name: string },
  b: { id: string; name: string },
) {
  return a.id < b.id
    ? { playerAId: a.id, playerAName: a.name, playerBId: b.id, playerBName: b.name }
    : { playerAId: b.id, playerAName: b.name, playerBId: a.id, playerBName: a.name };
}

function segmentLabel(segment: string, multiplier: number) {
  if (segment === "miss" || multiplier === 0) return "MISS";
  if (segment === "bull") return "BULL";
  if (segment === "outer-bull") return "25";
  if (multiplier === 3) return `T${segment}`;
  if (multiplier === 2) return `D${segment}`;
  return `S${segment}`;
}

function scoreBucket(score: number) {
  if (score <= 20) return "0–20";
  if (score <= 40) return "21–40";
  if (score <= 60) return "41–60";
  if (score <= 80) return "61–80";
  if (score <= 99) return "81–99";
  if (score <= 139) return "100–139";
  if (score <= 179) return "140–179";
  return "180";
}

const SCORE_BUCKET_ORDER = [
  "0–20",
  "21–40",
  "41–60",
  "61–80",
  "81–99",
  "100–139",
  "140–179",
  "180",
];

export function buildSeasonAnalytics(input: SeasonAnalyticsInput): SeasonAnalyticsSummary {
  const playableNights = input.nights.filter((night) => night.status !== "cancelled");
  const nightById = new Map(playableNights.map((night) => [night.id, night]));
  const players = new Map<string, MutablePlayer>();

  for (const player of input.roster) {
    players.set(player.leaguePlayerId, {
      leaguePlayerId: player.leaguePlayerId,
      playerId: player.playerId,
      displayName: player.displayName,
      nightsAttended: 0,
      totalNights: playableNights.length,
      legWins: 0,
      legLosses: 0,
      turns: 0,
      dartsThrown: 0,
      pointsScored: 0,
      count100Plus: 0,
      count140Plus: 0,
      count180s: 0,
      highestTurn: 0,
      doubleOuts: 0,
      highestCheckout: 0,
      attendanceNights: new Set<string>(),
      trendMap: new Map(),
    });
  }

  for (const row of input.attendance) {
    if (!row.checkedIn || !nightById.has(row.gameNightId)) continue;
    const player = players.get(row.leaguePlayerId);
    if (player) player.attendanceNights.add(row.gameNightId);
  }

  const membershipsByTeam = new Map<
    string,
    Array<{ id: string; name: string; gameNightId: string }>
  >();
  for (const member of input.teamMembers) {
    if (member.isDummy || !member.leaguePlayerId) continue;
    const current = membershipsByTeam.get(member.teamId) ?? [];
    current.push({ id: member.leaguePlayerId, name: member.displayName, gameNightId: member.gameNightId });
    membershipsByTeam.set(member.teamId, current);
  }

  const partnerships = new Map<string, MutablePair>();
  for (const members of membershipsByTeam.values()) {
    for (let i = 0; i < members.length; i += 1) {
      for (let j = i + 1; j < members.length; j += 1) {
        const a = members[i];
        const b = members[j];
        const key = pairKey(a.id, b.id);
        const names = pairNames(a, b);
        const current = partnerships.get(key) ?? {
          ...names,
          nightIds: new Set<string>(),
          legWins: 0,
          legLosses: 0,
        };
        current.nightIds.add(a.gameNightId);
        partnerships.set(key, current);
      }
    }
  }

  let totalPointsScored = 0;
  let totalDartsThrown = 0;
  const bucketCounts = new Map<string, number>();

  for (const turn of input.turns) {
    if (turn.isDummy || !turn.leaguePlayerId || !nightById.has(turn.gameNightId)) continue;
    const player = players.get(turn.leaguePlayerId);
    if (!player) continue;

    const points = turn.isBust ? 0 : turn.scoreEntered;
    player.turns += 1;
    player.dartsThrown += turn.dartsThrown;
    player.pointsScored += points;
    player.highestTurn = Math.max(player.highestTurn, turn.isBust ? 0 : turn.scoreEntered);
    if (!turn.isBust && turn.scoreEntered >= 100) player.count100Plus += 1;
    if (!turn.isBust && turn.scoreEntered >= 140) player.count140Plus += 1;
    if (!turn.isBust && turn.scoreEntered === 180) player.count180s += 1;
    if (turn.isCheckout) {
      player.doubleOuts += 1;
      player.highestCheckout = Math.max(player.highestCheckout, turn.scoreEntered);
    }

    totalPointsScored += points;
    totalDartsThrown += turn.dartsThrown;
    const bucket = scoreBucket(turn.isBust ? 0 : turn.scoreEntered);
    bucketCounts.set(bucket, (bucketCounts.get(bucket) ?? 0) + 1);

    const night = nightById.get(turn.gameNightId)!;
    const trend = player.trendMap.get(turn.gameNightId) ?? {
      gameNightId: turn.gameNightId,
      gameNightName: night.name,
      scheduledAt: night.scheduledAt,
      turns: 0,
      dartsThrown: 0,
      pointsScored: 0,
    };
    trend.turns += 1;
    trend.dartsThrown += turn.dartsThrown;
    trend.pointsScored += points;
    player.trendMap.set(turn.gameNightId, trend);
  }

  const matchById = new Map(input.matches.map((match) => [match.id, match]));
  const headToHead = new Map<string, MutableHeadToHead>();
  let totalLegs = 0;

  for (const checkout of input.turns.filter((turn) => turn.isCheckout)) {
    const match = matchById.get(checkout.matchSessionId);
    if (!match || !nightById.has(match.gameNightId)) continue;
    const winnerTeamId = checkout.teamId;
    const loserTeamId = winnerTeamId === match.teamAId ? match.teamBId : match.teamAId;
    const winners = membershipsByTeam.get(winnerTeamId) ?? [];
    const losers = membershipsByTeam.get(loserTeamId) ?? [];
    totalLegs += 1;

    for (const winner of winners) {
      const player = players.get(winner.id);
      if (player) player.legWins += 1;
    }
    for (const loser of losers) {
      const player = players.get(loser.id);
      if (player) player.legLosses += 1;
    }

    for (const teamMembers of [winners, losers]) {
      const isWin = teamMembers === winners;
      for (let i = 0; i < teamMembers.length; i += 1) {
        for (let j = i + 1; j < teamMembers.length; j += 1) {
          const a = teamMembers[i];
          const b = teamMembers[j];
          const current = partnerships.get(pairKey(a.id, b.id));
          if (!current) continue;
          if (isWin) current.legWins += 1;
          else current.legLosses += 1;
        }
      }
    }

    for (const winner of winners) {
      for (const loser of losers) {
        const key = pairKey(winner.id, loser.id);
        const names = pairNames(winner, loser);
        const current = headToHead.get(key) ?? {
          ...names,
          nightIds: new Set<string>(),
          playerAWins: 0,
          playerBWins: 0,
        };
        current.nightIds.add(match.gameNightId);
        if (winner.id === current.playerAId) current.playerAWins += 1;
        else current.playerBWins += 1;
        headToHead.set(key, current);
      }
    }
  }

  const finalizedPlayers = [...players.values()]
    .map((player) => {
      const trend = [...player.trendMap.values()]
        .sort((a, b) => a.scheduledAt - b.scheduledAt)
        .map((point) => ({
          ...point,
          threeDartAverage: average3(point.pointsScored, point.dartsThrown),
        }));
      const recent = trend.slice(-5);
      const recentPoints = recent.reduce((sum, point) => sum + point.pointsScored, 0);
      const recentDarts = recent.reduce((sum, point) => sum + point.dartsThrown, 0);
      const legs = player.legWins + player.legLosses;
      return {
        standingsRank: 0,
        leaguePlayerId: player.leaguePlayerId,
        playerId: player.playerId,
        displayName: player.displayName,
        nightsAttended: player.attendanceNights.size,
        totalNights: player.totalNights,
        attendanceRate: pct(player.attendanceNights.size, player.totalNights),
        legWins: player.legWins,
        legLosses: player.legLosses,
        legDifferential: player.legWins - player.legLosses,
        legWinPercentage: pct(player.legWins, legs),
        turns: player.turns,
        dartsThrown: player.dartsThrown,
        pointsScored: player.pointsScored,
        threeDartAverage: average3(player.pointsScored, player.dartsThrown),
        recentThreeDartAverage: average3(recentPoints, recentDarts),
        count100Plus: player.count100Plus,
        count140Plus: player.count140Plus,
        count180s: player.count180s,
        highestTurn: player.highestTurn,
        doubleOuts: player.doubleOuts,
        highestCheckout: player.highestCheckout,
        trend,
      } satisfies SeasonAnalyticsPlayer;
    })
    .sort(
      (a, b) =>
        b.legWins - a.legWins ||
        b.legWinPercentage - a.legWinPercentage ||
        b.legDifferential - a.legDifferential ||
        b.threeDartAverage - a.threeDartAverage ||
        a.displayName.localeCompare(b.displayName),
    )
    .map((player, index) => ({ ...player, standingsRank: index + 1 }));

  const finalizedPartnerships = [...partnerships.values()]
    .map((pair) => {
      const legsTogether = pair.legWins + pair.legLosses;
      return {
        playerAId: pair.playerAId,
        playerAName: pair.playerAName,
        playerBId: pair.playerBId,
        playerBName: pair.playerBName,
        nightsTogether: pair.nightIds.size,
        legsTogether,
        legWins: pair.legWins,
        legLosses: pair.legLosses,
        legWinPercentage: pct(pair.legWins, legsTogether),
      };
    })
    .sort((a, b) => b.nightsTogether - a.nightsTogether || b.legWinPercentage - a.legWinPercentage);

  const finalizedHeadToHead = [...headToHead.values()]
    .map((pair) => ({
      playerAId: pair.playerAId,
      playerAName: pair.playerAName,
      playerBId: pair.playerBId,
      playerBName: pair.playerBName,
      nightsOpposed: pair.nightIds.size,
      legs: pair.playerAWins + pair.playerBWins,
      playerAWins: pair.playerAWins,
      playerBWins: pair.playerBWins,
    }))
    .sort((a, b) => b.legs - a.legs || b.nightsOpposed - a.nightsOpposed);

  const totalTurns = input.turns.filter((turn) => !turn.isDummy && turn.leaguePlayerId && nightById.has(turn.gameNightId)).length;
  const scoreBuckets = SCORE_BUCKET_ORDER.map((label) => ({
    label,
    count: bucketCounts.get(label) ?? 0,
    percentage: pct(bucketCounts.get(label) ?? 0, totalTurns),
  }));

  const segmentCounts = new Map<string, { segment: string; multiplier: number; count: number }>();
  for (const dart of input.darts) {
    const label = segmentLabel(dart.segment, dart.multiplier);
    const current = segmentCounts.get(label) ?? {
      segment: dart.segment,
      multiplier: dart.multiplier,
      count: 0,
    };
    current.count += 1;
    segmentCounts.set(label, current);
  }
  const detailedDartsRecorded = input.darts.length;
  const segments = [...segmentCounts.entries()]
    .map(([label, value]) => ({
      label,
      segment: value.segment,
      multiplier: value.multiplier,
      count: value.count,
      percentage: pct(value.count, detailedDartsRecorded),
    }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));

  return {
    leagueId: input.leagueId,
    leagueName: input.leagueName,
    seasonId: input.seasonId,
    seasonName: input.seasonName,
    gameType: "x01",
    totalNights: playableNights.length,
    completedNights: playableNights.filter((night) => night.status === "completed").length,
    totalPlayers: finalizedPlayers.length,
    totalLegs,
    totalTurns,
    totalDartsThrown,
    totalPointsScored,
    leagueThreeDartAverage: average3(totalPointsScored, totalDartsThrown),
    detailedDartsRecorded,
    detailedDartCoverage: pct(detailedDartsRecorded, totalDartsThrown),
    players: finalizedPlayers,
    partnerships: finalizedPartnerships,
    headToHead: finalizedHeadToHead,
    scoreBuckets,
    segments,
  };
}
