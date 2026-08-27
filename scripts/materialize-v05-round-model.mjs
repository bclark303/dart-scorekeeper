import fs from "node:fs";

function patch(path, before, after) {
  const source = fs.readFileSync(path, "utf8");
  if (!source.includes(before)) {
    throw new Error(`Expected source fragment not found in ${path}: ${before.slice(0, 80)}`);
  }
  fs.writeFileSync(path, source.replace(before, after));
}

patch(
  "lib/db/repositories/gameNightFixtures.ts",
  '  if (value === "round_robin" || value === "swiss" || value === "manual") return value;',
  '  if (value === "fixed" || value === "round_robin" || value === "swiss" || value === "manual") return value;',
);

patch(
  "app/api/leagues/game-nights/route.ts",
  'import { isSupportedBestOfLegs } from "@/lib/league/matchFormat";',
  'import { isSupportedBestOfLegs } from "@/lib/league/matchFormat";\nimport { isSupportedX01StartingScore } from "@/lib/scoring";',
);
patch(
  "app/api/leagues/game-nights/route.ts",
  '["random", "round_robin", "swiss", "manual"].includes(settings.pairingStrategy)',
  '["random", "fixed", "round_robin", "swiss", "manual"].includes(settings.pairingStrategy)',
);
patch(
  "app/api/leagues/game-nights/route.ts",
  '[301, 501, 701].includes(settings.startingScore)',
  'isSupportedX01StartingScore(settings.startingScore)',
);

patch(
  "components/GameNightFixturePanel.tsx",
  'function strategyLabel(strategy: FixturePairingStrategy) {\n  if (strategy === "round_robin") return "Round robin";',
  'function strategyLabel(strategy: FixturePairingStrategy) {\n  if (strategy === "fixed") return "Fixed matchups · repeat Round 1";\n  if (strategy === "round_robin") return "Round robin";',
);

patch(
  "components/GameNightFixturePanel.tsx",
  '                <option value="random">Random · avoid rematches</option>\n                <option value="round_robin">Round robin</option>',
  '                <option value="random">Random · avoid rematches</option>\n                <option value="fixed">Fixed matchups · repeat Round 1</option>\n                <option value="round_robin">Round robin</option>',
);

patch(
  "components/GameNightFixturePanel.tsx",
  '          <h3 className="font-bold">Round Rules</h3>\n          <div className="mt-3 grid gap-3 sm:grid-cols-2">',
  '          <h3 className="font-bold">Round Rules</h3>\n          <div className="mt-3 rounded-xl border border-[var(--color-primary)]/40 bg-[var(--color-panel)] p-3">\n            <div className="text-sm font-black">Common league format</div>\n            <p className="mt-1 text-xs text-[var(--color-text-muted)]">\n              Three rounds can represent three individual legs while keeping the same opponents.\n              A scheduled round break then doubles as the between-leg intermission.\n            </p>\n            <button\n              type="button"\n              disabled={disabled || !canEditRules}\n              onClick={() =>\n                setSettings((current) => ({\n                  ...current,\n                  roundCount: 3,\n                  pairingStrategy: "fixed",\n                  legsPerMatch: 1,\n                  intermissionAfterRounds: [2],\n                  intermissionDurationMinutes: 10,\n                }))\n              }\n              className="mt-3 rounded-lg border border-[var(--color-primary)] px-3 py-2 text-sm font-black text-[var(--color-primary)] disabled:opacity-50"\n            >\n              Use 3 rounds × 1 leg · same matchups\n            </button>\n            <div className="mt-2 text-xs text-[var(--color-text-muted)]">\n              Sets a 10-minute break after Round 2. Save Fixture Rules to apply it.\n            </div>\n          </div>\n          <div className="mt-3 grid gap-3 sm:grid-cols-2">',
);

patch(
  "components/GameNightRulesPanel.tsx",
  '            Auto modes recalculate from the checked-in headcount. Team sizing\n            prefers balanced 2-3 player teams where practical, team count avoids\n            a bye when a similarly good even-team layout exists, and Auto Boards\n            provides one board per simultaneous matchup.',
  '            Auto modes recalculate from the checked-in headcount. With a fixed\n            board count, Auto Teams creates no more than two teams per board and\n            Auto Team Sizes expands teams as needed to fit venue capacity. Auto\n            Boards still provides one board per simultaneous matchup.',
);

patch(
  "components/GameNightRulesPanel.tsx",
  '            Uses the same X01 formats and Best-of semantics as casual scoring.',
  '            Each round schedules one pairing. Use 1 leg when rounds themselves\n            represent the legs; longer Best-of formats play multiple legs inside each round.',
);

patch(
  "components/GameNightRulesPanel.tsx",
  '              Legs\n              <select',
  '              Legs per pairing\n              <select',
);

patch(
  "components/GameNightRulesPanel.tsx",
  '                  <option key={legs} value={legs}>Best of {legs}</option>',
  '                  <option key={legs} value={legs}>{legs === 1 ? "1 leg" : `Best of ${legs}`}</option>',
);

patch(
  "components/GameNightRulesPanel.tsx",
  '                <option value="manual">Manual</option>\n                <option value="automatic">Auto from team count</option>',
  '                <option value="manual">Fixed venue capacity</option>\n                <option value="automatic">Auto from team count</option>',
);

patch(
  "app/game-nights/setup/page.tsx",
  '                  <div className="mt-1 text-lg font-black">Best of {settingsDraft.legsPerMatch}</div>',
  '                  <div className="mt-1 text-lg font-black">\n                    {settingsDraft.legsPerMatch === 1\n                      ? "1 leg / round"\n                      : `Best of ${settingsDraft.legsPerMatch}`}\n                  </div>',
);

fs.rmSync("scripts/materialize-v05-round-model.mjs");
fs.rmSync(".github/workflows/v05-round-model-materialize.yml");
console.log("v0.5 league round model UI and persistence changes materialized.");
