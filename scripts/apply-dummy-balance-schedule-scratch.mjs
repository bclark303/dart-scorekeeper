import fs from "node:fs";

function read(path) {
  return fs.readFileSync(path, "utf8");
}

function write(path, content) {
  fs.writeFileSync(path, content);
}

function replaceOnce(content, before, after, path) {
  if (!content.includes(before)) {
    throw new Error(`Expected source pattern was not found in ${path}: ${before.slice(0, 120)}`);
  }
  return content.replace(before, after);
}

// 1. Add a persisted/contract-level dummy policy value without a schema migration:
// dummy_player_mode is already a free text column.
{
  const path = "lib/league/gameNightContracts.ts";
  let content = read(path);
  content = replaceOnce(
    content,
    'export type DummyPlayerMode = "none" | "allow" | "fill";',
    'export type DummyPlayerMode = "none" | "allow" | "fill" | "balance";',
    path,
  );
  write(path, content);
}

// 2. Teach the base Game Night repository to preserve and execute the new mode.
{
  const path = "lib/db/repositories/gameNights.ts";
  let content = read(path);

  content = replaceOnce(
    content,
    'import { getDatabase } from "../client";',
    'import { dummyTargetSizeForTeams } from "@/lib/league/dummyTeamBalance";\nimport { getDatabase } from "../client";',
    path,
  );

  content = replaceOnce(
    content,
    '  if (value === "none" || value === "allow" || value === "fill") return value;',
    '  if (value === "none" || value === "allow" || value === "fill" || value === "balance") return value;',
    path,
  );

  content = replaceOnce(
    content,
    '    settings.dummyPlayerMode !== "fill" &&\n    checkedIn.length < settings.targetTeamCount * settings.minTeamPlayers',
    '    settings.dummyPlayerMode !== "fill" &&\n    settings.dummyPlayerMode !== "balance" &&\n    checkedIn.length < settings.targetTeamCount * settings.minTeamPlayers',
    path,
  );

  const oldPrepareBlock = `    if (settings.dummyPlayerMode === "fill") {\n      for (const team of teams) {\n        let count = teamMembers.filter((member) => member.teamId === team.id).length;\n        while (count < settings.minTeamPlayers) {\n          teamMembers.push({\n            id: crypto.randomUUID(),\n            teamId: team.id,\n            leaguePlayerId: null,\n            slotIndex: count,\n            displayName: \`Dummy \${count + 1}\`,\n            isDummy: true,\n          });\n          count += 1;\n        }\n      }\n    }`;
  const newPrepareBlock = `    if (settings.dummyPlayerMode === "fill" || settings.dummyPlayerMode === "balance") {\n      const realPlayerCounts = teams.map(\n        (team) =>\n          teamMembers.filter(\n            (member) => member.teamId === team.id && !member.isDummy,\n          ).length,\n      );\n      const targetSize = dummyTargetSizeForTeams({\n        mode: settings.dummyPlayerMode,\n        realPlayerCounts,\n        minTeamPlayers: settings.minTeamPlayers,\n        maxTeamPlayers: settings.maxTeamPlayers,\n      });\n\n      for (const team of teams) {\n        let count = teamMembers.filter((member) => member.teamId === team.id).length;\n        while (count < targetSize) {\n          teamMembers.push({\n            id: crypto.randomUUID(),\n            teamId: team.id,\n            leaguePlayerId: null,\n            slotIndex: count,\n            displayName: \`Dummy \${count + 1}\`,\n            isDummy: true,\n          });\n          count += 1;\n        }\n      }\n    }`;
  content = replaceOnce(content, oldPrepareBlock, newPrepareBlock, path);

  const oldPopulateBlock = `  for (const team of teams) {\n    let members = await getDatabase().select().from(gameNightTeamMembers).where(eq(gameNightTeamMembers.teamId, team.id));\n    if (members.length > settings.maxTeamPlayers) throw new Error(\`\${team.name} exceeds the maximum team size.\`);\n    if (members.length < settings.minTeamPlayers) {\n      if (settings.dummyPlayerMode === "none") throw new Error(\`\${team.name} is below the minimum team size.\`);\n      while (members.length < settings.minTeamPlayers) {\n        const slotIndex = members.length ? Math.max(...members.map((member) => member.slotIndex)) + 1 : 0;\n        const dummy = {\n          id: crypto.randomUUID(),\n          teamId: team.id,\n          leaguePlayerId: null,\n          slotIndex,\n          displayName: \`Dummy \${slotIndex + 1}\`,\n          isDummy: true,\n        };\n        await getDatabase().insert(gameNightTeamMembers).values(dummy);\n        members = [...members, dummy];\n      }\n    }\n  }`;
  const newPopulateBlock = `  const membersByTeam = new Map<string, (typeof gameNightTeamMembers.$inferSelect)[]>();\n  const realPlayerCounts: number[] = [];\n  for (const team of teams) {\n    const members = await getDatabase()\n      .select()\n      .from(gameNightTeamMembers)\n      .where(eq(gameNightTeamMembers.teamId, team.id));\n    membersByTeam.set(team.id, members);\n    const realCount = members.filter((member) => !member.isDummy).length;\n    realPlayerCounts.push(realCount);\n    if (realCount > settings.maxTeamPlayers) {\n      throw new Error(\`\${team.name} exceeds the maximum team size.\`);\n    }\n    if (settings.dummyPlayerMode !== "balance" && members.length > settings.maxTeamPlayers) {\n      throw new Error(\`\${team.name} exceeds the maximum team size.\`);\n    }\n  }\n\n  const targetSize = dummyTargetSizeForTeams({\n    mode: settings.dummyPlayerMode,\n    realPlayerCounts,\n    minTeamPlayers: settings.minTeamPlayers,\n    maxTeamPlayers: settings.maxTeamPlayers,\n  });\n\n  for (const team of teams) {\n    let members = membersByTeam.get(team.id) ?? [];\n\n    // Balance mode is a true normalization rule: if an earlier manual edit or\n    // attendance change left stale extra dummies, remove only the excess dummy\n    // slots before filling every team to the shared target size.\n    if (settings.dummyPlayerMode === "balance") {\n      while (members.length > targetSize) {\n        const removableDummy = [...members]\n          .filter((member) => member.isDummy)\n          .sort((a, b) => b.slotIndex - a.slotIndex)[0];\n        if (!removableDummy) break;\n        await getDatabase()\n          .delete(gameNightTeamMembers)\n          .where(eq(gameNightTeamMembers.id, removableDummy.id));\n        members = members.filter((member) => member.id !== removableDummy.id);\n      }\n    }\n\n    const minimumForMode =\n      settings.dummyPlayerMode === "balance" ? targetSize : settings.minTeamPlayers;\n    if (members.length < minimumForMode) {\n      if (settings.dummyPlayerMode === "none") {\n        throw new Error(\`\${team.name} is below the minimum team size.\`);\n      }\n      while (members.length < minimumForMode) {\n        const slotIndex = members.length\n          ? Math.max(...members.map((member) => member.slotIndex)) + 1\n          : 0;\n        const dummy = {\n          id: crypto.randomUUID(),\n          teamId: team.id,\n          leaguePlayerId: null,\n          slotIndex,\n          displayName: \`Dummy \${slotIndex + 1}\`,\n          isDummy: true,\n        };\n        await getDatabase().insert(gameNightTeamMembers).values(dummy);\n        members = [...members, dummy];\n      }\n    }\n  }`;
  content = replaceOnce(content, oldPopulateBlock, newPopulateBlock, path);
  write(path, content);
}

// 3. Preserve balance mode through the richer fixture read model.
{
  const path = "lib/db/repositories/gameNightFixtures.ts";
  let content = read(path);
  content = replaceOnce(
    content,
    `    dummyPlayerMode:\n      row.dummyPlayerMode === "none" || row.dummyPlayerMode === "allow"\n        ? row.dummyPlayerMode\n        : "fill",`,
    `    dummyPlayerMode:\n      row.dummyPlayerMode === "none" ||\n      row.dummyPlayerMode === "allow" ||\n      row.dummyPlayerMode === "fill" ||\n      row.dummyPlayerMode === "balance"\n        ? row.dummyPlayerMode\n        : "fill",`,
    path,
  );
  write(path, content);
}

// 4. API validation accepts the new menu value.
{
  const path = "app/api/leagues/game-nights/route.ts";
  let content = read(path);
  content = replaceOnce(
    content,
    '["none", "allow", "fill"].includes(settings.dummyPlayerMode)',
    '["none", "allow", "fill", "balance"].includes(settings.dummyPlayerMode)',
    path,
  );
  write(path, content);
}

// 5. Add the coordinator-facing dummy option.
{
  const path = "components/GameNightRulesPanel.tsx";
  let content = read(path);
  content = replaceOnce(
    content,
    `                <option value="fill">Auto-fill to minimum</option>\n              </select>`,
    `                <option value="fill">Auto-fill to minimum</option>\n                <option value="balance">Balance all teams with dummies</option>\n              </select>\n              {settings.dummyPlayerMode === "balance" && (\n                <span className="mt-1 block text-xs text-emerald-200">\n                  Shorter teams receive dummy slots until every team has the same number of players as the largest real team.\n                </span>\n              )}`,
    path,
  );
  write(path, content);
}

// 6. Put the full-night schedule button directly in Fixture & Round Control.
{
  const path = "components/GameNightFixturePanel.tsx";
  let content = read(path);
  content = replaceOnce(
    content,
    'import { GameNightDraftRoundEditor } from "@/components/GameNightDraftRoundEditor";',
    'import { GameNightDraftRoundEditor } from "@/components/GameNightDraftRoundEditor";\nimport { GameNightScheduleButton } from "@/components/GameNightScheduleButton";',
    path,
  );
  content = replaceOnce(
    content,
    `        <div className="rounded-full border border-[var(--color-panel-border)] px-3 py-1 text-xs font-bold uppercase">\n          {gameNight.completedRoundCount ?? 0} / {resolved.roundCount} rounds\n          complete\n        </div>`,
    `        <div className="flex flex-wrap items-center gap-2">\n          <GameNightScheduleButton gameNight={gameNight} />\n          <div className="rounded-full border border-[var(--color-panel-border)] px-3 py-1 text-xs font-bold uppercase">\n            {gameNight.completedRoundCount ?? 0} / {resolved.roundCount} rounds\n            complete\n          </div>\n        </div>`,
    path,
  );
  write(path, content);
}

// 7. Make the same schedule view available from Setup & Check-in.
{
  const path = "app/game-nights/page.tsx";
  let content = read(path);
  content = replaceOnce(
    content,
    'import { GameNightRulesPanel } from "@/components/GameNightRulesPanel";',
    'import { GameNightRulesPanel } from "@/components/GameNightRulesPanel";\nimport { GameNightScheduleButton } from "@/components/GameNightScheduleButton";',
    path,
  );
  content = replaceOnce(
    content,
    `                <span className="rounded-full border border-[var(--color-panel-border)] px-3 py-1 text-xs font-bold uppercase">\n                  {selectedNight.status}\n                </span>`,
    `                <div className="flex flex-wrap items-center gap-2">\n                  <GameNightScheduleButton gameNight={selectedNight} />\n                  <span className="rounded-full border border-[var(--color-panel-border)] px-3 py-1 text-xs font-bold uppercase">\n                    {selectedNight.status}\n                  </span>\n                </div>`,
    path,
  );
  write(path, content);
}

// 8. Permanent test command.
{
  const path = "package.json";
  let content = read(path);
  content = replaceOnce(
    content,
    '    "dummy-scoring:test": "tsx scripts/dummy-scoring-contract-test.ts && tsx scripts/dummy-scoring-integration-contract-test.ts",',
    '    "dummy-scoring:test": "tsx scripts/dummy-scoring-contract-test.ts && tsx scripts/dummy-scoring-integration-contract-test.ts",\n    "dummy-team-balance:test": "tsx scripts/dummy-team-balance-contract-test.ts && tsx scripts/dummy-team-balance-integration-contract-test.ts",',
    path,
  );
  write(path, content);
}

// 9. Restore the workflow to normal main-only/read-only state while retaining
// the new permanent regression gate. The currently running scratch workflow was
// loaded before this rewrite and will still execute the same test below.
{
  const path = ".github/workflows/portable-persistence.yml";
  let content = read(path);
  content = content.replace('      - internal/dummy-balance-night-schedule\n', '');
  content = content.replace('permissions:\n  contents: write', 'permissions:\n  contents: read');
  const start = '      - name: Apply dummy balance / schedule scratch edits\n';
  const end = '      - name: Install locked dependencies\n';
  if (content.includes(start)) {
    const startIndex = content.indexOf(start);
    const endIndex = content.indexOf(end, startIndex);
    if (endIndex < 0) throw new Error("Could not find end of temporary scratch workflow step.");
    content = content.slice(0, startIndex) + content.slice(endIndex);
  }
  if (!content.includes('Exercise dummy team balancing contract')) {
    content = replaceOnce(
      content,
      '      - name: Exercise dummy scoring rules contract\n        run: npm run dummy-scoring:test\n',
      '      - name: Exercise dummy scoring rules contract\n        run: npm run dummy-scoring:test\n\n      - name: Exercise dummy team balancing contract\n        run: npm run dummy-team-balance:test\n',
      path,
    );
  }
  write(path, content);
}

// Do not leave this scratch-only mutation helper in the publishable tree.
fs.unlinkSync(new URL(import.meta.url));
