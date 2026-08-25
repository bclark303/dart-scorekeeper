from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def replace_once(path: str, old: str, new: str) -> None:
    target = ROOT / path
    text = target.read_text()
    count = text.count(old)
    if count != 1:
        raise RuntimeError(f"Expected one match in {path}, found {count}: {old[:120]!r}")
    target.write_text(text.replace(old, new, 1))


# Game setup: surface paused games without cluttering normal setup.
replace_once(
    "components/GameSetup.tsx",
    'import {\n  BestOfLegs,\n  CompetitionFormat,\n  RotationMode,\n  ScoreEntryMode,\n  TeamSize,\n} from "@/lib/types";\n',
    'import {\n  BestOfLegs,\n  CompetitionFormat,\n  RotationMode,\n  ScoreEntryMode,\n  TeamSize,\n} from "@/lib/types";\nimport type { PausedCasualGame } from "@/lib/persistence/casualSavedGames";\nimport { PausedCasualGamesPanel } from "@/components/PausedCasualGamesPanel";\n',
)
replace_once(
    "components/GameSetup.tsx",
    '  setDummyScore: (dummyScore: number) => void;\n};\n',
    '  setDummyScore: (dummyScore: number) => void;\n  pausedGames: PausedCasualGame[];\n  resumePausedGame: (id: string) => void;\n  deletePausedGame: (id: string) => void;\n};\n',
)
replace_once(
    "components/GameSetup.tsx",
    '  setRotationMode,\n  setDummyScore,\n}: GameSetupProps) {\n',
    '  setRotationMode,\n  setDummyScore,\n  pausedGames,\n  resumePausedGame,\n  deletePausedGame,\n}: GameSetupProps) {\n',
)
replace_once(
    "components/GameSetup.tsx",
    '          Choose individual or team play, enter the players, and set the X01 rules.\n          Starting the match opens the focused scoring board.\n',
    '          Choose individual or team play, enter the players, and set the X01 rules.\n          Starting the match opens the focused scoring interface.\n',
)
replace_once(
    "components/GameSetup.tsx",
    '        <div className="space-y-5">\n          <section className="rounded-2xl border border-[var(--color-panel-border)] bg-[var(--color-panel)] p-5">\n',
    '        <div className="space-y-5">\n          <PausedCasualGamesPanel\n            games={pausedGames}\n            onResume={resumePausedGame}\n            onDelete={deletePausedGame}\n          />\n\n          <section className="rounded-2xl border border-[var(--color-panel-border)] bg-[var(--color-panel)] p-5">\n',
)

# Shared graphical scorer terminology + optional casual Exit Game hook.
replace_once(
    "components/DartEntry.tsx",
    'import { getDartLabel } from "@/lib/darts";\nimport { evaluateX01Turn } from "@/lib/x01Engine";\n',
    'import { getDartLabel } from "@/lib/darts";\nimport { evaluateX01Turn } from "@/lib/x01Engine";\nimport type { ScoringViewSessionState } from "@/lib/types";\n',
)
replace_once(
    "components/DartEntry.tsx",
    '  dummyScore: number;\n  submitDummyScore: () => void;\n};\n',
    '  dummyScore: number;\n  submitDummyScore: () => void;\n  initialSessionState?: ScoringViewSessionState | null;\n  onSessionStateChange?: (state: ScoringViewSessionState) => void;\n  onExitGame?: () => void;\n};\n',
)
replace_once(
    "components/DartEntry.tsx",
    'type DartInputStyle = "board" | "numeric";\n',
    'type DartInputStyle = ScoringViewSessionState["dartInputStyle"];\n',
)
replace_once(
    "components/DartEntry.tsx",
    '  dummyScore,\n  submitDummyScore,\n}: DartEntryProps) {\n  const [currentDarts, setCurrentDarts] = useState<DartThrow[]>([]);\n  const [isBoardFullscreen, setIsBoardFullscreen] = useState(() => {\n    if (typeof window === "undefined") {\n      return false;\n    }\n\n    return (\n      window.sessionStorage.getItem(FULLSCREEN_BOARD_ACTIVE_STORAGE_KEY) ===\n      "true"\n    );\n  });\n',
    '  dummyScore,\n  submitDummyScore,\n  initialSessionState,\n  onSessionStateChange,\n  onExitGame,\n}: DartEntryProps) {\n  const [currentDarts, setCurrentDarts] = useState<DartThrow[]>(\n    initialSessionState?.currentDarts ?? [],\n  );\n  const [isBoardFullscreen, setIsBoardFullscreen] = useState(() => {\n    if (initialSessionState) {\n      return initialSessionState.isScoringView;\n    }\n\n    if (typeof window === "undefined") {\n      return false;\n    }\n\n    return (\n      window.sessionStorage.getItem(FULLSCREEN_BOARD_ACTIVE_STORAGE_KEY) ===\n      "true"\n    );\n  });\n',
)
replace_once(
    "components/DartEntry.tsx",
    '  const [hasAutoOpenedBoard, setHasAutoOpenedBoard] = useState(false);\n  const [dartInputStyle, setDartInputStyle] = useState<DartInputStyle>("board");\n  const [numericMultiplier, setNumericMultiplier] = useState<1 | 2 | 3 | null>(\n    null,\n  );\n  const [showFullscreenScorecard, setShowFullscreenScorecard] = useState(false);\n',
    '  const [hasAutoOpenedBoard, setHasAutoOpenedBoard] = useState(false);\n  const [dartInputStyle, setDartInputStyle] = useState<DartInputStyle>(\n    initialSessionState?.dartInputStyle ?? "board",\n  );\n  const [numericMultiplier, setNumericMultiplier] = useState<1 | 2 | 3 | null>(\n    initialSessionState?.numericMultiplier ?? null,\n  );\n  const [showFullscreenScorecard, setShowFullscreenScorecard] = useState(\n    initialSessionState?.showScorecard ?? false,\n  );\n',
)
replace_once(
    "components/DartEntry.tsx",
    '  }, [isBoardFullscreen, shouldShowBoardFullscreen]);\n\n  function setAutoFullscreenPreference(enabled: boolean) {\n',
    '  }, [isBoardFullscreen, shouldShowBoardFullscreen]);\n\n  useEffect(() => {\n    onSessionStateChange?.({\n      currentDarts,\n      dartInputStyle,\n      numericMultiplier,\n      isScoringView: isBoardFullscreen,\n      showScorecard: showFullscreenScorecard,\n    });\n  }, [\n    currentDarts,\n    dartInputStyle,\n    isBoardFullscreen,\n    numericMultiplier,\n    onSessionStateChange,\n    showFullscreenScorecard,\n  ]);\n\n  function setAutoFullscreenPreference(enabled: boolean) {\n',
)
replace_once(
    "components/DartEntry.tsx",
    '        title="Automatically open the full-screen board while Game Mode is active"\n      >\n        {autoFullscreenBoard ? "Auto full screen: On" : "Auto full screen: Off"}\n',
    '        title="Automatically open Scoring View while a match is active"\n      >\n        {autoFullscreenBoard ? "Auto Scoring View: On" : "Auto Scoring View: Off"}\n',
)
replace_once(
    "components/DartEntry.tsx",
    '                    Full screen board\n',
    '                    Scoring View\n',
)
replace_once(
    "components/DartEntry.tsx",
    '                      Exit\n                    </button>\n                  </div>\n                </div>\n',
    '                      App View\n                    </button>\n                  </div>\n\n                  {onExitGame && (\n                    <div className="flex justify-end border-t border-white/10 pt-2">\n                      <button\n                        type="button"\n                        onClick={onExitGame}\n                        className="rounded-lg border border-[var(--color-danger)]/40 bg-[var(--color-danger)]/10 px-3 py-2 text-xs font-bold text-white/80 hover:bg-[var(--color-danger)]/20"\n                      >\n                        Exit Game\n                      </button>\n                    </div>\n                  )}\n                </div>\n',
)

# Casual scorer: load/save transient input, paused slots, pause/discard/resume flows.
replace_once(
    "app/casual/page.tsx",
    '  ScoreEntryMode,\n} from "@/lib/types";\n',
    '  ScoreEntryMode,\n  ScoringViewSessionState,\n} from "@/lib/types";\n',
)
replace_once(
    "app/casual/page.tsx",
    'import { FeedbackModal } from "@/components/FeedbackModal";\n',
    'import { FeedbackModal } from "@/components/FeedbackModal";\nimport { CasualExitGameDialog } from "@/components/CasualExitGameDialog";\n',
)
replace_once(
    "app/casual/page.tsx",
    'import { SyncCoordinator } from "@/components/SyncCoordinator";\n',
    'import { SyncCoordinator } from "@/components/SyncCoordinator";\nimport {\n  deletePausedCasualGame,\n  listPausedCasualGames,\n  savePausedCasualGame,\n  type PausedCasualGame,\n} from "@/lib/persistence/casualSavedGames";\n',
)
replace_once(
    "app/casual/page.tsx",
    '  const [pendingDartsUsedTurn, setPendingDartsUsedTurn] = useState<Turn | null>(\n    null,\n  );\n\n  const legsNeededToWin = Math.ceil(bestOfLegs / 2);\n',
    '  const [pendingDartsUsedTurn, setPendingDartsUsedTurn] = useState<Turn | null>(\n    null,\n  );\n  const [scoringViewSession, setScoringViewSession] =\n    useState<ScoringViewSessionState | null>(null);\n  const [pausedGames, setPausedGames] = useState<PausedCasualGame[]>([]);\n  const [isExitGameOpen, setIsExitGameOpen] = useState(false);\n\n  const legsNeededToWin = Math.ceil(bestOfLegs / 2);\n',
)
replace_once(
    "app/casual/page.tsx",
    '      setIsLegComplete(parsedMatch.isLegComplete ?? false);\n      setIsMatchComplete(parsedMatch.isMatchComplete ?? false);\n      setMessage(parsedMatch.message ?? "Player 1 to throw");\n',
    '      setIsLegComplete(parsedMatch.isLegComplete ?? false);\n      setIsMatchComplete(parsedMatch.isMatchComplete ?? false);\n      setMessage(parsedMatch.message ?? "Player 1 to throw");\n      setScoreInput(parsedMatch.scoreInput ?? "");\n      setPendingCheckoutTurn(parsedMatch.pendingCheckoutTurn ?? null);\n      setPendingDartsUsedTurn(parsedMatch.pendingDartsUsedTurn ?? null);\n      setScoringViewSession(parsedMatch.scoringViewSession ?? null);\n',
)
replace_once(
    "app/casual/page.tsx",
    '  }, []);\n  /* eslint-enable react-hooks/set-state-in-effect */\n\n  useEffect(() => {\n',
    '  }, []);\n\n  useEffect(() => {\n    setPausedGames(listPausedCasualGames());\n  }, []);\n  /* eslint-enable react-hooks/set-state-in-effect */\n\n  useEffect(() => {\n',
)
replace_once(
    "app/casual/page.tsx",
    '      isLegComplete,\n      isMatchComplete,\n      message,\n    };\n',
    '      isLegComplete,\n      isMatchComplete,\n      message,\n      scoreInput,\n      pendingCheckoutTurn,\n      pendingDartsUsedTurn,\n      scoringViewSession,\n    };\n',
)
replace_once(
    "app/casual/page.tsx",
    '    isLegComplete,\n    isMatchComplete,\n    message,\n  ]);\n',
    '    isLegComplete,\n    isMatchComplete,\n    message,\n    scoreInput,\n    pendingCheckoutTurn,\n    pendingDartsUsedTurn,\n    scoringViewSession,\n  ]);\n',
)

pause_helpers = '''  function getPausedParticipantNames() {\n    if (competitionFormat === "individual") {\n      return sides.map((side) => side.name);\n    }\n\n    const playerNames = sides.flatMap((side) =>\n      side.members.filter((member) => !member.isDummy).map((member) => member.name),\n    );\n    return playerNames.length > 0 ? playerNames : sides.map((side) => side.name);\n  }\n\n  function getPausedGameLabel() {\n    const finishLabel = finishRule === "double_out" ? "Double Out" : "Straight Out";\n    return `${startingScore} X01 · ${finishLabel} · Best of ${bestOfLegs}`;\n  }\n\n  function getSuggestedPausedGameName() {\n    const matchup = sides.map((side) => side.name).slice(0, 3).join(" vs ") || "Casual Game";\n    return `${matchup} · ${startingScore} · ${new Date().toLocaleDateString()}`;\n  }\n\n  function getCurrentSavedMatchState(): SavedMatchState {\n    return {\n      matchId: matchId || undefined,\n      matchCreatedAt: matchCreatedAt ?? undefined,\n      startingScore,\n      competitionFormat,\n      individualPlayerNames,\n      finishRule,\n      bestOfLegs,\n      scoreEntryMode,\n      themeName,\n      brandName,\n      refreshBehavior,\n      activeView: "score",\n      isGameModeActive: true,\n      defaultScoreLayout,\n      rotationMode,\n      dummyScore,\n      sideOneSize,\n      sideTwoSize,\n      teamOneName,\n      teamTwoName,\n      teamOneMemberNames,\n      teamTwoMemberNames,\n      sides,\n      currentSideIndex,\n      startingSideIndex,\n      currentLegNumber,\n      startingMemberIndexBySide,\n      turnHistory,\n      completedLegs,\n      isLegComplete,\n      isMatchComplete,\n      message,\n      scoreInput,\n      pendingCheckoutTurn,\n      pendingDartsUsedTurn,\n      scoringViewSession,\n    };\n  }\n\n  function clearActiveCasualGame(status: string) {\n    localStorage.removeItem(savedMatchKey);\n    sessionStorage.removeItem("dart-scorekeeper-fullscreen-board-active");\n\n    setMatchId("");\n    setMatchCreatedAt(null);\n    setSides([\n      createTeamSide("side-1", "Player 1", ["Player 1"], startingScore),\n      createTeamSide("side-2", "Player 2", ["Player 2"], startingScore),\n    ]);\n    setCurrentSideIndex(0);\n    setStartingSideIndex(0);\n    setCurrentLegNumber(1);\n    setStartingMemberIndexBySide({ "side-1": 0, "side-2": 0 });\n    setTurnHistory([]);\n    setCompletedLegs([]);\n    setScoreInput("");\n    setPendingCheckoutTurn(null);\n    setPendingDartsUsedTurn(null);\n    setScoringViewSession(null);\n    setIsLegComplete(false);\n    setIsMatchComplete(false);\n    setIsGameModeActive(false);\n    setIsGameMenuOpen(false);\n    setIsExitGameOpen(false);\n    setActiveView("game");\n    setMessage(status);\n  }\n\n  function pauseCurrentGame(name: string) {\n    if (isMatchComplete) return;\n\n    const pausedAt = Date.now();\n    const pausedId = matchId || createMatchId();\n    const state = { ...getCurrentSavedMatchState(), matchId: pausedId };\n\n    try {\n      const next = savePausedCasualGame({\n        schemaVersion: 1,\n        id: pausedId,\n        name,\n        gameType: "x01",\n        gameLabel: getPausedGameLabel(),\n        participantNames: getPausedParticipantNames(),\n        pausedAt,\n        state,\n      });\n      setPausedGames(next);\n      clearActiveCasualGame(`Paused “${name}”.`);\n    } catch (error) {\n      setMessage(error instanceof Error ? error.message : "Could not pause this game.");\n    }\n  }\n\n  function discardCurrentGame() {\n    clearActiveCasualGame("Game discarded. No result or statistics were recorded.");\n  }\n\n  function resumePausedGame(id: string) {\n    const game = pausedGames.find((item) => item.id === id);\n    if (!game || game.gameType !== "x01") return;\n\n    const state = game.state as SavedMatchState;\n    if (!state || typeof state !== "object" || !Array.isArray(state.sides)) {\n      setMessage("This saved game could not be restored.");\n      return;\n    }\n\n    localStorage.setItem(\n      savedMatchKey,\n      JSON.stringify({ ...state, activeView: "score", isGameModeActive: true }),\n    );\n    sessionStorage.setItem(\n      "dart-scorekeeper-fullscreen-board-active",\n      String(state.scoringViewSession?.isScoringView === true),\n    );\n    setPausedGames(deletePausedCasualGame(id));\n    window.location.href = "/casual";\n  }\n\n  function deletePausedGame(id: string) {\n    setPausedGames(deletePausedCasualGame(id));\n  }\n\n'''
replace_once(
    "app/casual/page.tsx",
    '  function getCurrentThrowerName(side: MatchSide): string {\n',
    pause_helpers + '  function getCurrentThrowerName(side: MatchSide): string {\n',
)
replace_once(
    "app/casual/page.tsx",
    '        submitDummyScore={submitDummyScore}\n      />\n',
    '        submitDummyScore={submitDummyScore}\n        initialSessionState={scoringViewSession}\n        onSessionStateChange={setScoringViewSession}\n        onExitGame={() => setIsExitGameOpen(true)}\n      />\n',
)
replace_once(
    "app/casual/page.tsx",
    '            cancelClearSavedMatch={cancelClearSavedMatch}\n          />\n',
    '            cancelClearSavedMatch={cancelClearSavedMatch}\n            pausedGames={pausedGames}\n            resumePausedGame={resumePausedGame}\n            deletePausedGame={deletePausedGame}\n          />\n',
)
replace_once(
    "app/casual/page.tsx",
    '                <button type="button" onClick={() => { window.location.href = "/"; }} className="rounded-xl border border-rose-500/40 bg-rose-500/10 px-4 py-3 text-left font-bold text-rose-100 hover:bg-rose-500/20">Exit to Home</button>\n',
    '                <button type="button" onClick={() => { setIsGameMenuOpen(false); setIsExitGameOpen(true); }} className="rounded-xl border border-slate-700 bg-slate-900 px-4 py-3 text-left font-bold text-slate-100 hover:bg-slate-800">Exit Game…</button>\n',
)
replace_once(
    "app/casual/page.tsx",
    '                {renderScoreCards()}\n              </div>\n            </div>\n          </>\n',
    '                {renderScoreCards()}\n              </div>\n            </div>\n\n            {!isMatchComplete && (\n              <div className="mt-2 flex justify-end">\n                <button\n                  type="button"\n                  onClick={() => setIsExitGameOpen(true)}\n                  className="rounded-lg border border-[var(--color-panel-border)] bg-[var(--color-panel)] px-3 py-2 text-xs font-bold text-[var(--color-text-muted)] hover:bg-[var(--color-panel-soft)] hover:text-[var(--color-text-main)]"\n                >\n                  Exit Game\n                </button>\n              </div>\n            )}\n          </>\n',
)
replace_once(
    "app/casual/page.tsx",
    '        <FeedbackModal\n',
    '        {isExitGameOpen && !isMatchComplete && (\n          <CasualExitGameDialog\n            games={pausedGames}\n            suggestedName={getSuggestedPausedGameName()}\n            onCancel={() => setIsExitGameOpen(false)}\n            onPause={pauseCurrentGame}\n            onDiscard={discardCurrentGame}\n            onDeleteSavedGame={deletePausedGame}\n          />\n        )}\n        <FeedbackModal\n',
)

# Changelog + durable CI coverage.
replace_once(
    "CHANGELOG.md",
    '### Added\n- Casual X01 now supports any number of individual players, with independent scores and circular turn order.\n',
    '### Added\n- Casual games can now be paused into up to five named local save slots and resumed later with exact score, turn, leg, history, checkout-prompt, and in-progress dart-entry state preserved.\n- Active casual games now have a small Exit Game action with explicit Pause Game and confirmed Discard Game paths; paused/discarded games never enter completed-match statistics.\n- Casual X01 now supports any number of individual players, with independent scores and circular turn order.\n',
)
replace_once(
    "CHANGELOG.md",
    '### Changed\n- Grouped the scorer navigation into Play and Manage areas; renamed Game to New Match, App to Settings, and Game Mode to Focused Play.\n',
    '### Changed\n- Renamed the dedicated dart-entry interface to Scoring View and its presentation-only return control to App View across casual and league scoring.\n- Updated preview version to v0.5.0-alpha.19 for casual pause/discard handling and scoring-view terminology.\n- Grouped the scorer navigation into Play and Manage areas; renamed Game to New Match, App to Settings, and Game Mode to Focused Play.\n',
)
replace_once(
    ".github/workflows/portable-persistence.yml",
    '      - name: Exercise browser archive queue contract\n        run: npm run local:test\n\n',
    '      - name: Exercise browser archive queue contract\n        run: npm run local:test\n\n      - name: Exercise paused casual game storage contract\n        run: npm run casual-saves:test\n\n',
)

print("Applied casual pause/discard and Scoring View update.")
