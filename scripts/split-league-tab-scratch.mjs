import fs from "node:fs";

const path = "app/page.tsx";
let source = fs.readFileSync(path, "utf8");

function replaceOnce(before, after, label) {
  if (source.includes(after)) return;
  if (!source.includes(before)) throw new Error(`Could not apply ${label}`);
  source = source.replace(before, after);
}

replaceOnce(
  'import { ServerStorageSection } from "@/components/ServerStorageSection";\n',
  'import { ServerStorageSection } from "@/components/ServerStorageSection";\nimport { LeagueControlsSection } from "@/components/LeagueControlsSection";\n',
  "LeagueControlsSection import",
);

replaceOnce(
  'type AppView = "score" | "game" | "app" | "stats" | "history";',
  'type AppView = "score" | "game" | "league" | "app" | "stats" | "history";',
  "AppView league member",
);

replaceOnce(
  '      case "game":\n        return "Game Setup";\n      case "app":',
  '      case "game":\n        return "Game Setup";\n      case "league":\n        return "League";\n      case "app":',
  "active view label",
);

replaceOnce(
  '<nav className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-8">',
  '<nav className="grid grid-cols-2 gap-3 mb-8 sm:grid-cols-3 lg:grid-cols-6">',
  "navigation grid",
);

replaceOnce(
  '        <button\n          onClick={() => setActiveView("app")}\n          className={getTabClass("app")}\n        >\n          App\n        </button>',
  '        <button\n          onClick={() => setActiveView("league")}\n          className={getTabClass("league")}\n        >\n          League\n        </button>\n\n        <button\n          onClick={() => setActiveView("app")}\n          className={getTabClass("app")}\n        >\n          App\n        </button>',
  "full League tab",
);

replaceOnce(
  '                <button\n                  onClick={() => openGameMenuView("app")}\n                  className={getGameMenuButtonClass("app")}\n                >\n                  App Settings\n                </button>',
  '                <button\n                  onClick={() => openGameMenuView("league")}\n                  className={getGameMenuButtonClass("league")}\n                >\n                  League\n                </button>\n\n                <button\n                  onClick={() => openGameMenuView("app")}\n                  className={getGameMenuButtonClass("app")}\n                >\n                  App Settings\n                </button>',
  "game menu League item",
);

replaceOnce(
  '        {activeView === "app" && (\n          <>',
  '        {activeView === "league" && <LeagueControlsSection />}\n\n        {activeView === "app" && (\n          <>',
  "League tab content",
);

fs.writeFileSync(path, source);
