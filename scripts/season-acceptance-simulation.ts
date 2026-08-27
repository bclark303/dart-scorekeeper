import fs from "node:fs";

import { DEFAULT_GAME_NIGHT_SETTINGS, type GameNightSettingsSummary } from "@/lib/league/gameNightContracts";
import { generateFixtureRound } from "@/lib/league/fixtureEngine";
import { optimizeGameNightLayout } from "@/lib/league/gameNightLayout";
import { legsNeededToWin } from "@/lib/league/matchFormat";
import { evaluateX01Turn } from "@/lib/x01Engine";

type RandomSource = () => number;

type PlayerProfile = {
  id: string;
  name: string;
  threeDartAverage: number;
  attendanceWeight: number;
  attendance: number;
  legsWon: number;
  legsLost: number;
  turns: number;
  darts: number;
  points: number;
  busts: number;
  checkouts: number;
  count100Plus: number;
  count140Plus: number;
  count180s: number;
  highestTurn: number;
  highestCheckout: number;
};

type SimTeam = {
  id: string;
  members: PlayerProfile[];
};

type Pairing = {
  a: SimTeam;
  b: SimTeam;
};

type LegResult = {
  winnerTeamId: string;
  checkoutPlayerId: string;
  turns: number;
  darts: number;
  seconds: number;
  count180s: number;
};

type MatchResult = {
  legWinners: string[];
  wouldCurrentBestOfThreeStopAfterTwo: boolean;
  turns: number;
  darts: number;
  seconds: number;
  count180s: number;
};

const CONFIG = {
  seed: "v0.5-28p-22w-4b-601-fixed3",
  rosterSize: 28,
  gameNights: 22,
  firstThursday: "2026-09-03",
  startTime: "19:00",
  timezone: "America/Toronto",
  minAttendance: 10,
  maxAttendance: 28,
  boardMaximum: 4,
  roundsPerNight: 3,
  startingScore: 601,
  finishRule: "double_out" as const,
  fixedLegsPerMatch: 3,
  breakAfterLeg: 2,
  breakMinutes: 10,
  secondsPerTurnForDurationEstimate: 18,
  secondsBetweenLegOneAndTwo: 60,
  secondsBetweenWaves: 120,
  secondsBetweenRounds: 180,
};

function hashSeed(text: string) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < text.length; i += 1) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function mulberry32(seed: number): RandomSource {
  let value = seed >>> 0;
  return () => {
    value += 0x6d2b79f5;
    let t = value;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function normal(random: RandomSource, mean: number, sd: number) {
  const u1 = Math.max(random(), Number.EPSILON);
  const u2 = Math.max(random(), Number.EPSILON);
  const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
  return mean + z * sd;
}

function shuffle<T>(items: T[], random: RandomSource) {
  const result = [...items];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(random() * (index + 1));
    [result[index], result[swap]] = [result[swap], result[index]];
  }
  return result;
}

function dateForWeek(weekIndex: number) {
  const [year, month, day] = CONFIG.firstThursday.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day + weekIndex * 7));
  return date.toISOString().slice(0, 10);
}

function createPlayers(random: RandomSource): PlayerProfile[] {
  return Array.from({ length: CONFIG.rosterSize }, (_, index) => {
    const progress = index / (CONFIG.rosterSize - 1);
    const baseline = 22 + Math.pow(progress, 1.08) * 36;
    const average = clamp(baseline + normal(random, 0, 1.8), 20, 59);
    return {
      id: `player-${String(index + 1).padStart(2, "0")}`,
      name: `Player ${String(index + 1).padStart(2, "0")}`,
      threeDartAverage: Number(average.toFixed(1)),
      attendanceWeight: Number((0.45 + random() * 0.45).toFixed(3)),
      attendance: 0,
      legsWon: 0,
      legsLost: 0,
      turns: 0,
      darts: 0,
      points: 0,
      busts: 0,
      checkouts: 0,
      count100Plus: 0,
      count140Plus: 0,
      count180s: 0,
      highestTurn: 0,
      highestCheckout: 0,
    };
  });
}

function weightedAttendance(players: PlayerProfile[], count: number, random: RandomSource) {
  return players
    .map((player) => ({
      player,
      key: -Math.log(Math.max(random(), Number.EPSILON)) / player.attendanceWeight,
    }))
    .sort((a, b) => a.key - b.key)
    .slice(0, count)
    .map((item) => item.player);
}

function buildRandomTeams(attendees: PlayerProfile[], teamCount: number, random: RandomSource): SimTeam[] {
  const order = shuffle(attendees, random);
  const teams = Array.from({ length: teamCount }, (_, index) => ({
    id: `team-${index + 1}`,
    members: [] as PlayerProfile[],
  }));
  order.forEach((player, index) => {
    teams[index % teamCount].members.push(player);
  });
  return teams;
}

function opponentKey(a: string, b: string) {
  return a < b ? `${a}:${b}` : `${b}:${a}`;
}

function chooseBye(
  teams: SimTeam[],
  byeCounts: Map<string, number>,
  random: RandomSource,
) {
  if (teams.length % 2 === 0) return { playing: [...teams], bye: null as SimTeam | null };
  const minimum = Math.min(...teams.map((team) => byeCounts.get(team.id) ?? 0));
  const candidates = shuffle(
    teams.filter((team) => (byeCounts.get(team.id) ?? 0) === minimum),
    random,
  );
  const bye = candidates[0];
  byeCounts.set(bye.id, (byeCounts.get(bye.id) ?? 0) + 1);
  return { playing: teams.filter((team) => team.id !== bye.id), bye };
}

function pairTeams(
  playing: SimTeam[],
  priorOpponents: Set<string>,
  random: RandomSource,
): Pairing[] {
  let best: Pairing[] = [];
  let bestPenalty = Number.POSITIVE_INFINITY;
  for (let attempt = 0; attempt < 256; attempt += 1) {
    const order = shuffle(playing, random);
    const candidate: Pairing[] = [];
    for (let index = 0; index < order.length; index += 2) {
      candidate.push({ a: order[index], b: order[index + 1] });
    }
    const penalty = candidate.reduce(
      (sum, pairing) => sum + (priorOpponents.has(opponentKey(pairing.a.id, pairing.b.id)) ? 10_000 : 0),
      0,
    );
    if (penalty < bestPenalty) {
      best = candidate;
      bestPenalty = penalty;
      if (penalty === 0) break;
    }
  }
  best.forEach((pairing) => priorOpponents.add(opponentKey(pairing.a.id, pairing.b.id)));
  return best;
}

const BOGEY_CHECKOUTS = new Set([169, 168, 166, 165, 163, 162, 159]);

function checkoutProbability(player: PlayerProfile, remaining: number) {
  const skill = player.threeDartAverage;
  const base = clamp(0.012 + (skill - 20) * 0.0047, 0.012, 0.20);
  const rangeFactor = remaining <= 40 ? 1.45 : remaining <= 80 ? 1.15 : remaining <= 120 ? 0.82 : 0.52;
  return clamp(base * rangeFactor, 0.008, 0.26);
}

function chooseTurn(
  player: PlayerProfile,
  remaining: number,
  random: RandomSource,
): { scoreEntered: number; dartsThrown: 1 | 2 | 3; checkoutConfirmed?: boolean } {
  const canCheckout = remaining >= 2 && remaining <= 170 && !BOGEY_CHECKOUTS.has(remaining);
  if (canCheckout && random() < checkoutProbability(player, remaining)) {
    let dartsThrown: 1 | 2 | 3 = 3;
    if (remaining <= 40 && random() < 0.22 + player.threeDartAverage / 260) dartsThrown = 1;
    else if (remaining <= 100 && random() < 0.44) dartsThrown = 2;
    return { scoreEntered: remaining, dartsThrown, checkoutConfirmed: true };
  }

  const rare180Chance =
    remaining > 181 && player.threeDartAverage >= 45
      ? ((player.threeDartAverage - 45) / 14) * 0.00006
      : 0;
  if (random() < rare180Chance) {
    return { scoreEntered: 180, dartsThrown: 3 };
  }

  const spread = 13 + player.threeDartAverage * 0.38;
  let scoreEntered = Math.round(normal(random, player.threeDartAverage, spread));
  scoreEntered = clamp(scoreEntered, 0, 179);

  if (scoreEntered === remaining) {
    return { scoreEntered, dartsThrown: 3, checkoutConfirmed: false };
  }
  return { scoreEntered, dartsThrown: 3 };
}

function recordTurn(
  player: PlayerProfile,
  evaluation: ReturnType<typeof evaluateX01Turn>,
  dartsThrown: 1 | 2 | 3,
) {
  player.turns += 1;
  player.darts += dartsThrown;
  if (evaluation.isBust) {
    player.busts += 1;
    return;
  }
  player.points += evaluation.scoreEntered;
  player.highestTurn = Math.max(player.highestTurn, evaluation.scoreEntered);
  if (evaluation.scoreEntered >= 100) player.count100Plus += 1;
  if (evaluation.scoreEntered >= 140) player.count140Plus += 1;
  if (evaluation.scoreEntered === 180) player.count180s += 1;
  if (evaluation.isCheckout) {
    player.checkouts += 1;
    player.highestCheckout = Math.max(player.highestCheckout, evaluation.scoreEntered);
  }
}

function simulateLeg(
  a: SimTeam,
  b: SimTeam,
  legNumber: number,
  random: RandomSource,
): LegResult {
  let aScore = CONFIG.startingScore;
  let bScore = CONFIG.startingScore;
  let aMemberIndex = (legNumber - 1) % a.members.length;
  let bMemberIndex = (legNumber - 1) % b.members.length;
  let current: "a" | "b" = legNumber % 2 === 1 ? "a" : "b";
  let turns = 0;
  let darts = 0;
  let count180s = 0;

  while (turns < 400) {
    const team = current === "a" ? a : b;
    const memberIndex = current === "a" ? aMemberIndex : bMemberIndex;
    const player = team.members[memberIndex];
    const scoreBefore = current === "a" ? aScore : bScore;
    let proposed = chooseTurn(player, scoreBefore, random);

    if (turns === 399) {
      proposed = {
        scoreEntered: scoreBefore,
        dartsThrown: scoreBefore <= 40 ? 1 : scoreBefore <= 100 ? 2 : 3,
        checkoutConfirmed: true,
      };
    }

    const evaluation = evaluateX01Turn({
      scoreBefore,
      scoreEntered: proposed.scoreEntered,
      finishRule: CONFIG.finishRule,
      dartsThrown: proposed.dartsThrown,
      checkoutConfirmed: proposed.checkoutConfirmed,
    });
    recordTurn(player, evaluation, proposed.dartsThrown);
    turns += 1;
    darts += proposed.dartsThrown;
    if (!evaluation.isBust && evaluation.scoreEntered === 180) count180s += 1;

    if (current === "a") {
      aScore = evaluation.scoreAfter;
      aMemberIndex = (aMemberIndex + 1) % a.members.length;
    } else {
      bScore = evaluation.scoreAfter;
      bMemberIndex = (bMemberIndex + 1) % b.members.length;
    }

    if (evaluation.isCheckout) {
      return {
        winnerTeamId: team.id,
        checkoutPlayerId: player.id,
        turns,
        darts,
        seconds: turns * CONFIG.secondsPerTurnForDurationEstimate,
        count180s,
      };
    }

    current = current === "a" ? "b" : "a";
  }

  throw new Error(`Leg ${legNumber} did not finish within the simulation safety limit.`);
}

function simulateMatch(a: SimTeam, b: SimTeam, random: RandomSource): MatchResult {
  const legs: LegResult[] = [];
  for (let legNumber = 1; legNumber <= CONFIG.fixedLegsPerMatch; legNumber += 1) {
    legs.push(simulateLeg(a, b, legNumber, random));
  }

  for (const leg of legs) {
    const winners = leg.winnerTeamId === a.id ? a.members : b.members;
    const losers = leg.winnerTeamId === a.id ? b.members : a.members;
    winners.forEach((player) => {
      player.legsWon += 1;
    });
    losers.forEach((player) => {
      player.legsLost += 1;
    });
  }

  const firstTwoSame = legs[0].winnerTeamId === legs[1].winnerTeamId;
  const breakSeconds = CONFIG.breakMinutes * 60;
  const seconds =
    legs.reduce((sum, leg) => sum + leg.seconds, 0) +
    CONFIG.secondsBetweenLegOneAndTwo +
    breakSeconds;

  return {
    legWinners: legs.map((leg) => leg.winnerTeamId),
    wouldCurrentBestOfThreeStopAfterTwo: firstTwoSame,
    turns: legs.reduce((sum, leg) => sum + leg.turns, 0),
    darts: legs.reduce((sum, leg) => sum + leg.darts, 0),
    seconds,
    count180s: legs.reduce((sum, leg) => sum + leg.count180s, 0),
  };
}

function markdownReport(report: any) {
  const blocked = report.structuralAudit.boardCapacity.blockedNights;
  const standings = report.standings.slice(0, 10);
  const nightRows = report.nights
    .map(
      (night: any) =>
        `| ${night.week} | ${night.date} | ${night.attendance} | ${night.teamCount} | ${night.teamSizes.join("/")} | ${night.pairingsPerRound} | ${night.wavesPerRound} | ${night.currentFixtureSchedulable ? "Yes" : "NO"} | ${night.total180s} | ${night.estimatedMinutes} |`,
    )
    .join("\n");
  const standingRows = standings
    .map(
      (player: any, index: number) =>
        `| ${index + 1} | ${player.name} | ${player.skillAverage} | ${player.attendance} | ${player.legsWon} | ${player.legsLost} | ${player.legWinPct}% | ${player.actualThreeDartAverage} | ${player.count180s} |`,
    )
    .join("\n");

  return `# v0.5 Season Acceptance Simulation\n\n` +
    `Seed: \`${report.config.seed}\`\n\n` +
    `## Rules simulated\n\n` +
    `- 28-player roster\n- 22 weekly Thursday Game Nights starting ${report.config.firstThursday} at ${report.config.startTime} ${report.config.timezone}\n- 10–28 attendees nightly\n- randomly rebuilt 2–3-player teams, fixed for the entire Game Night\n- 3 rounds per night\n- maximum 4 boards\n- exactly 3 legs of 601 Double Out per matchup\n- 10-minute break between legs 2 and 3\n- individual standings by team legs won/lost\n\n` +
    `## Current v0.5 structural audit\n\n` +
    `- Fixed three-leg match supported: **${report.structuralAudit.fixedThreeLegMatchSupported ? "YES" : "NO"}** (current best-of-3 requires ${report.structuralAudit.currentLegsNeededToWin} leg wins).\n` +
    `- Break between legs supported: **NO** (current intermissions are round-level).\n` +
    `- Four-board capacity with automatic 2–3-player teams: **${blocked === 0 ? "PASS" : "FAIL"}** — ${blocked}/${report.config.gameNights} simulated nights create more simultaneous pairings than four boards.\n` +
    `- Season individual-leg standings represented by current v0.5: **NO dedicated season standings model found**; the simulator derives the table externally.\n` +
    `- Desired matches that would be truncated at 2–0 by current best-of-3: **${report.structuralAudit.fixedThreeLegImpact.matchesTruncatedAtTwo}/${report.season.totalMatches} (${report.structuralAudit.fixedThreeLegImpact.percentOfMatches}%)**.\n\n` +
    `## Season totals\n\n` +
    `- Attendance: ${report.season.minAttendance}–${report.season.maxAttendance}, average ${report.season.averageAttendance}\n` +
    `- Matches: ${report.season.totalMatches}\n- Legs: ${report.season.totalLegs}\n- Simulated turns: ${report.season.totalTurns}\n` +
    `- 180s: **${report.season.total180s}**\n- Average estimated Game Night duration with four-board waves: **${report.season.averageEstimatedMinutes} min**\n- Longest estimated night: **${report.season.longestEstimatedMinutes} min**\n\n` +
    `## Night-by-night\n\n| Week | Date | Attend | Teams | Team sizes | Pairings/round | Waves/round | Current 4-board engine | 180s | Est. min |\n|---:|---|---:|---:|---|---:|---:|---|---:|---:|\n${nightRows}\n\n` +
    `## Top 10 individual leg standings\n\n| Rank | Player | Skill target | Nights | W | L | Win % | Sim 3DA | 180s |\n|---:|---|---:|---:|---:|---:|---:|---:|---:|\n${standingRows}\n`;
}

function run() {
  const random = mulberry32(hashSeed(CONFIG.seed));
  const players = createPlayers(random);
  const settings: GameNightSettingsSummary = {
    ...DEFAULT_GAME_NIGHT_SETTINGS,
    teamCreationMode: "automatic",
    teamCountMode: "automatic",
    teamSizeMode: "automatic",
    boardCountMode: "manual",
    boardCount: CONFIG.boardMaximum,
    boardRotationType: "rotate",
    roundCount: CONFIG.roundsPerNight,
    pairingStrategy: "random",
    roundAdvanceMode: "manual",
    roundAdvanceDelaySeconds: 0,
    intermissionAfterRounds: [],
    intermissionDurationMinutes: CONFIG.breakMinutes,
    legsPerMatch: CONFIG.fixedLegsPerMatch,
    startingScore: CONFIG.startingScore,
    finishRule: "double",
    dummyPlayerMode: "none",
  };

  const attendanceTargets = Array.from(
    { length: CONFIG.gameNights },
    () => CONFIG.minAttendance + Math.floor(random() * (CONFIG.maxAttendance - CONFIG.minAttendance + 1)),
  );
  const lowWeek = Math.floor(random() * CONFIG.gameNights);
  let highWeek = Math.floor(random() * CONFIG.gameNights);
  if (highWeek === lowWeek) highWeek = (highWeek + 1) % CONFIG.gameNights;
  attendanceTargets[lowWeek] = CONFIG.minAttendance;
  attendanceTargets[highWeek] = CONFIG.maxAttendance;

  const nights: any[] = [];
  let totalMatches = 0;
  let totalTurns = 0;
  let totalDarts = 0;
  let total180s = 0;
  let matchesTruncatedAtTwo = 0;
  let blockedNights = 0;

  for (let week = 0; week < CONFIG.gameNights; week += 1) {
    const attendance = weightedAttendance(players, attendanceTargets[week], random);
    attendance.forEach((player) => {
      player.attendance += 1;
    });

    const layout = optimizeGameNightLayout(settings, attendance.length);
    const teamCount = layout.settings.targetTeamCount;
    const teams = buildRandomTeams(attendance, teamCount, random);
    const teamSizes = teams.map((team) => team.members.length).sort((a, b) => a - b);
    const boardIds = Array.from({ length: CONFIG.boardMaximum }, (_, index) => `board-${index + 1}`);

    let currentFixtureSchedulable = true;
    let currentFixtureError: string | null = null;
    try {
      generateFixtureRound({
        teamIds: teams.map((team) => team.id),
        boardIds,
        roundNumber: 1,
        strategy: "random",
        boardRotationType: "rotate",
        history: [],
        random,
      });
    } catch (error) {
      currentFixtureSchedulable = false;
      currentFixtureError = error instanceof Error ? error.message : String(error);
      blockedNights += 1;
    }

    const priorOpponents = new Set<string>();
    const byeCounts = new Map<string, number>();
    let nightMatches = 0;
    let nightTurns = 0;
    let nightDarts = 0;
    let night180s = 0;
    let nightSeconds = 0;
    let maxWaves = 1;
    const roundWaveCounts: number[] = [];

    for (let round = 1; round <= CONFIG.roundsPerNight; round += 1) {
      const byePlan = chooseBye(teams, byeCounts, random);
      const pairings = pairTeams(byePlan.playing, priorOpponents, random);
      const waves: Pairing[][] = [];
      for (let index = 0; index < pairings.length; index += CONFIG.boardMaximum) {
        waves.push(pairings.slice(index, index + CONFIG.boardMaximum));
      }
      roundWaveCounts.push(waves.length);
      maxWaves = Math.max(maxWaves, waves.length);

      let roundSeconds = 0;
      for (const wave of waves) {
        const results = wave.map((pairing) => simulateMatch(pairing.a, pairing.b, random));
        nightMatches += results.length;
        nightTurns += results.reduce((sum, result) => sum + result.turns, 0);
        nightDarts += results.reduce((sum, result) => sum + result.darts, 0);
        night180s += results.reduce((sum, result) => sum + result.count180s, 0);
        matchesTruncatedAtTwo += results.filter((result) => result.wouldCurrentBestOfThreeStopAfterTwo).length;
        roundSeconds += Math.max(...results.map((result) => result.seconds), 0);
        if (wave !== waves[waves.length - 1]) roundSeconds += CONFIG.secondsBetweenWaves;
      }
      nightSeconds += roundSeconds;
      if (round < CONFIG.roundsPerNight) nightSeconds += CONFIG.secondsBetweenRounds;
    }

    totalMatches += nightMatches;
    totalTurns += nightTurns;
    totalDarts += nightDarts;
    total180s += night180s;

    nights.push({
      week: week + 1,
      date: dateForWeek(week),
      attendance: attendance.length,
      teamCount,
      teamSizes,
      pairingsPerRound: Math.floor(teamCount / 2),
      wavesPerRound: maxWaves,
      roundWaveCounts,
      currentFixtureSchedulable,
      currentFixtureError,
      matches: nightMatches,
      legs: nightMatches * CONFIG.fixedLegsPerMatch,
      totalTurns: nightTurns,
      total180s: night180s,
      estimatedMinutes: Math.round(nightSeconds / 60),
    });
  }

  const standings = players
    .map((player) => ({
      id: player.id,
      name: player.name,
      skillAverage: player.threeDartAverage,
      attendance: player.attendance,
      legsWon: player.legsWon,
      legsLost: player.legsLost,
      legsPlayed: player.legsWon + player.legsLost,
      legWinPct: Number(
        (player.legsWon + player.legsLost > 0
          ? (player.legsWon / (player.legsWon + player.legsLost)) * 100
          : 0
        ).toFixed(1),
      ),
      actualThreeDartAverage: Number(
        (player.darts > 0 ? (player.points / player.darts) * 3 : 0).toFixed(1),
      ),
      turns: player.turns,
      busts: player.busts,
      checkouts: player.checkouts,
      count100Plus: player.count100Plus,
      count140Plus: player.count140Plus,
      count180s: player.count180s,
      highestTurn: player.highestTurn,
      highestCheckout: player.highestCheckout,
    }))
    .sort(
      (a, b) =>
        b.legsWon - a.legsWon ||
        b.legWinPct - a.legWinPct ||
        b.legsWon - b.legsLost - (a.legsWon - a.legsLost) ||
        a.name.localeCompare(b.name),
    );

  const estimatedMinutes = nights.map((night) => night.estimatedMinutes);
  const attendanceCounts = nights.map((night) => night.attendance);
  const report = {
    config: CONFIG,
    structuralAudit: {
      fixedThreeLegMatchSupported: legsNeededToWin(3) === 3,
      currentLegsNeededToWin: legsNeededToWin(3),
      breakBetweenLegsSupported: false,
      seasonIndividualLegStandingsSupported: false,
      boardCapacity: {
        blockedNights,
        schedulableNights: CONFIG.gameNights - blockedNights,
        blockedWeeks: nights
          .filter((night) => !night.currentFixtureSchedulable)
          .map((night) => ({
            week: night.week,
            date: night.date,
            attendance: night.attendance,
            teamCount: night.teamCount,
            error: night.currentFixtureError,
          })),
      },
      fixedThreeLegImpact: {
        matchesTruncatedAtTwo,
        percentOfMatches: Number(((matchesTruncatedAtTwo / totalMatches) * 100).toFixed(1)),
        missingThirdLegsUnderCurrentBestOfThree: matchesTruncatedAtTwo,
      },
    },
    season: {
      totalMatches,
      totalLegs: totalMatches * CONFIG.fixedLegsPerMatch,
      totalTurns,
      totalDarts,
      total180s,
      minAttendance: Math.min(...attendanceCounts),
      maxAttendance: Math.max(...attendanceCounts),
      averageAttendance: Number((attendanceCounts.reduce((a, b) => a + b, 0) / attendanceCounts.length).toFixed(1)),
      averageEstimatedMinutes: Math.round(estimatedMinutes.reduce((a, b) => a + b, 0) / estimatedMinutes.length),
      longestEstimatedMinutes: Math.max(...estimatedMinutes),
    },
    nights,
    standings,
  };

  fs.writeFileSync("season-simulation-report.json", `${JSON.stringify(report, null, 2)}\n`);
  fs.writeFileSync("season-simulation-report.md", markdownReport(report));

  console.log(markdownReport(report));
  console.log("\nSimulation report written to season-simulation-report.json and season-simulation-report.md");
}

run();
