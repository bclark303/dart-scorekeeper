import fs from "node:fs";

const path = "scripts/apply-board-device-bridge.mjs";
let source = fs.readFileSync(path, "utf8");
source = source.replace("${apiUrl}", "\\${apiUrl}");
fs.writeFileSync(path, source);
