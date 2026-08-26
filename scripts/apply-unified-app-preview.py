from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

# Root should be the casual product directly. Keep /casual as a valid alias.
(ROOT / "app/page.tsx").write_text(
    'import CasualPage from "./casual/page";\n\n'
    'export default function HomePage() {\n'
    '  return <CasualPage />;\n'
    '}\n'
)

casual_path = ROOT / "app/casual/page.tsx"
text = casual_path.read_text()

old_full_nav = '''  function renderFullNavigation() {
    return (
      <nav className="mb-8 flex flex-wrap gap-2" aria-label="Casual Play sections">
        <button type="button" onClick={() => { window.location.href = "/"; }} className="rounded-xl border border-[var(--color-panel-border)] bg-[var(--color-panel)] px-4 py-3 font-bold hover:bg-[var(--color-panel-soft)]">
          ← Home
        </button>
        <button onClick={() => setActiveView("game")} className={getTabClass("game")}>Match Setup</button>
        <button onClick={() => setActiveView("stats")} className={getTabClass("stats")}>Stats</button>
        <button onClick={() => setActiveView("history")} className={getTabClass("history")}>History</button>
        <button onClick={() => setActiveView("app")} className={getTabClass("app")}>Settings</button>
        <a href="/help?from=casual" className="rounded-xl border border-[var(--color-panel-border)] bg-[var(--color-panel)] px-4 py-3 font-bold hover:bg-[var(--color-panel-soft)]">
          ? Help
        </a>
      </nav>
    );
  }
'''

new_full_nav = '''  function renderFullNavigation() {
    return (
      <nav className="relative mb-8 flex items-center gap-3" aria-label="Dart Scorekeeper menu">
        <button
          type="button"
          onClick={() => setIsGameMenuOpen(true)}
          className="min-h-11 rounded-xl bg-[var(--color-primary)] px-4 py-2.5 text-xl font-bold text-white hover:bg-[var(--color-primary-hover)]"
          aria-expanded={isGameMenuOpen}
          aria-label="Open app menu"
        >
          ☰
        </button>
        <div className="text-sm font-bold text-[var(--color-text-muted)]">
          {activeView === "game"
            ? "Match Setup"
            : activeView === "stats"
              ? "Stats"
              : activeView === "history"
                ? "History"
                : activeView === "app"
                  ? "Settings"
                  : "Casual Play"}
        </div>

        {isGameMenuOpen && (
          <div className="fixed inset-0 z-50 bg-black/70 p-4" role="dialog" aria-modal="true" aria-label="App menu">
            <div className="mx-auto max-w-sm rounded-2xl border border-slate-600 bg-slate-950 p-4 text-white shadow-2xl">
              <div className="mb-3 flex items-center justify-between gap-3">
                <div>
                  <div className="text-lg font-bold">Dart Scorekeeper</div>
                  <div className="text-sm text-slate-300">Casual Play · v{APP_VERSION}</div>
                </div>
                <button onClick={() => setIsGameMenuOpen(false)} className="rounded-xl bg-slate-800 px-3 py-2 text-sm font-bold hover:bg-slate-700">Close</button>
              </div>

              <div className="mb-3 grid grid-cols-1 gap-2">
                <button onClick={() => openGameMenuView("game")} className={getGameMenuButtonClass("game")}>Match Setup</button>
                <button onClick={() => openGameMenuView("stats")} className={getGameMenuButtonClass("stats")}>Stats</button>
                <button onClick={() => openGameMenuView("history")} className={getGameMenuButtonClass("history")}>History</button>
                <button onClick={() => openGameMenuView("app")} className={getGameMenuButtonClass("app")}>Settings</button>
              </div>

              <div className="mb-2 border-t border-slate-700 pt-3 text-xs font-black uppercase tracking-[0.14em] text-slate-400">League</div>
              <div className="grid grid-cols-1 gap-2">
                <a href="/league-play" className="rounded-xl border border-blue-500/40 bg-blue-500/10 px-4 py-3 text-left font-bold text-blue-100 hover:bg-blue-500/20">
                  League / Game Night <span className="ml-2 rounded-full bg-blue-500/20 px-2 py-0.5 text-xs uppercase tracking-wide text-blue-200">Preview</span>
                </a>
                <a href="/league-devices" className="rounded-xl border border-violet-500/40 bg-violet-500/10 px-4 py-3 text-left font-bold text-violet-100 hover:bg-violet-500/20">Scoring Devices</a>
                <a href="/help?from=casual" className="rounded-xl bg-slate-800 px-4 py-3 text-left font-bold text-slate-100 hover:bg-slate-700">Help / Feedback</a>
              </div>
            </div>
          </div>
        )}
      </nav>
    );
  }
'''

if old_full_nav in text:
    text = text.replace(old_full_nav, new_full_nav, 1)
elif new_full_nav not in text:
    raise RuntimeError("Could not recognize the casual navigation state")

old_game_menu_tail = '''                <button onClick={() => openGameMenuView("history")} className={getGameMenuButtonClass("history")}>History</button>
                <button onClick={() => openGameMenuView("app")} className={getGameMenuButtonClass("app")}>Settings</button>
                <a href="/help?from=casual-play" className="rounded-xl bg-slate-800 px-4 py-3 text-left font-bold text-slate-100 hover:bg-slate-700">Help / Feedback</a>
                <button type="button" onClick={() => { setIsGameMenuOpen(false); setIsExitGameOpen(true); }} className="rounded-xl border border-slate-700 bg-slate-900 px-4 py-3 text-left font-bold text-slate-100 hover:bg-slate-800">Exit Game…</button>
'''

new_game_menu_tail = '''                <button onClick={() => openGameMenuView("history")} className={getGameMenuButtonClass("history")}>History</button>
                <button onClick={() => openGameMenuView("app")} className={getGameMenuButtonClass("app")}>Settings</button>
                <div className="mt-1 border-t border-slate-700 pt-3 text-xs font-black uppercase tracking-[0.14em] text-slate-400">League</div>
                <a href="/league-play" className="rounded-xl border border-blue-500/40 bg-blue-500/10 px-4 py-3 text-left font-bold text-blue-100 hover:bg-blue-500/20">
                  League / Game Night <span className="ml-2 rounded-full bg-blue-500/20 px-2 py-0.5 text-xs uppercase tracking-wide text-blue-200">Preview</span>
                </a>
                <a href="/league-devices" className="rounded-xl border border-violet-500/40 bg-violet-500/10 px-4 py-3 text-left font-bold text-violet-100 hover:bg-violet-500/20">Scoring Devices</a>
                <a href="/help?from=casual-play" className="rounded-xl bg-slate-800 px-4 py-3 text-left font-bold text-slate-100 hover:bg-slate-700">Help / Feedback</a>
                <button type="button" onClick={() => { setIsGameMenuOpen(false); setIsExitGameOpen(true); }} className="rounded-xl border border-slate-700 bg-slate-900 px-4 py-3 text-left font-bold text-slate-100 hover:bg-slate-800">Exit Game…</button>
'''

if old_game_menu_tail in text:
    text = text.replace(old_game_menu_tail, new_game_menu_tail, 1)
elif new_game_menu_tail not in text:
    raise RuntimeError("Could not recognize the active-game menu state")
casual_path.write_text(text)

old_version = "0.5.0-alpha.22"
new_version = "0.5.0-alpha.23"
for relative in ["package.json", "package-lock.json", "lib/appInfo.ts"]:
    target = ROOT / relative
    value = target.read_text()
    if old_version in value:
        target.write_text(value.replace(old_version, new_version))
    elif new_version not in value:
        raise RuntimeError(f"Could not recognize version state in {relative}")

changelog_path = ROOT / "CHANGELOG.md"
changelog = changelog_path.read_text()
entry = '''### Unified app preview (v0.5.0-alpha.23)
- Collapsed Casual Play, League / Game Night, and scoring-device administration into one preview application and one shared codebase.
- The root page now opens directly into Casual Play instead of presenting a mode-selection landing page.
- Casual Play now exposes a hamburger menu before and during matches, with League / Game Night marked Preview and Scoring Devices available without dominating the casual experience.
- The production `main` branch remains unchanged until the unified preview is explicitly approved.

'''
marker = "## Unreleased\n\n"
if "### Unified app preview (v0.5.0-alpha.23)" not in changelog:
    if marker not in changelog:
        raise RuntimeError("Could not find Unreleased changelog section")
    changelog_path.write_text(changelog.replace(marker, marker + entry, 1))

print(f"Unified app preview ready at {new_version}")
