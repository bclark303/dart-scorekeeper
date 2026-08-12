import fs from "node:fs";

function read(path) {
  return fs.readFileSync(path, "utf8");
}

function write(path, content) {
  fs.writeFileSync(path, content, "utf8");
}

function replaceExact(path, before, after) {
  const content = read(path);
  if (!content.includes(before)) {
    throw new Error(`Expected text not found in ${path}: ${before.slice(0, 80)}`);
  }
  write(path, content.replace(before, after));
}

function insertAfter(path, marker, addition) {
  const content = read(path);
  if (content.includes(addition.trim())) return;
  const index = content.indexOf(marker);
  if (index < 0) throw new Error(`Marker not found in ${path}`);
  const end = index + marker.length;
  write(path, `${content.slice(0, end)}${addition}${content.slice(end)}`);
}

function replaceGameNightRulesSection() {
  const path = "app/game-nights/page.tsx";
  let content = read(path);

  insertAfter(
    path,
    'import { authClient } from "@/lib/auth/client";\n',
    'import { GameNightRulesPanel } from "@/components/GameNightRulesPanel";\nimport { GameNightStatsPanel } from "@/components/GameNightStatsPanel";\n',
  );
  content = read(path);

  content = content.replace(
    /function numberValue\(value: string, fallback: number\) \{[\s\S]*?\n\}\n\n/,
    "",
  );

  const heading = '<h2 className="text-xl font-bold">Team & Board Rules</h2>';
  const headingIndex = content.indexOf(heading);
  if (headingIndex < 0) throw new Error("Team & Board Rules section not found.");
  const sectionStart = content.lastIndexOf("            <section", headingIndex);
  const sectionEnd = content.indexOf("            <section", headingIndex + heading.length);
  if (sectionStart < 0 || sectionEnd < 0) {
    throw new Error("Could not isolate Team & Board Rules section.");
  }

  const replacement = `            <GameNightRulesPanel\n              settings={settingsDraft}\n              setSettings={setSettingsDraft}\n              disabled={working}\n              onSave={() =>\n                void patchGameNight(\n                  {\n                    action: "settings",\n                    gameNightId: selectedNight.id,\n                    settings: settingsDraft,\n                  },\n                  "Rules saved. Existing board pairings were cleared so they can be rebuilt safely.",\n                )\n              }\n            />\n\n`;

  content = `${content.slice(0, sectionStart)}${replacement}${content.slice(sectionEnd)}`;

  if (!content.includes("<GameNightStatsPanel")) {
    const statusMarker = "{selectedNight.status}</span>";
    const statusIndex = content.indexOf(statusMarker);
    if (statusIndex < 0) throw new Error("Selected-night status marker not found.");
    const headerSectionEnd = content.indexOf("            </section>", statusIndex);
    if (headerSectionEnd < 0) throw new Error("Selected-night header end not found.");
    const insertIndex = headerSectionEnd + "            </section>".length;
    const statsPanel = `\n\n            <GameNightStatsPanel\n              gameNightId={selectedNight.id}\n              status={selectedNight.status}\n            />`;
    content = `${content.slice(0, insertIndex)}${statsPanel}${content.slice(insertIndex)}`;
  }

  content = content.replace(
    "{selectedNight.settings.startingScore} · {selectedNight.settings.legsPerMatch} legs · {selectedNight.settings.finishRule} out",
    "{selectedNight.settings.startingScore} · Best of {selectedNight.settings.legsPerMatch} · {selectedNight.settings.finishRule} out",
  );

  write(path, content);
}

replaceGameNightRulesSection();

insertAfter(
  "app/api/leagues/game-nights/route.ts",
  '} from "@/lib/league/gameNightContracts";\n',
  'import { isSupportedBestOfLegs } from "@/lib/league/matchFormat";\n',
);
replaceExact(
  "app/api/leagues/game-nights/route.ts",
  "    Number.isInteger(settings.legsPerMatch) &&\n    settings.legsPerMatch >= 1 &&\n    settings.legsPerMatch <= 99 &&\n",
  "    isSupportedBestOfLegs(settings.legsPerMatch) &&\n",
);
replaceExact(
  "app/api/leagues/game-nights/route.ts",
  "Game-night team/board settings are invalid.",
  "Game-night rules are invalid.",
);

insertAfter(
  "lib/db/repositories/leagueMatches.ts",
  '} from "@/lib/league/matchContracts";\n',
  'import { legsNeededToWin } from "@/lib/league/matchFormat";\n',
);
replaceExact(
  "lib/db/repositories/leagueMatches.ts",
  "  let isComplete = false;\n",
  "  let isComplete = false;\n  const legsRequired = legsNeededToWin(context.session.legsPerMatch);\n",
);
replaceExact(
  "lib/db/repositories/leagueMatches.ts",
  "      if (currentLegNumber >= context.session.legsPerMatch) {\n",
  "      if (teamALegs >= legsRequired || teamBLegs >= legsRequired) {\n",
);

replaceExact(
  "components/LeagueMatchScorer.tsx",
  '{match.startingScore} · {match.finishRule === "double" ? "Double out" : "Straight out"} · {match.legsPerMatch} legs total',
  '{match.startingScore} · {match.finishRule === "double" ? "Double out" : "Straight out"} · Best of {match.legsPerMatch}',
);

replaceExact(
  "app/layout.tsx",
  'import "./globals.css";\n',
  'import "./globals.css";\nimport { BoardDeviceReturnControl } from "@/components/BoardDeviceReturnControl";\n',
);
replaceExact(
  "app/layout.tsx",
  '<body className="min-h-full flex flex-col">{children}</body>',
  '<body className="min-h-full flex flex-col">{children}<BoardDeviceReturnControl /></body>',
);

const packagePath = "package.json";
const packageJson = JSON.parse(read(packagePath));
packageJson.scripts["game-night:stats:test"] =
  "tsx scripts/game-night-stats-contract-test.ts";
write(packagePath, `${JSON.stringify(packageJson, null, 2)}\n`);

insertAfter(
  ".github/workflows/portable-persistence.yml",
  "      - name: Exercise game-night lifecycle contract\n        run: npm run game-night:test\n",
  "\n      - name: Exercise Game Night stats and Best-of contract\n        run: npm run game-night:stats:test\n",
);

console.log("Game Night polish integration applied.");
