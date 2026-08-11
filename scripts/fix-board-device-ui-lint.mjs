import fs from "node:fs";

const path = "app/league-devices/page.tsx";
let source = fs.readFileSync(path, "utf8");
source = source.replace("on that board's device client.", "on that board&apos;s device client.");
fs.writeFileSync(path, source);
