import fs from "node:fs";

const path = "scripts/apply-graphical-device-scoring.mjs";
let source = fs.readFileSync(path, "utf8");
source = source.replaceAll("${winner}", "\\${winner}");
source = source.replaceAll("${currentMember.displayName}", "\\${currentMember.displayName}");
fs.writeFileSync(path, source);

await import("./apply-graphical-device-scoring.mjs");
