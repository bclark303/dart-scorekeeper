import fs from "node:fs";

function read(path) {
  return fs.readFileSync(path, "utf8");
}

function write(path, content) {
  fs.writeFileSync(path, content);
}

function replaceOnce(content, before, after, path) {
  if (!content.includes(before)) {
    throw new Error(`Expected source pattern was not found in ${path}: ${before.slice(0, 140)}`);
  }
  return content.replace(before, after);
}

function replaceRegex(content, regex, after, path) {
  if (!regex.test(content)) {
    throw new Error(`Expected regex was not found in ${path}: ${regex}`);
  }
  return content.replace(regex, after);
}

// 1. Server-side optimistic concurrency fingerprint for queued turns.
{
  const path = "lib/db/repositories/leagueMatches.ts";
  let content = read(path);
  content = replaceOnce(
    content,
    "  LeagueMatchFinishRule,\n",
    "  LeagueMatchExpectedState,\n  LeagueMatchFinishRule,\n",
    path,
  );

  content = replaceOnce(
    content,
    "  darts?: LeagueMatchDartInput[];\n}): Promise<LeagueMatchSummary> {\n  const context = await getMatchContext(input.matchId);",
    "  darts?: LeagueMatchDartInput[];\n  expectedState?: LeagueMatchExpectedState;\n}): Promise<LeagueMatchSummary> {\n  const context = await getMatchContext(input.matchId);",
    path,
  );

  content = replaceOnce(
    content,
    `  const scoreBefore =\n    state.currentTeamId === teamA.id\n      ? state.teamAScore\n      : state.teamBScore;\n\n  let evaluation;`,
    `  const scoreBefore =\n    state.currentTeamId === teamA.id\n      ? state.teamAScore\n      : state.teamBScore;\n\n  if (input.expectedState) {\n    const activeTurns = turns.filter((turn) => turn.voidedAt === null);\n    const lastActiveTurnId = activeTurns.length\n      ? activeTurns[activeTurns.length - 1].id\n      : null;\n    const expected = input.expectedState;\n    const stateChanged =\n      expected.activeTurnCount !== activeTurns.length ||\n      expected.lastTurnId !== lastActiveTurnId ||\n      expected.currentLegNumber !== state.currentLegNumber ||\n      expected.currentTeamId !== state.currentTeamId ||\n      expected.currentMemberId !== state.currentMemberId ||\n      expected.scoreBefore !== scoreBefore;\n\n    if (stateChanged) {\n      throw new LeagueMatchStateError(\n        \"Offline sync conflict: central match state changed before this queued turn could be applied.\",\n      );\n    }\n  }\n\n  let evaluation;`,
    path,
  );

  content = replaceOnce(
    content,
    `  darts?: LeagueMatchDartInput[];\n}): Promise<LeagueMatchSummary> {\n  const context = await getMatchContext(input.matchId);\n  await requireLeagueAdmin(context.leagueId, input.userId);`,
    `  darts?: LeagueMatchDartInput[];\n  expectedState?: LeagueMatchExpectedState;\n}): Promise<LeagueMatchSummary> {\n  const context = await getMatchContext(input.matchId);\n  await requireLeagueAdmin(context.leagueId, input.userId);`,
    path,
  );

  content = replaceOnce(
    content,
    `    checkoutConfirmed: input.checkoutConfirmed,\n    darts: input.darts,\n  });`,
    `    checkoutConfirmed: input.checkoutConfirmed,\n    darts: input.darts,\n    expectedState: input.expectedState,\n  });`,
    path,
  );
  write(path, content);
}

// 2. Board-device integration contract proves stale expected state is rejected,
// while retrying an already accepted turn ID remains idempotent.
{
  const path = "scripts/board-device-contract-test.ts";
  let content = read(path);
  content = replaceOnce(
    content,
    "  BoardDeviceCredentialError,\n",
    "  BoardDeviceCredentialError,\n  LeagueMatchStateError,\n",
    path,
  );
  content = replaceOnce(
    content,
    'import { DEFAULT_GAME_NIGHT_SETTINGS } from "@/lib/league/gameNightContracts";',
    'import { DEFAULT_GAME_NIGHT_SETTINGS } from "@/lib/league/gameNightContracts";\nimport { expectedStateForLeagueMatch } from "@/lib/league/offlineMatchReplica";',
    path,
  );
  content = replaceOnce(
    content,
    `  assert.equal(match.status, "active");\n\n  const turnId = \`device-turn-\${suffix}\`;`,
    `  assert.equal(match.status, "active");\n  const expectedBeforeFirstTurn = expectedStateForLeagueMatch(match);\n\n  const turnId = \`device-turn-\${suffix}\`;`,
    path,
  );
  content = content.replace(
    `    darts: [\n      {\n        id: \`device-dart-1-\${suffix}\`,`,
    `    expectedState: expectedBeforeFirstTurn,\n    darts: [\n      {\n        id: \`device-dart-1-\${suffix}\`,`,
  );
  // Add expected state to the idempotent retry as well. Existing-ID handling
  // must happen before concurrency checking so a lost HTTP response is safe.
  const retryMarker = `  match = await submitBoardDeviceTurnForCredential({\n    deviceKey: registered.deviceKey,\n    matchId,\n    turnId,\n    scoreEntered: 60,\n    dartsThrown: 3,`;
  const firstRetryIndex = content.indexOf(retryMarker, content.indexOf(retryMarker) + 1);
  if (firstRetryIndex < 0) throw new Error(`Could not locate idempotent retry in ${path}`);
  const retryInsert = content.indexOf("    darts: [", firstRetryIndex);
  content = content.slice(0, retryInsert) + "    expectedState: expectedBeforeFirstTurn,\n" + content.slice(retryInsert);

  content = replaceOnce(
    content,
    `  assert.equal(\n    match.turns.length,\n    1,\n    "Retrying the same device turn ID must be idempotent.",\n  );\n\n  match = await undoBoardDeviceTurnForCredential(`,
    `  assert.equal(\n    match.turns.length,\n    1,\n    "Retrying the same device turn ID must be idempotent.",\n  );\n\n  await assert.rejects(\n    () =>\n      submitBoardDeviceTurnForCredential({\n        deviceKey: registered.deviceKey,\n        matchId,\n        turnId: \`device-stale-turn-\${suffix}\`,\n        scoreEntered: 45,\n        dartsThrown: 3,\n        expectedState: expectedBeforeFirstTurn,\n      }),\n    (error: unknown) =>\n      error instanceof LeagueMatchStateError &&\n      /Offline sync conflict/.test(error.message),\n    "A new turn carrying stale local state must stop instead of being credited to the server's new thrower.",\n  );\n\n  match = await undoBoardDeviceTurnForCredential(`,
    path,
  );
  write(path, content);
}

// 3. Replace LeagueMatchScorer's direct device network transport with the
// durable queue transport while leaving the scoring UI/rules intact.
{
  const path = "components/LeagueMatchScorer.tsx";
  let content = read(path);
  content = replaceOnce(
    content,
    'import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";',
    'import { FormEvent, useMemo, useState } from "react";',
    path,
  );
  content = replaceOnce(
    content,
    'import { calculateConfiguredDummyTurn } from "@/lib/league/dummyScoring";',
    'import { calculateConfiguredDummyTurn } from "@/lib/league/dummyScoring";\nimport { useLeagueMatchTransport } from "@/lib/league/useLeagueMatchTransport";',
    path,
  );
  content = replaceOnce(
    content,
    `  deviceKey?: string;\n  backHref?: string;`,
    `  deviceKey?: string;\n  deviceId?: string;\n  backHref?: string;`,
    path,
  );
  content = replaceOnce(
    content,
    `  deviceKey,\n  backHref = "/game-nights",`,
    `  deviceKey,\n  deviceId,\n  backHref = "/game-nights",`,
    path,
  );

  content = replaceRegex(
    content,
    /  const apiUrl = deviceMode \? "\/api\/board-device" : "\/api\/league-matches";[\s\S]*?\n  const currentTeam = useMemo/,
    `  const [inputMode, setInputMode] = useState<CentralInputMode>(() =>\n    authMode === "device" ? "graphical" : "total",\n  );\n  const [scoreInput, setScoreInput] = useState("");\n  const [dartsThrown, setDartsThrown] = useState<1 | 2 | 3>(3);\n  const [pendingCheckout, setPendingCheckout] = useState<PendingCheckout | null>(null);\n  const [errorMessage, setErrorMessage] = useState("");\n  const [statusMessage, setStatusMessage] = useState("");\n  const {\n    match,\n    loading,\n    working,\n    errorMessage: transportErrorMessage,\n    connectionState,\n    queue,\n    syncProgress,\n    refresh: loadMatch,\n    mutate: transportMutate,\n    retrySync,\n  } = useLeagueMatchTransport({\n    matchId,\n    authMode,\n    deviceKey,\n    deviceId,\n    accessReady,\n  });\n  const combinedErrorMessage = errorMessage || transportErrorMessage;\n\n  const currentTeam = useMemo`,
    path,
  );

  content = replaceRegex(
    content,
    /  async function mutate\(body: LeagueMatchMutationRequest, message\?: string\) \{[\s\S]*?\n  \}\n\n  async function sendScore/,
    `  async function mutate(body: LeagueMatchMutationRequest, message?: string) {\n    setErrorMessage("");\n    setStatusMessage("");\n    const updated = await transportMutate(body);\n    if (!updated) return null;\n    if (message) setStatusMessage(message);\n    return updated;\n  }\n\n  async function sendScore`,
    path,
  );

  content = content.replace(
    `{loading ? "Loading board assignment…" : errorMessage || "Match not found."}`,
    `{loading ? "Loading board assignment…" : combinedErrorMessage || "Match not found."}`,
  );
  content = content.replace(
    `{errorMessage && <div className="mb-4 rounded-xl border border-red-500/40 bg-red-500/10 p-4 text-sm text-red-100">{errorMessage}</div>}`,
    `{combinedErrorMessage && <div className="mb-4 rounded-xl border border-red-500/40 bg-red-500/10 p-4 text-sm text-red-100">{combinedErrorMessage}</div>}`,
  );

  content = replaceOnce(
    content,
    `  const winner =\n    match.winnerTeamId === match.teamA.id`,
    `  const queuedScoreCount = queue.filter((item) => item.action === "score").length;\n  const connectionLabel =\n    connectionState === "offline"\n      ? \`OFFLINE · \${queuedScoreCount} turn\${queuedScoreCount === 1 ? "" : "s"} queued\`\n      : connectionState === "syncing"\n        ? syncProgress\n          ? \`SYNCING \${syncProgress.completed}/\${syncProgress.total}\`\n          : "SYNCING"\n        : connectionState === "conflict"\n          ? "SYNC CONFLICT"\n          : connectionState === "credential"\n            ? "REGISTRATION REQUIRED"\n            : "ONLINE";\n\n  const winner =\n    match.winnerTeamId === match.teamA.id`,
    path,
  );

  content = replaceOnce(
    content,
    `<Link href={backHref} className="text-sm font-semibold text-[var(--color-primary)]">{backLabel}</Link>`,
    `<Link\n            href={backHref}\n            onClick={(event) => {\n              if (deviceMode && queue.length) {\n                event.preventDefault();\n                setStatusMessage(\`\${queue.length} board update\${queue.length === 1 ? " is" : "s are"} still waiting to sync. Stay on this match until the queue is clear.\`);\n              }\n            }}\n            className="text-sm font-semibold text-[var(--color-primary)]"\n          >\n            {backLabel}\n          </Link>`,
    path,
  );
  // Replace the second back link in the loaded-match header too.
  content = content.replace(
    `<Link href={backHref} className="text-sm font-semibold text-[var(--color-primary)]">{backLabel}</Link>`,
    `<Link\n            href={backHref}\n            onClick={(event) => {\n              if (deviceMode && queue.length) {\n                event.preventDefault();\n                setStatusMessage(\`\${queue.length} board update\${queue.length === 1 ? " is" : "s are"} still waiting to sync. Stay on this match until the queue is clear.\`);\n              }\n            }}\n            className="text-sm font-semibold text-[var(--color-primary)]"\n          >\n            {backLabel}\n          </Link>`,
  );

  content = replaceOnce(
    content,
    `        <div className="flex items-center gap-2">\n          <span className="rounded-full border border-[var(--color-panel-border)] px-3 py-1 text-xs font-bold uppercase">\n            {statusLabel(match.status)}\n          </span>`,
    `        <div className="flex flex-wrap items-center gap-2">\n          {deviceMode && (\n            <span\n              className={\`rounded-full border px-3 py-1 text-xs font-bold uppercase \${\n                connectionState === "conflict" || connectionState === "credential"\n                  ? "border-red-500/50 text-red-200"\n                  : connectionState === "offline"\n                    ? "border-amber-500/50 text-amber-200"\n                    : "border-emerald-500/50 text-emerald-200"\n              }\`}\n            >\n              {connectionLabel}\n            </span>\n          )}\n          <span className="rounded-full border border-[var(--color-panel-border)] px-3 py-1 text-xs font-bold uppercase">\n            {statusLabel(match.status)}\n          </span>`,
    path,
  );

  content = replaceOnce(
    content,
    `{statusMessage && <div className="mb-4 rounded-xl border border-emerald-500/40 bg-emerald-500/10 p-4 text-sm text-emerald-100">{statusMessage}</div>}\n\n      {match.status === "scheduled" && (`,
    `{statusMessage && <div className="mb-4 rounded-xl border border-emerald-500/40 bg-emerald-500/10 p-4 text-sm text-emerald-100">{statusMessage}</div>}\n\n      {deviceMode && (queue.length > 0 || connectionState === "conflict" || connectionState === "credential") && (\n        <section className="mb-5 rounded-2xl border border-[var(--color-panel-border)] bg-[var(--color-panel)] p-4">\n          <div className="flex flex-wrap items-start justify-between gap-3">\n            <div>\n              <h2 className="font-bold">Queued Board Updates</h2>\n              <p className="mt-1 text-sm text-[var(--color-text-muted)]">\n                These updates are stored on this device until the central Game Night confirms them.\n              </p>\n            </div>\n            {(connectionState === "conflict" || connectionState === "credential" || connectionState === "offline") && (\n              <button\n                type="button"\n                disabled={working}\n                onClick={() => void retrySync()}\n                className="rounded-xl border border-[var(--color-panel-border)] px-3 py-2 text-sm font-bold disabled:opacity-50"\n              >\n                Retry Sync\n              </button>\n            )}\n          </div>\n          {connectionState === "conflict" && (\n            <p className="mt-3 rounded-xl border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-100">\n              Central history no longer matches this board's queued history. Automatic replay is stopped. Have the coordinator resolve the match state, then choose Retry Sync.\n            </p>\n          )}\n          {connectionState === "credential" && (\n            <p className="mt-3 rounded-xl border border-amber-500/40 bg-amber-500/10 p-3 text-sm text-amber-100">\n              The queued turns are safe. Repair or re-pair this registered board, then retry synchronization.\n            </p>\n          )}\n          {queue.length > 0 && (\n            <div className="mt-3 space-y-2">\n              {queue.map((item, index) => (\n                <div key={item.id} className="rounded-xl border border-[var(--color-panel-border)] bg-[var(--color-panel-soft)] p-3 text-sm">\n                  {item.action === "start" ? (\n                    <span className="font-bold">Start board match</span>\n                  ) : (\n                    <div className="flex flex-wrap items-center justify-between gap-2">\n                      <div>\n                        <span className="font-bold">{item.displayName}</span>\n                        <span className="text-[var(--color-text-muted)]"> · {item.teamName} · Leg {item.legNumber}</span>\n                      </div>\n                      <span className="font-bold tabular-nums">{item.request.scoreEntered} · {item.request.dartsThrown} darts</span>\n                    </div>\n                  )}\n                  <div className="mt-1 text-xs text-[var(--color-text-muted)]">Queue position {index + 1} of {queue.length}</div>\n                </div>\n              ))}\n            </div>\n          )}\n        </section>\n      )}\n\n      {match.status === "scheduled" && (`,
    path,
  );

  content = content.replace(
    `undoLastTurn={() => void mutate({ action: "undo", matchId }, "Last turn undone. Match state recalculated from central history.")}`,
    `undoLastTurn={() => void mutate({ action: "undo", matchId }, "Last turn undone. Local queued history or central history was recalculated safely.")}`,
  );
  write(path, content);
}

// 4. Keep the board shell mounted during transient outages and recover the
// most recent active/queued board match after refresh.
{
  const path = "app/board-device/page.tsx";
  let content = read(path);
  content = replaceOnce(
    content,
    'import type { BoardDeviceConnectionResponse } from "@/lib/league/boardDeviceContracts";',
    'import type { BoardDeviceConnectionResponse } from "@/lib/league/boardDeviceContracts";\nimport { countPendingBoardMutationsForDevice, getRecoverableBoardOfflineMatchForDevice } from "@/lib/persistence/boardMatchQueueStore";',
    path,
  );
  content = replaceOnce(
    content,
    `type DeviceMode = "league" | "casual";\n\nexport default function BoardDevicePage() {`,
    `type DeviceMode = "league" | "casual";\n\nfunction deviceIdFromKey(value: string) {\n  if (!value.startsWith("dsk_")) return null;\n  const separator = value.indexOf(".", 4);\n  if (separator <= 4) return null;\n  return value.slice(4, separator) || null;\n}\n\nexport default function BoardDevicePage() {`,
    path,
  );
  content = replaceOnce(
    content,
    `  const [connection, setConnection] =\n    useState<BoardDeviceConnectionResponse | null>(null);`,
    `  const [connection, setConnection] =\n    useState<BoardDeviceConnectionResponse | null>(null);\n  const [offlineMatchId, setOfflineMatchId] = useState("");`,
    path,
  );
  content = replaceOnce(
    content,
    `      setInitialized(true);\n\n      const hashMatch = window.location.hash.match(/pair=(\\d{6})/);\n      if (!savedKey && hashMatch?.[1]) {`,
    `      setInitialized(true);\n      const savedDeviceId = deviceIdFromKey(savedKey);\n      if (savedDeviceId) {\n        void getRecoverableBoardOfflineMatchForDevice(savedDeviceId).then((record) => {\n          if (record) setOfflineMatchId(record.matchId);\n        });\n      }\n\n      const hashMatch = window.location.hash.match(/pair=(\\d{6})/);\n      if (hashMatch?.[1]) {`,
    path,
  );
  content = replaceOnce(
    content,
    `      setConnection(result);\n      setErrorMessage("");`,
    `      setConnection(result);\n      if (result.assignment?.matchSessionId) {\n        setOfflineMatchId(result.assignment.matchSessionId);\n      }\n      setErrorMessage("");`,
    path,
  );
  content = replaceOnce(
    content,
    `    } catch (error) {\n      setConnection(null);\n      setErrorMessage(`,
    `    } catch (error) {\n      // Keep the last successful assignment mounted. The scorer itself owns\n      // offline/reconnect behavior and must not be ejected by a failed parent poll.\n      setErrorMessage(`,
    path,
  );

  content = replaceOnce(
    content,
    `  function forgetRegistration() {\n    window.localStorage.removeItem(STORAGE_KEY);`,
    `  async function forgetRegistration() {\n    const registeredDeviceId = deviceIdFromKey(deviceKey);\n    if (registeredDeviceId) {\n      const pending = await countPendingBoardMutationsForDevice(registeredDeviceId);\n      if (pending > 0) {\n        setErrorMessage(\`Cannot forget this device while \${pending} queued board update\${pending === 1 ? " is" : "s are"} waiting to sync. Re-pair the same registered device instead so the queue is preserved.\`);\n        return;\n      }\n    }\n    window.localStorage.removeItem(STORAGE_KEY);`,
    path,
  );
  content = replaceOnce(
    content,
    `    setConnection(null);\n    setErrorMessage("");`,
    `    setConnection(null);\n    setOfflineMatchId("");\n    setErrorMessage("");`,
    path,
  );
  content = content.replace(
    `onClick={forgetRegistration}`,
    `onClick={() => void forgetRegistration()}`,
  );

  content = replaceRegex(
    content,
    /  const activeLeagueAssignment =[\s\S]*?\n  if \(openLeagueAssignment && connection\?\.assignment\?\.matchSessionId\) \{[\s\S]*?\n  \}\n\n  return \(/,
    `  const registeredDeviceId = deviceIdFromKey(deviceKey);\n  const liveMatchId = connection?.assignment?.matchSessionId ?? null;\n  const recoverableMatchId = liveMatchId ?? offlineMatchId || null;\n  const activeLeagueAssignment =\n    liveMatchId && connection?.assignment?.gameNightStatus === "active";\n  const openLeagueAssignment =\n    recoverableMatchId &&\n    (mode === "league" || activeLeagueAssignment || Boolean(offlineMatchId));\n\n  if (openLeagueAssignment && recoverableMatchId && registeredDeviceId) {\n    return (\n      <LeagueMatchScorer\n        matchId={recoverableMatchId}\n        authMode="device"\n        deviceKey={deviceKey}\n        deviceId={registeredDeviceId}\n        backHref="/board-device"\n        backLabel="← Device Home"\n      />\n    );\n  }\n\n  return (`,
    path,
  );
  write(path, content);
}

fs.unlinkSync(new URL(import.meta.url));
