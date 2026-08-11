import fs from "node:fs";

const path = "lib/db/repositories/gameNights.ts";
let source = fs.readFileSync(path, "utf8");

function replaceOnce(before, after, label) {
  if (!source.includes(before)) {
    throw new Error(`Could not apply ${label}; expected source was not found.`);
  }
  source = source.replace(before, after);
}

replaceOnce(
  'import { leaguePlayers, seasonRosterEntries } from "../league-schema";\n',
  'import { leaguePlayers, seasonRosterEntries } from "../league-schema";\nimport { leagueMatchSessions } from "../league-match-schema";\n',
  "league match schema import",
);

replaceOnce(
  '    dummyPlayerMode: asDummyPlayerMode(row.dummyPlayerMode),\n    boardCount: row.boardCount,',
  '    dummyPlayerMode: asDummyPlayerMode(row.dummyPlayerMode),\n    dummyScore: row.dummyScore,\n    boardCount: row.boardCount,',
  "dummy score mapping",
);

replaceOnce(
  '  const pairedTeamIds = new Set(pairingRows.flatMap((row) => [row.teamAId, row.teamBId]));\n\n  return {',
  '  const pairedTeamIds = new Set(pairingRows.flatMap((row) => [row.teamAId, row.teamBId]));\n  const matchSessionRows = await getDatabase()\n    .select({\n      id: leagueMatchSessions.id,\n      pairingId: leagueMatchSessions.pairingId,\n      status: leagueMatchSessions.status,\n      winnerTeamId: leagueMatchSessions.winnerTeamId,\n    })\n    .from(leagueMatchSessions)\n    .where(eq(leagueMatchSessions.gameNightId, gameNightId));\n  const matchSessionByPairing = new Map(\n    matchSessionRows.map((session) => [session.pairingId, session]),\n  );\n\n  return {',
  "match session lookup",
);

replaceOnce(
  '      status:\n        pairing.status === "active" || pairing.status === "completed"\n          ? pairing.status\n          : "scheduled",\n    })),',
  '      status:\n        pairing.status === "active" || pairing.status === "completed"\n          ? pairing.status\n          : "scheduled",\n      matchSessionId: matchSessionByPairing.get(pairing.id)?.id ?? null,\n      matchStatus:\n        matchSessionByPairing.get(pairing.id)?.status === "active" ||\n        matchSessionByPairing.get(pairing.id)?.status === "completed"\n          ? matchSessionByPairing.get(pairing.id)?.status ?? null\n          : matchSessionByPairing.has(pairing.id)\n            ? "scheduled"\n            : null,\n      winnerTeamId: matchSessionByPairing.get(pairing.id)?.winnerTeamId ?? null,\n    })),',
  "pairing match summary",
);

const oldPairingInsert = `  if (pairCount) {
    await getDatabase().insert(gameNightBoardPairings).values(
      Array.from({ length: pairCount }, (_, index) => ({
        id: crypto.randomUUID(),
        gameNightId,
        boardId: refreshedBoards[index].id,
        roundNumber: 1,
        teamAId: teams[index * 2].id,
        teamBId: teams[index * 2 + 1].id,
        status: "scheduled",
        createdAt: now,
        updatedAt: now,
      })),
    );
  }
`;

const newPairingInsert = `  if (pairCount) {
    const pairings = Array.from({ length: pairCount }, (_, index) => ({
      id: crypto.randomUUID(),
      gameNightId,
      boardId: refreshedBoards[index].id,
      roundNumber: 1,
      teamAId: teams[index * 2].id,
      teamBId: teams[index * 2 + 1].id,
      status: "scheduled",
      createdAt: now,
      updatedAt: now,
    }));
    await getDatabase().insert(gameNightBoardPairings).values(pairings);
    await getDatabase().insert(leagueMatchSessions).values(
      pairings.map((pairing) => ({
        id: crypto.randomUUID(),
        pairingId: pairing.id,
        gameNightId,
        boardId: pairing.boardId,
        teamAId: pairing.teamAId,
        teamBId: pairing.teamBId,
        status: "scheduled",
        startingScore: settings.startingScore,
        finishRule: settings.finishRule,
        legsPerMatch: settings.legsPerMatch,
        dummyScore: settings.dummyScore,
        winnerTeamId: null,
        startedAt: null,
        completedAt: null,
        createdAt: now,
        updatedAt: now,
      })),
    );
  }
`;

replaceOnce(oldPairingInsert, newPairingInsert, "pairing session creation");

fs.writeFileSync(path, source);
