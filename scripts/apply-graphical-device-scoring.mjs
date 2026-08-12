import fs from "node:fs";

function replaceOnce(source, before, after, label) {
  if (!source.includes(before)) {
    throw new Error(`Could not apply ${label}; expected source was not found.`);
  }
  return source.replace(before, after);
}

function insertBefore(source, marker, addition, label) {
  const index = source.indexOf(marker);
  if (index < 0) throw new Error(`Could not apply ${label}; marker was not found.`);
  return source.slice(0, index) + addition + source.slice(index);
}

// Make the existing graphical entry component safe for async central scoring:
// local scoring still succeeds immediately, while central scoring can keep the
// selected darts visible when a network/server submission fails.
{
  const path = "components/DartEntry.tsx";
  let source = fs.readFileSync(path, "utf8");
  source = replaceOnce(
    source,
    "  submitDartTurn: (darts: DartThrow[]) => void;",
    "  submitDartTurn: (darts: DartThrow[]) => void | boolean | Promise<void | boolean>;",
    "async dart submit contract",
  );
  source = replaceOnce(
    source,
    "  function handleSubmitTurn() {",
    "  async function handleSubmitTurn() {",
    "async dart submit handler",
  );
  source = replaceOnce(
    source,
    "    submitDartTurn(currentDarts);\n    setCurrentDarts([]);",
    "    const submitted = await submitDartTurn(currentDarts);\n    if (submitted === false) return;\n    setCurrentDarts([]);",
    "preserve darts after failed central submit",
  );
  fs.writeFileSync(path, source);
}

// Extend the provider-neutral league match contract with exact per-dart data.
{
  const path = "lib/league/matchContracts.ts";
  let source = fs.readFileSync(path, "utf8");
  source = insertBefore(
    source,
    "export type LeagueMatchTurnSummary = {",
    `export type LeagueMatchDartInput = {
  id: string;
  segment: number | "outer-bull" | "bull" | "miss";
  multiplier: 0 | 1 | 2 | 3;
  score: number;
};

`,
    "league dart input contract",
  );
  source = replaceOnce(
    source,
    "  isCheckout: boolean;\n  createdAt: number;",
    "  isCheckout: boolean;\n  darts: LeagueMatchDartInput[];\n  createdAt: number;",
    "turn summary darts",
  );
  source = replaceOnce(
    source,
    "  checkoutConfirmed?: boolean;\n};",
    "  checkoutConfirmed?: boolean;\n  darts?: LeagueMatchDartInput[];\n};",
    "score request darts",
  );
  fs.writeFileSync(path, source);
}

// Store graphical dart hits relationally so league stats can use them later.
{
  const path = "lib/db/league-match-schema.ts";
  let source = fs.readFileSync(path, "utf8");
  source = insertBefore(
    source,
    "export type LeagueMatchSessionRow = typeof leagueMatchSessions.$inferSelect;",
    `/** Exact darts recorded for a graphical league turn. */
export const leagueMatchDarts = sqliteTable(
  "league_match_darts",
  {
    id: text("id").primaryKey(),
    turnId: text("turn_id")
      .notNull()
      .references(() => leagueMatchTurns.id, { onDelete: "cascade" }),
    dartIndex: integer("dart_index").notNull(),
    segment: text("segment").notNull(),
    multiplier: integer("multiplier").notNull(),
    score: integer("score").notNull(),
    createdAt: integer("created_at").notNull(),
  },
  (table) => [
    uniqueIndex("league_match_darts_turn_index_unique").on(table.turnId, table.dartIndex),
    index("league_match_darts_turn_idx").on(table.turnId),
  ],
);

`,
    "league match dart table",
  );
  source = replaceOnce(
    source,
    "export type LeagueMatchTurnRow = typeof leagueMatchTurns.$inferSelect;",
    "export type LeagueMatchTurnRow = typeof leagueMatchTurns.$inferSelect;\nexport type LeagueMatchDartRow = typeof leagueMatchDarts.$inferSelect;",
    "dart row type",
  );
  fs.writeFileSync(path, source);
}

// Persist, validate and return graphical dart data from the central match state machine.
{
  const path = "lib/db/repositories/leagueMatches.ts";
  let source = fs.readFileSync(path, "utf8");
  source = replaceOnce(
    source,
    'import { and, asc, desc, eq, isNull } from "drizzle-orm";',
    'import { and, asc, desc, eq, inArray, isNull } from "drizzle-orm";',
    "inArray import",
  );
  source = replaceOnce(
    source,
    "  LeagueMatchFinishRule,\n  LeagueMatchMemberSummary,",
    "  LeagueMatchDartInput,\n  LeagueMatchFinishRule,\n  LeagueMatchMemberSummary,",
    "league dart type import",
  );
  source = replaceOnce(
    source,
    'import { leagueMatchSessions, leagueMatchTurns } from "../league-match-schema";',
    'import { leagueMatchDarts, leagueMatchSessions, leagueMatchTurns } from "../league-match-schema";',
    "league dart schema import",
  );

  source = insertBefore(
    source,
    "async function getMatchContext(matchId: string): Promise<MatchContext> {",
    `function validGraphicalDart(dart: LeagueMatchDartInput) {
  if (!dart.id || typeof dart.id !== "string") return false;
  if (![0, 1, 2, 3].includes(dart.multiplier)) return false;
  if (!Number.isInteger(dart.score) || dart.score < 0 || dart.score > 60) return false;

  if (typeof dart.segment === "number") {
    return (
      Number.isInteger(dart.segment) &&
      dart.segment >= 1 &&
      dart.segment <= 20 &&
      [1, 2, 3].includes(dart.multiplier) &&
      dart.score === dart.segment * dart.multiplier
    );
  }
  if (dart.segment === "outer-bull") return dart.multiplier === 1 && dart.score === 25;
  if (dart.segment === "bull") return dart.multiplier === 2 && dart.score === 50;
  return dart.segment === "miss" && dart.multiplier === 0 && dart.score === 0;
}

function validateGraphicalDarts(
  darts: LeagueMatchDartInput[] | undefined,
  scoreEntered: number,
  dartsThrown: 1 | 2 | 3,
) {
  if (darts === undefined) return;
  if (darts.length !== dartsThrown || darts.length < 1 || darts.length > 3) {
    throw new LeagueMatchStateError("Graphical dart count must match darts thrown.");
  }
  if (!darts.every(validGraphicalDart)) {
    throw new LeagueMatchStateError("Graphical dart data contains an invalid board hit.");
  }
  const total = darts.reduce((sum, dart) => sum + dart.score, 0);
  if (total !== scoreEntered) {
    throw new LeagueMatchStateError("Graphical dart total does not match the submitted turn score.");
  }
}

function isDoubleOutDart(dart: LeagueMatchDartInput | undefined) {
  return dart?.segment === "bull" || dart?.multiplier === 2;
}

function parseStoredDartSegment(value: string): LeagueMatchDartInput["segment"] {
  if (value === "outer-bull" || value === "bull" || value === "miss") return value;
  const segment = Number(value);
  if (Number.isInteger(segment) && segment >= 1 && segment <= 20) return segment;
  throw new LeagueMatchStateError("Stored graphical dart contains an invalid segment.");
}

`,
    "graphical dart validation helpers",
  );

  source = replaceOnce(
    source,
    "  const activeTurns = turns.filter((turn) => turn.voidedAt === null);\n  const storedStatus = asStatus(context.session.status);",
    `  const activeTurns = turns.filter((turn) => turn.voidedAt === null);
  const dartRows = activeTurns.length
    ? await getDatabase()
        .select()
        .from(leagueMatchDarts)
        .where(inArray(leagueMatchDarts.turnId, activeTurns.map((turn) => turn.id)))
        .orderBy(asc(leagueMatchDarts.dartIndex))
    : [];
  const dartsByTurn = new Map<string, LeagueMatchDartInput[]>();
  for (const dart of dartRows) {
    const existing = dartsByTurn.get(dart.turnId) ?? [];
    existing.push({
      id: dart.id,
      segment: parseStoredDartSegment(dart.segment),
      multiplier: dart.multiplier as 0 | 1 | 2 | 3,
      score: dart.score,
    });
    dartsByTurn.set(dart.turnId, existing);
  }
  const storedStatus = asStatus(context.session.status);`,
    "load graphical darts",
  );
  source = replaceOnce(
    source,
    "        isCheckout: turn.isCheckout,\n        createdAt: turn.createdAt,",
    "        isCheckout: turn.isCheckout,\n        darts: dartsByTurn.get(turn.id) ?? [],\n        createdAt: turn.createdAt,",
    "return graphical darts",
  );

  source = replaceOnce(
    source,
    `  dartsThrown: 1 | 2 | 3;
  checkoutConfirmed?: boolean;
}): Promise<LeagueMatchSummary> {
  const context = await getMatchContext(input.matchId);`,
    `  dartsThrown: 1 | 2 | 3;
  checkoutConfirmed?: boolean;
  darts?: LeagueMatchDartInput[];
}): Promise<LeagueMatchSummary> {
  const context = await getMatchContext(input.matchId);`,
    "authorized score input darts",
  );
  source = replaceOnce(
    source,
    `  if (![1, 2, 3].includes(input.dartsThrown)) {
    throw new LeagueMatchStateError("Darts thrown must be 1, 2, or 3.");
  }

  const { teamA, teamB, turns } = await loadMatchPieces(input.matchId);`,
    `  if (![1, 2, 3].includes(input.dartsThrown)) {
    throw new LeagueMatchStateError("Darts thrown must be 1, 2, or 3.");
  }
  validateGraphicalDarts(input.darts, input.scoreEntered, input.dartsThrown);

  const { teamA, teamB, turns } = await loadMatchPieces(input.matchId);`,
    "validate graphical darts",
  );
  source = replaceOnce(
    source,
    `  const confirmedCheckout = reachedZero && (finishRule === "straight" || input.checkoutConfirmed === true);
  const isBust = bustForRemainder || (reachedZero && !confirmedCheckout);`,
    `  const graphicalCheckoutConfirmed = input.darts?.length
    ? isDoubleOutDart(input.darts[input.darts.length - 1])
    : input.checkoutConfirmed === true;
  const confirmedCheckout = reachedZero && (finishRule === "straight" || graphicalCheckoutConfirmed);
  const isBust = bustForRemainder || (reachedZero && !confirmedCheckout);`,
    "derive graphical checkout",
  );

  const oldInsert = `  await getDatabase().insert(leagueMatchTurns).values({
    id: input.turnId,
    matchSessionId: input.matchId,
    turnIndex,
    legNumber: state.currentLegNumber,
    teamId: currentTeam.id,
    teamMemberId: currentMember.id,
    leaguePlayerId: currentMember.leaguePlayerId,
    displayName: currentMember.displayName,
    isDummy: currentMember.isDummy,
    scoreEntered: input.scoreEntered,
    scoreBefore,
    scoreAfter,
    dartsThrown: input.dartsThrown,
    isBust,
    isCheckout,
    checkoutConfirmed: input.checkoutConfirmed === true,
    voidedAt: null,
    createdAt: now,
  });`;
  const newInsert = `  const database = getDatabase();
  await database.transaction(async (transaction) => {
    await transaction.insert(leagueMatchTurns).values({
      id: input.turnId,
      matchSessionId: input.matchId,
      turnIndex,
      legNumber: state.currentLegNumber,
      teamId: currentTeam.id,
      teamMemberId: currentMember.id,
      leaguePlayerId: currentMember.leaguePlayerId,
      displayName: currentMember.displayName,
      isDummy: currentMember.isDummy,
      scoreEntered: input.scoreEntered,
      scoreBefore,
      scoreAfter,
      dartsThrown: input.dartsThrown,
      isBust,
      isCheckout,
      checkoutConfirmed: graphicalCheckoutConfirmed,
      voidedAt: null,
      createdAt: now,
    });
    if (input.darts?.length) {
      await transaction.insert(leagueMatchDarts).values(
        input.darts.map((dart, dartIndex) => ({
          id: dart.id,
          turnId: input.turnId,
          dartIndex,
          segment: String(dart.segment),
          multiplier: dart.multiplier,
          score: dart.score,
          createdAt: now,
        })),
      );
    }
  });`;
  source = replaceOnce(source, oldInsert, newInsert, "persist graphical darts transactionally");

  source = replaceOnce(
    source,
    `  dartsThrown: 1 | 2 | 3;
  checkoutConfirmed?: boolean;
}): Promise<LeagueMatchSummary> {
  const context = await getMatchContext(input.matchId);
  await requireLeagueAdmin(context.leagueId, input.userId);`,
    `  dartsThrown: 1 | 2 | 3;
  checkoutConfirmed?: boolean;
  darts?: LeagueMatchDartInput[];
}): Promise<LeagueMatchSummary> {
  const context = await getMatchContext(input.matchId);
  await requireLeagueAdmin(context.leagueId, input.userId);`,
    "human score wrapper darts",
  );
  source = replaceOnce(
    source,
    `    dartsThrown: input.dartsThrown,
    checkoutConfirmed: input.checkoutConfirmed,
  });`,
    `    dartsThrown: input.dartsThrown,
    checkoutConfirmed: input.checkoutConfirmed,
    darts: input.darts,
  });`,
    "pass human graphical darts",
  );
  fs.writeFileSync(path, source);
}

// Pass graphical darts through both human and registered-device HTTP paths.
for (const path of ["app/api/league-matches/route.ts", "app/api/board-device/route.ts"]) {
  let source = fs.readFileSync(path, "utf8");
  source = replaceOnce(
    source,
    "          checkoutConfirmed: input.checkoutConfirmed,\n        }),",
    "          checkoutConfirmed: input.checkoutConfirmed,\n          darts: input.darts,\n        }),",
    `${path} graphical darts`,
  );
  fs.writeFileSync(path, source);
}

{
  const path = "lib/db/repositories/boardDevices.ts";
  let source = fs.readFileSync(path, "utf8");
  source = replaceOnce(
    source,
    'import type { LeagueMatchSummary } from "@/lib/league/matchContracts";',
    'import type { LeagueMatchDartInput, LeagueMatchSummary } from "@/lib/league/matchContracts";',
    "device graphical dart type import",
  );
  source = replaceOnce(
    source,
    `  dartsThrown: 1 | 2 | 3;
  checkoutConfirmed?: boolean;
}): Promise<LeagueMatchSummary> {
  await requireAssignedMatch(input.deviceKey, input.matchId);`,
    `  dartsThrown: 1 | 2 | 3;
  checkoutConfirmed?: boolean;
  darts?: LeagueMatchDartInput[];
}): Promise<LeagueMatchSummary> {
  await requireAssignedMatch(input.deviceKey, input.matchId);`,
    "device submit darts signature",
  );
  source = replaceOnce(
    source,
    `    dartsThrown: input.dartsThrown,
    checkoutConfirmed: input.checkoutConfirmed,
  });`,
    `    dartsThrown: input.dartsThrown,
    checkoutConfirmed: input.checkoutConfirmed,
    darts: input.darts,
  });`,
    "pass device graphical darts",
  );
  fs.writeFileSync(path, source);
}

// Reuse the exact existing graphical DartEntry interface inside the central scorer.
{
  const path = "components/LeagueMatchScorer.tsx";
  let source = fs.readFileSync(path, "utf8");
  source = replaceOnce(
    source,
    'import { authClient } from "@/lib/auth/client";',
    'import { DartEntry } from "@/components/DartEntry";\nimport { authClient } from "@/lib/auth/client";',
    "DartEntry import",
  );
  source = replaceOnce(
    source,
    'import { validateTurnScore } from "@/lib/scoring";',
    'import { validateTurnScore, type DartThrow, type Turn } from "@/lib/scoring";',
    "graphical scoring types",
  );
  source = insertBefore(
    source,
    "type PendingCheckout = {",
    'type CentralInputMode = "graphical" | "total";\n\n',
    "central input mode type",
  );
  source = replaceOnce(
    source,
    '  const [match, setMatch] = useState<LeagueMatchSummary | null>(null);',
    '  const [match, setMatch] = useState<LeagueMatchSummary | null>(null);\n  const [inputMode, setInputMode] = useState<CentralInputMode>(() => authMode === "device" ? "graphical" : "total");',
    "central input mode state",
  );
  source = replaceOnce(
    source,
    `  async function sendScore(
    scoreEntered: number,
    darts: 1 | 2 | 3,
    checkoutConfirmed = false,
  ) {`,
    `  async function sendScore(
    scoreEntered: number,
    darts: 1 | 2 | 3,
    checkoutConfirmed = false,
    graphicalDarts?: DartThrow[],
  ) {`,
    "send score graphical args",
  );
  source = replaceOnce(
    source,
    `      dartsThrown: darts,
      checkoutConfirmed,
    });`,
    `      dartsThrown: darts,
      checkoutConfirmed,
      darts: graphicalDarts,
    });`,
    "send exact darts",
  );
  source = replaceOnce(
    source,
    `        setStatusMessage(winner ? \`${winner} wins the board match.\` : "Board match completed as a tie.");
      }
    }
  }

  async function submitScore`,
    `        setStatusMessage(winner ? \`${winner} wins the board match.\` : "Board match completed as a tie.");
      }
    }
    return updated;
  }

  function graphicalCheckoutConfirmed(darts: DartThrow[]) {
    const lastDart = darts[darts.length - 1];
    return lastDart?.segment === "bull" || lastDart?.multiplier === 2;
  }

  async function submitGraphicalTurn(darts: DartThrow[]) {
    if (!match || !currentTeam || darts.length < 1 || darts.length > 3) return false;
    const scoreEntered = darts.reduce((sum, dart) => sum + dart.score, 0);
    const updated = await sendScore(
      scoreEntered,
      darts.length as 1 | 2 | 3,
      graphicalCheckoutConfirmed(darts),
      darts,
    );
    return Boolean(updated);
  }

  async function submitScore`,
    "graphical submit adapter",
  );

  // Add central-turn adapters after currentMember so DartEntry gets the same
  // scorecard/last-turn context as the local scorer.
  source = replaceOnce(
    source,
    `  const currentMember = useMemo(
    () => currentTeam?.members.find((member) => member.id === match?.currentMemberId) ?? null,
    [currentTeam, match?.currentMemberId],
  );

  async function mutate`,
    `  const currentMember = useMemo(
    () => currentTeam?.members.find((member) => member.id === match?.currentMemberId) ?? null,
    [currentTeam, match?.currentMemberId],
  );

  const graphicalLastTurn = useMemo<Turn | null>(() => {
    const turn = match?.turns[0];
    if (!turn || !match) return null;
    const team = turn.teamId === match.teamA.id ? match.teamA : match.teamB;
    return {
      id: turn.id,
      playerId: turn.teamId,
      playerName: team.name,
      throwerId: turn.teamMemberId ?? undefined,
      throwerName: turn.displayName,
      isDummy: turn.isDummy,
      darts: turn.darts,
      scoreEntered: turn.scoreEntered,
      scoreBefore: turn.scoreBefore,
      scoreAfter: turn.scoreAfter,
      dartsThrown: turn.dartsThrown as 1 | 2 | 3,
      isBust: turn.isBust,
      isCheckout: turn.isCheckout,
      finishRule: match.finishRule === "double" ? "double_out" : "straight_out",
    };
  }, [match]);

  const graphicalScoreCards = useMemo(() => {
    if (!match) return [];
    return [match.teamA, match.teamB].map((team) => ({
      id: team.id,
      name: team.name,
      throwerName:
        team.id === match.currentTeamId
          ? match.currentMemberName ?? team.name
          : team.name,
      score: team.score,
      isCurrent: team.id === match.currentTeamId,
    }));
  }, [match]);

  async function mutate`,
    "graphical DartEntry adapters",
  );

  const oldInput = `          {currentMember.isDummy ? (
            <div className="mt-5">
              <p className="text-sm text-[var(--color-text-muted)]">This slot is a dummy player. The configured dummy turn is {match.dummyScore}.</p>
              <button type="button" disabled={working} onClick={() => void sendScore(match.dummyScore, 3)} className="mt-3 rounded-xl bg-[var(--color-primary)] px-5 py-3 font-bold text-white disabled:opacity-50">
                Apply Dummy Score ({match.dummyScore})
              </button>
            </div>
          ) : (
            <form onSubmit={submitScore} className="mt-5">
              <div className="grid gap-3 sm:grid-cols-[1fr_180px_auto]">
                <input
                  inputMode="numeric"
                  pattern="[0-9]*"
                  value={scoreInput}
                  onChange={(event) => setScoreInput(event.target.value)}
                  placeholder="Turn score"
                  className="rounded-xl border border-[var(--color-panel-border)] bg-[var(--color-panel-soft)] px-4 py-3 text-2xl font-bold"
                />
                <select value={dartsThrown} onChange={(event) => setDartsThrown(Number(event.target.value) as 1 | 2 | 3)} className="rounded-xl border border-[var(--color-panel-border)] bg-[var(--color-panel-soft)] px-3 py-3">
                  <option value={3}>3 darts</option>
                  <option value={2}>2 darts</option>
                  <option value={1}>1 dart</option>
                </select>
                <button disabled={working} className="rounded-xl bg-[var(--color-primary)] px-6 py-3 font-bold text-white disabled:opacity-50">Submit</button>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {quickScores.map((score) => (
                  <button key={score} type="button" onClick={() => setScoreInput(String(score))} className="rounded-lg border border-[var(--color-panel-border)] bg-[var(--color-panel-soft)] px-3 py-2 text-sm font-bold">
                    {score}
                  </button>
                ))}
              </div>
            </form>
          )}

          {pendingCheckout && (`;
  const newInput = `          <div className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[var(--color-panel-border)] bg-[var(--color-panel-soft)] p-2">
            <div>
              <div className="text-xs font-bold uppercase tracking-wide text-[var(--color-text-muted)]">Scoring input</div>
              <div className="text-sm font-bold">{inputMode === "graphical" ? "Graphical dartboard" : "Turn total"}</div>
            </div>
            <div className="grid grid-cols-2 rounded-lg border border-[var(--color-panel-border)] bg-[var(--color-panel)] p-1">
              <button type="button" onClick={() => setInputMode("graphical")} className={\`rounded-md px-3 py-2 text-sm font-bold \${inputMode === "graphical" ? "bg-[var(--color-primary)] text-white" : "text-[var(--color-text-muted)]"}\`}>Darts</button>
              <button type="button" onClick={() => setInputMode("total")} className={\`rounded-md px-3 py-2 text-sm font-bold \${inputMode === "total" ? "bg-[var(--color-primary)] text-white" : "text-[var(--color-text-muted)]"}\`}>Turn</button>
            </div>
          </div>

          {inputMode === "graphical" ? (
            <div className="mt-4">
              <DartEntry
                message={\`${currentMember.displayName} to throw\`}
                compact={deviceMode}
                currentScore={currentTeam.score}
                currentSideName={currentTeam.name}
                currentThrowerName={currentMember.displayName}
                currentLegNumber={match.currentLegNumber}
                finishRule={match.finishRule === "double" ? "double_out" : "straight_out"}
                fullscreenScoreCards={graphicalScoreCards}
                lastTurn={graphicalLastTurn}
                submitDartTurn={submitGraphicalTurn}
                undoLastTurn={() => void mutate({ action: "undo", matchId }, "Last turn undone. Match state recalculated from central history.")}
                startNextLeg={() => undefined}
                replayMatch={() => undefined}
                newGameSetup={() => undefined}
                viewFinishedGame={() => undefined}
                isLegComplete={false}
                isMatchComplete={false}
                isCurrentThrowerDummy={currentMember.isDummy}
                dummyScore={match.dummyScore}
                submitDummyScore={() => void sendScore(match.dummyScore, 3)}
              />
            </div>
          ) : currentMember.isDummy ? (
            <div className="mt-5">
              <p className="text-sm text-[var(--color-text-muted)]">This slot is a dummy player. The configured dummy turn is {match.dummyScore}.</p>
              <button type="button" disabled={working} onClick={() => void sendScore(match.dummyScore, 3)} className="mt-3 rounded-xl bg-[var(--color-primary)] px-5 py-3 font-bold text-white disabled:opacity-50">
                Apply Dummy Score ({match.dummyScore})
              </button>
            </div>
          ) : (
            <form onSubmit={submitScore} className="mt-5">
              <div className="grid gap-3 sm:grid-cols-[1fr_180px_auto]">
                <input
                  inputMode="numeric"
                  pattern="[0-9]*"
                  value={scoreInput}
                  onChange={(event) => setScoreInput(event.target.value)}
                  placeholder="Turn score"
                  className="rounded-xl border border-[var(--color-panel-border)] bg-[var(--color-panel-soft)] px-4 py-3 text-2xl font-bold"
                />
                <select value={dartsThrown} onChange={(event) => setDartsThrown(Number(event.target.value) as 1 | 2 | 3)} className="rounded-xl border border-[var(--color-panel-border)] bg-[var(--color-panel-soft)] px-3 py-3">
                  <option value={3}>3 darts</option>
                  <option value={2}>2 darts</option>
                  <option value={1}>1 dart</option>
                </select>
                <button disabled={working} className="rounded-xl bg-[var(--color-primary)] px-6 py-3 font-bold text-white disabled:opacity-50">Submit</button>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {quickScores.map((score) => (
                  <button key={score} type="button" onClick={() => setScoreInput(String(score))} className="rounded-lg border border-[var(--color-panel-border)] bg-[var(--color-panel-soft)] px-3 py-2 text-sm font-bold">
                    {score}
                  </button>
                ))}
              </div>
            </form>
          )}

          {inputMode === "total" && pendingCheckout && (`;
  source = replaceOnce(source, oldInput, newInput, "central graphical scoring UI");
  fs.writeFileSync(path, source);
}

// Exercise exact dart persistence through the registered board device contract.
{
  const path = "scripts/board-device-contract-test.ts";
  let source = fs.readFileSync(path, "utf8");
  source = replaceOnce(
    source,
    `    scoreEntered: 60,
    dartsThrown: 3,
  });
  assert.equal(match.turns.length, 1);
  assert.equal(match.turns[0].scoreEntered, 60);`,
    `    scoreEntered: 60,
    dartsThrown: 3,
    darts: [
      { id: \`device-dart-1-\${suffix}\`, segment: 20, multiplier: 1, score: 20 },
      { id: \`device-dart-2-\${suffix}\`, segment: 20, multiplier: 1, score: 20 },
      { id: \`device-dart-3-\${suffix}\`, segment: 20, multiplier: 1, score: 20 },
    ],
  });
  assert.equal(match.turns.length, 1);
  assert.equal(match.turns[0].scoreEntered, 60);
  assert.deepEqual(match.turns[0].darts.map((dart) => dart.score), [20, 20, 20]);
  assert.deepEqual(match.turns[0].darts.map((dart) => dart.segment), [20, 20, 20]);`,
    "board device graphical dart assertions",
  );
  source = replaceOnce(
    source,
    `    scoreEntered: 60,
    dartsThrown: 3,
  });
  assert.equal(match.turns.length, 1, "Retrying the same device turn ID must be idempotent.");`,
    `    scoreEntered: 60,
    dartsThrown: 3,
    darts: [
      { id: \`device-dart-1-\${suffix}\`, segment: 20, multiplier: 1, score: 20 },
      { id: \`device-dart-2-\${suffix}\`, segment: 20, multiplier: 1, score: 20 },
      { id: \`device-dart-3-\${suffix}\`, segment: 20, multiplier: 1, score: 20 },
    ],
  });
  assert.equal(match.turns.length, 1, "Retrying the same device turn ID must be idempotent.");`,
    "board device graphical retry",
  );
  fs.writeFileSync(path, source);
}
