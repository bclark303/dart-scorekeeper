import fs from "node:fs";

function replaceOnce(source, before, after, label) {
  if (!source.includes(before)) {
    throw new Error(`Could not apply ${label}; expected source was not found.`);
  }
  return source.replace(before, after);
}

// Split human authorization from the already-tested match state machine so a
// registered device can use the same scoring implementation after device-level
// authorization has been verified in boardDevices.ts.
{
  const path = "lib/db/repositories/leagueMatches.ts";
  let source = fs.readFileSync(path, "utf8");

  source = replaceOnce(
    source,
    "export async function getLeagueMatchForUser(\n",
    "export async function getLeagueMatchAfterAuthorization(\n  matchId: string,\n): Promise<LeagueMatchSummary> {\n  return buildLeagueMatchSummary(matchId);\n}\n\nexport async function getLeagueMatchForUser(\n",
    "authorized match read",
  );

  const startStart = source.indexOf("export async function startLeagueMatchForUser(");
  const startEnd = source.indexOf("export async function submitLeagueMatchTurnForUser(");
  if (startStart < 0 || startEnd < 0 || startEnd <= startStart) {
    throw new Error("Could not isolate startLeagueMatchForUser.");
  }
  const startReplacement = `export async function startLeagueMatchAfterAuthorization(
  matchId: string,
): Promise<LeagueMatchSummary> {
  const context = await getMatchContext(matchId);
  if (context.gameNightStatus !== "active") {
    throw new LeagueMatchStateError("Start the game night before starting a board match.");
  }
  if (context.session.status === "completed") {
    throw new LeagueMatchStateError("This board match is already complete.");
  }
  if (context.session.status === "scheduled") {
    const now = Date.now();
    await getDatabase()
      .update(leagueMatchSessions)
      .set({ status: "active", startedAt: now, updatedAt: now })
      .where(eq(leagueMatchSessions.id, matchId));
    await getDatabase()
      .update(gameNightBoardPairings)
      .set({ status: "active", updatedAt: now })
      .where(eq(gameNightBoardPairings.id, context.session.pairingId));
  }
  return buildLeagueMatchSummary(matchId);
}

export async function startLeagueMatchForUser(
  matchId: string,
  userId: string,
): Promise<LeagueMatchSummary> {
  const context = await getMatchContext(matchId);
  await requireLeagueAdmin(context.leagueId, userId);
  return startLeagueMatchAfterAuthorization(matchId);
}

`;
  source = source.slice(0, startStart) + startReplacement + source.slice(startEnd);

  source = replaceOnce(
    source,
    `export async function submitLeagueMatchTurnForUser(input: {
  matchId: string;
  userId: string;
  turnId: string;
  scoreEntered: number;
  dartsThrown: 1 | 2 | 3;
  checkoutConfirmed?: boolean;
}): Promise<LeagueMatchSummary> {
  const context = await getMatchContext(input.matchId);
  await requireLeagueAdmin(context.leagueId, input.userId);
`,
    `export async function submitLeagueMatchTurnAfterAuthorization(input: {
  matchId: string;
  turnId: string;
  scoreEntered: number;
  dartsThrown: 1 | 2 | 3;
  checkoutConfirmed?: boolean;
}): Promise<LeagueMatchSummary> {
  const context = await getMatchContext(input.matchId);
`,
    "authorized turn submission",
  );

  const undoMarker = "export async function undoLastLeagueMatchTurnForUser(\n";
  const undoIndex = source.indexOf(undoMarker);
  if (undoIndex < 0) throw new Error("Could not find undo wrapper marker.");
  const submitWrapper = `export async function submitLeagueMatchTurnForUser(input: {
  matchId: string;
  userId: string;
  turnId: string;
  scoreEntered: number;
  dartsThrown: 1 | 2 | 3;
  checkoutConfirmed?: boolean;
}): Promise<LeagueMatchSummary> {
  const context = await getMatchContext(input.matchId);
  await requireLeagueAdmin(context.leagueId, input.userId);
  return submitLeagueMatchTurnAfterAuthorization({
    matchId: input.matchId,
    turnId: input.turnId,
    scoreEntered: input.scoreEntered,
    dartsThrown: input.dartsThrown,
    checkoutConfirmed: input.checkoutConfirmed,
  });
}

`;
  source = source.slice(0, undoIndex) + submitWrapper + source.slice(undoIndex);

  source = replaceOnce(
    source,
    `export async function undoLastLeagueMatchTurnForUser(
  matchId: string,
  userId: string,
): Promise<LeagueMatchSummary> {
  const context = await getMatchContext(matchId);
  await requireLeagueAdmin(context.leagueId, userId);
`,
    `export async function undoLastLeagueMatchTurnAfterAuthorization(
  matchId: string,
): Promise<LeagueMatchSummary> {
  const context = await getMatchContext(matchId);
`,
    "authorized undo",
  );

  source += `

export async function undoLastLeagueMatchTurnForUser(
  matchId: string,
  userId: string,
): Promise<LeagueMatchSummary> {
  const context = await getMatchContext(matchId);
  await requireLeagueAdmin(context.leagueId, userId);
  return undoLastLeagueMatchTurnAfterAuthorization(matchId);
}
`;

  fs.writeFileSync(path, source);
}

// Reuse the same scorer UI for account-authenticated administrators and for a
// registered board device. Device mode sends its Bearer key to /api/board-device
// and never requires a signed-in human session.
{
  const path = "components/LeagueMatchScorer.tsx";
  let source = fs.readFileSync(path, "utf8");

  source = replaceOnce(
    source,
    "export function LeagueMatchScorer({ matchId }: { matchId: string }) {\n  const { data: session, isPending: sessionPending } = authClient.useSession();",
    `type LeagueMatchScorerProps = {
  matchId: string;
  authMode?: "account" | "device";
  deviceKey?: string;
  backHref?: string;
  backLabel?: string;
};

export function LeagueMatchScorer({
  matchId,
  authMode = "account",
  deviceKey,
  backHref = "/game-nights",
  backLabel = "← Back to Game Nights",
}: LeagueMatchScorerProps) {
  const { data: session, isPending: sessionPending } = authClient.useSession();
  const deviceMode = authMode === "device";
  const accessReady = deviceMode ? Boolean(deviceKey) : Boolean(session?.user);
  const apiUrl = deviceMode ? "/api/board-device" : "/api/league-matches";`,
    "scorer transport props",
  );

  source = replaceOnce(
    source,
    `      const response = await fetch(\`/api/league-matches?matchId=\${encodeURIComponent(matchId)}\`, {
        cache: "no-store",
      });`,
    `      const response = await fetch(\`${apiUrl}?matchId=\${encodeURIComponent(matchId)}\`, {
        cache: "no-store",
        headers: deviceMode && deviceKey ? { Authorization: \`Bearer \${deviceKey}\` } : undefined,
      });`,
    "device match read",
  );
  source = replaceOnce(source, "  }, [matchId]);", "  }, [apiUrl, deviceKey, deviceMode, matchId]);", "load dependencies");
  source = replaceOnce(source, "    if (!session?.user) return;", "    if (!accessReady) return;", "access-ready poll gate");
  source = replaceOnce(source, "  }, [loadMatch, session?.user]);", "  }, [accessReady, loadMatch]);", "poll dependencies");

  source = replaceOnce(
    source,
    `      const response = await fetch("/api/league-matches", {
        method: "POST",
        headers: { "Content-Type": "application/json" },`,
    `      const response = await fetch(apiUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(deviceMode && deviceKey ? { Authorization: \`Bearer \${deviceKey}\` } : {}),
        },`,
    "device mutation transport",
  );

  source = replaceOnce(source, "  if (sessionPending) {", "  if (!deviceMode && sessionPending) {", "account loading gate");
  source = replaceOnce(source, "  if (!session?.user) {", "  if (!deviceMode && !session?.user) {", "account sign-in gate");
  source = source.replaceAll(
    '<Link href="/game-nights" className="text-sm font-semibold text-[var(--color-primary)]">← Back to Game Nights</Link>',
    '<Link href={backHref} className="text-sm font-semibold text-[var(--color-primary)]">{backLabel}</Link>',
  );
  source = source.replace(
    "Return to Game Nights and press Start Game Night first.",
    '{deviceMode ? "The game-night coordinator must press Start Game Night before this board can begin." : "Return to Game Nights and press Start Game Night first."}',
  );
  source = source.replace(
    "Turns are stored in the league database with idempotent IDs so a future board client can safely retry submissions.",
    "Turns are stored centrally with idempotent IDs so this device can safely retry a submission after a network interruption.",
  );

  fs.writeFileSync(path, source);
}

// Surface device administration from the game-night control page.
{
  const path = "app/game-nights/page.tsx";
  let source = fs.readFileSync(path, "utf8");
  source = replaceOnce(
    source,
    '<Link href="/league-roster" className="rounded-xl border border-[var(--color-panel-border)] px-4 py-2 text-sm font-bold">Players & Rosters</Link>',
    '<Link href="/league-roster" className="rounded-xl border border-[var(--color-panel-border)] px-4 py-2 text-sm font-bold">Players & Rosters</Link>\n          <Link href="/league-devices" className="rounded-xl border border-[var(--color-panel-border)] px-4 py-2 text-sm font-bold">Board Devices</Link>',
    "game-night board device nav",
  );
  fs.writeFileSync(path, source);
}
