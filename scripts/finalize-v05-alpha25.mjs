import fs from "node:fs";
import { execFileSync } from "node:child_process";

execFileSync("npm", ["version", "0.5.0-alpha.25", "--no-git-tag-version"], {
  stdio: "inherit",
});

const appInfoPath = "lib/appInfo.ts";
const appInfo = fs.readFileSync(appInfoPath, "utf8");
if (!appInfo.includes('APP_VERSION = "0.5.0-alpha.24"')) {
  throw new Error("Expected alpha.24 app version was not found.");
}
fs.writeFileSync(
  appInfoPath,
  appInfo.replace('APP_VERSION = "0.5.0-alpha.24"', 'APP_VERSION = "0.5.0-alpha.25"'),
);

const changelogPath = "CHANGELOG.md";
const changelog = fs.readFileSync(changelogPath, "utf8");
const marker = "## Unreleased\n";
if (!changelog.includes(marker)) throw new Error("Unreleased changelog section was not found.");
const entry = `\n### League round model (v0.5.0-alpha.25)\n- Added Fixed Matchups so randomly created Round 1 opponents can remain paired across later Game Night rounds.\n- Fixed venue board counts now constrain automatic team count; Auto Team Sizes expands balanced teams as needed instead of requiring extra boards.\n- Clarified league setup around rounds versus legs and added a 3 rounds × 1 leg same-matchup preset using the existing 10-minute round intermission after Round 2.\n- Added individual season leg standings derived from authoritative non-voided checkout results, so rotating weekly teams still produce stable player standings.\n- Fixed Game Night API validation so all supported X01 starting scores, including 601, can be saved consistently with the UI.\n- Added a permanent 22-week, 10–28 player, four-board structural acceptance regression.\n`;
fs.writeFileSync(changelogPath, changelog.replace(marker, marker + entry));

fs.rmSync("scripts/finalize-v05-alpha25.mjs");
fs.rmSync(".github/workflows/finalize-v05-alpha25.yml");
console.log("v0.5.0-alpha.25 release metadata finalized.");
