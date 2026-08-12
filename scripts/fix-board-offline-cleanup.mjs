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

{
  const path = "app/board-device/page.tsx";
  let content = read(path);

  content = replaceOnce(
    content,
    `  const saveDeviceKey = useCallback((value: string) => {\n    window.localStorage.setItem(STORAGE_KEY, value);\n    setDeviceKey(value);\n    setConnection(null);\n    setOfflineMatchId("");\n    setErrorMessage("");\n  }, []);`,
    `  const saveDeviceKey = useCallback((value: string) => {\n    const previousKey = window.localStorage.getItem(STORAGE_KEY) ?? "";\n    const sameRegisteredDevice =\n      deviceIdFromKey(previousKey) &&\n      deviceIdFromKey(previousKey) === deviceIdFromKey(value);\n    window.localStorage.setItem(STORAGE_KEY, value);\n    setDeviceKey(value);\n    setConnection(null);\n    // Re-pairing/rotating credentials for the same registered board must not\n    // detach it from its durable offline match queue. A different device key\n    // can safely clear only the in-memory recovery pointer; the old queue stays\n    // persisted under the old device ID.\n    if (!sameRegisteredDevice) setOfflineMatchId("");\n    setErrorMessage("");\n  }, []);`,
    path,
  );

  content = replaceOnce(
    content,
    `    setConnection(null);\n    setErrorMessage("");\n    setMode("league");`,
    `    setConnection(null);\n    setOfflineMatchId("");\n    setErrorMessage("");\n    setMode("league");`,
    path,
  );

  content = replaceOnce(
    content,
    `  const recoverableMatchId = liveMatchId ?? offlineMatchId || null;`,
    `  const recoverableMatchId = liveMatchId ?? (offlineMatchId || null);`,
    path,
  );

  write(path, content);
}

{
  const path = "components/LeagueMatchScorer.tsx";
  let content = read(path);
  content = replaceOnce(
    content,
    `import type {\n  LeagueMatchMutationRequest,\n  LeagueMatchResponse,\n  LeagueMatchSummary,\n} from "@/lib/league/matchContracts";`,
    `import type { LeagueMatchMutationRequest } from "@/lib/league/matchContracts";`,
    path,
  );
  content = replaceOnce(
    content,
    `              Central history no longer matches this board's queued history. Automatic replay is stopped. Have the coordinator resolve the match state, then choose Retry Sync.`,
    `              Central history no longer matches the queued history on this board. Automatic replay is stopped. Have the coordinator resolve the match state, then choose Retry Sync.`,
    path,
  );
  content = replaceOnce(
    content,
    `  const queuedScoreCount = queue.filter((item) => item.action === "score").length;\n  const connectionLabel =\n    connectionState === "offline"\n      ? \`OFFLINE · \${queuedScoreCount} turn\${queuedScoreCount === 1 ? "" : "s"} queued\``,
    `  const queuedScoreCount = queue.filter((item) => item.action === "score").length;\n  const queuedOfflineLabel =\n    queuedScoreCount > 0\n      ? \`\${queuedScoreCount} turn\${queuedScoreCount === 1 ? "" : "s"} queued\`\n      : queue.length > 0\n        ? \`\${queue.length} update\${queue.length === 1 ? "" : "s"} queued\`\n        : "no turns queued";\n  const connectionLabel =\n    connectionState === "offline"\n      ? \`OFFLINE · \${queuedOfflineLabel}\``,
    path,
  );
  write(path, content);
}

fs.unlinkSync(new URL(import.meta.url));
