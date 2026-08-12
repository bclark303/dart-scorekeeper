import fs from "node:fs";

const path = "lib/league/useLeagueMatchTransport.ts";
let content = fs.readFileSync(path, "utf8");
const before = `      if (local?.conflict?.kind === "conflict" && !forceConflictRetry) {\n        setRecord(local);\n        setConnectionState("conflict");\n        return;\n      }`;
const after = `      if (local?.conflict && !forceConflictRetry) {\n        setRecord(local);\n        setConnectionState(\n          local.conflict.kind === "credential" ? "credential" : "conflict",\n        );\n        return;\n      }`;
if (!content.includes(before)) {
  throw new Error("Expected semantic-conflict guard was not found.");
}
content = content.replace(before, after);
fs.writeFileSync(path, content);
fs.unlinkSync(new URL(import.meta.url));
