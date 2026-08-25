from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

def replace_once(path: str, old: str, new: str) -> None:
    target = ROOT / path
    text = target.read_text()
    count = text.count(old)
    if count != 1:
        raise RuntimeError(f"Expected one match in {path}, found {count}: {old[:120]!r}")
    target.write_text(text.replace(old, new, 1))

# Setup resume list.
replace_once(
    "components/GameSetup.tsx",
    '} from "@/lib/types";\n\ntype GameSetupProps = {\n',
    '} from "@/lib/types";\nimport type { PausedCasualGame } from "@/lib/persistence/casualSavedGames";\nimport { PausedCasualGamesPanel } from "@/components/PausedCasualGamesPanel";\n\ntype GameSetupProps = {\n',
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
    '      <h2 className="text-2xl font-bold mb-6">Game Setup</h2>\n\n',
    '      <h2 className="text-2xl font-bold mb-6">Game Setup</h2>\n\n      {pausedGames.length > 0 && (\n        <div className="mb-8">\n          <PausedCasualGamesPanel\n            games={pausedGames}\n            onResume={resumePausedGame}\n            onDelete={deletePausedGame}\n          />\n        </div>\n      )}\n\n',
)

# Shared DartEntry naming and transient-state handoff.
replace_once(
    "components/DartEntry.tsx",
    'import { useEffect, useState } from "react";\n',
    'import { useEffect, useRef, useState } from "react";\n',
)
replace_once(
    "components/DartEntry.tsx",
    'import { getDartLabel } from "@/lib/darts";\n',
    'import { getDartLabel } from "@/lib/darts";\nimport type { ScoringViewSessionState } from "@/lib/types";\n',
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
    '  dummyScore,\n  submitDummyScore,\n}: DartEntryProps) {\n  const [currentDarts, setCurrentDarts] = useState<DartThrow[]>([]);\n  const [isBoardFullscreen, setIsBoardFullscreen] = useState(() => {\n    if (typeof window === "undefined") {\n',
    '  dummyScore,\n  submitDummyScore,\n  initialSessionState,\n  onSessionStateChange,\n  onExitGame,\n}: DartEntryProps) {\n  const [currentDarts, setCurrentDarts] = useState<DartThrow[]>(initialSessionState?.currentDarts ?? []);\n  const hasAppliedInitialSessionState = useRef(initialSessionState != null);\n  const [isBoardFullscreen, setIsBoardFullscreen] = useState(() => {\n    if (initialSessionState) return initialSessionState.isScoringView;\n    if (typeof window === "undefined") {\n',
)
replace_once(
    "components/DartEntry.tsx",
    '  const [hasAutoOpenedBoard, setHasAutoOpenedBoard] = useState(false);\n  const [dartInputStyle, setDartInputStyle] = useState<DartInputStyle>("board");\n  const [numericMultiplier, setNumericMultiplier] = useState<1 | 2 | 3 | null>(\n    null,\n  );\n  const [showFullscreenScorecard, setShowFullscreenScorecard] = useState(false);\n',
    '  const [hasAutoOpenedBoard, setHasAutoOpenedBoard] = useState(false);\n  const [dartInputStyle, setDartInputStyle] = useState<DartInputStyle>(initialSessionState?.dartInputStyle ?? "board");\n  const [numericMultiplier, setNumericMultiplier] = useState<1 | 2 | 3 | null>(initialSessionState?.numericMultiplier ?? null);\n  const [showFullscreenScorecard, setShowFullscreenScorecard] = useState(initialSessionState?.showScorecard ?? false);\n',
)
replace_once(
    "components/DartEntry.tsx",
    '  useEffect(() => {\n    if (!shouldAutoOpenBoard || hasAutoOpenedBoard || isBoardFullscreen) {\n',
    '  useEffect(() => {\n    if (!initialSessionState || hasAppliedInitialSessionState.current) return;\n    hasAppliedInitialSessionState.current = true;\n    setCurrentDarts(initialSessionState.currentDarts);\n    setDartInputStyle(initialSessionState.dartInputStyle);\n    setNumericMultiplier(initialSessionState.numericMultiplier);\n    setIsBoardFullscreen(initialSessionState.isScoringView);\n    setShowFullscreenScorecard(initialSessionState.showScorecard);\n  }, [initialSessionState]);\n\n  useEffect(() => {\n    if (!shouldAutoOpenBoard || hasAutoOpenedBoard || isBoardFullscreen) {\n',
)
replace_once(
    "components/DartEntry.tsx",
    '  }, [isBoardFullscreen, shouldShowBoardFullscreen]);\n\n  function setAutoFullscreenPreference(enabled: boolean) {\n',
    '  }, [isBoardFullscreen, shouldShowBoardFullscreen]);\n\n  useEffect(() => {\n    onSessionStateChange?.({\n      currentDarts,\n      dartInputStyle,\n      numericMultiplier,\n      isScoringView: isBoardFullscreen,\n      showScorecard: showFullscreenScorecard,\n    });\n  }, [currentDarts, dartInputStyle, isBoardFullscreen, numericMultiplier, onSessionStateChange, showFullscreenScorecard]);\n\n  function setAutoFullscreenPreference(enabled: boolean) {\n',
)
replace_once("components/DartEntry.tsx", 'title="Automatically open the full-screen board while Game Mode is active"', 'title="Automatically open Scoring View while a match is active"')
replace_once("components/DartEntry.tsx", '{autoFullscreenBoard ? "Auto full screen: On" : "Auto full screen: Off"}', '{autoFullscreenBoard ? "Auto Scoring View: On" : "Auto Scoring View: Off"}')
replace_once("components/DartEntry.tsx", '                    Full screen board\n', '                    Scoring View\n')
replace_once(
    "components/DartEntry.tsx",
    '                      Exit\n                    </button>\n                  </div>\n                </div>\n',
    '                      App View\n                    </button>\n                  </div>\n\n                  {onExitGame && (\n                    <div className="flex justify-end border-t border-white/10 pt-2">\n                      <button type="button" onClick={onExitGame} className="rounded-lg border border-[var(--color-danger)]/40 bg-[var(--color-danger)]/10 px-3 py-2 text-xs font-bold text-white/80 hover:bg-[var(--color-danger)]/20">\n                        Exit Game\n                      </button>\n                    </div>\n                  )}\n                </div>\n',
)

# Page state and paused-game lifecycle.
replace_once("app/page.tsx", '  ScoreEntryMode,\n} from "@/lib/types";\n', '  ScoreEntryMode,\n  ScoringViewSessionState,\n} from "@/lib/types";\n')
replace_once("app/page.tsx", 'import { FeedbackModal } from "@/components/FeedbackModal";\n', 'import { FeedbackModal } from "@/components/FeedbackModal";\nimport { CasualExitGameDialog } from "@/components/CasualExitGameDialog";\n')
replace_once("app/page.tsx", 'import { SyncCoordinator } from "@/components/SyncCoordinator";\n', 'import { SyncCoordinator } from "@/components/SyncCoordinator";\nimport { deletePausedCasualGame, listPausedCasualGames, savePausedCasualGame, type PausedCasualGame } from "@/lib/persistence/casualSavedGames";\n')
replace_once(
    "app/page.tsx",
    '  const [pendingDartsUsedTurn, setPendingDartsUsedTurn] = useState<Turn | null>(\n    null,\n  );\n\n  const legsNeededToWin = Math.ceil(bestOfLegs / 2);\n',
    '  const [pendingDartsUsedTurn, setPendingDartsUsedTurn] = useState<Turn | null>(\n    null,\n  );\n  const [scoringViewSession, setScoringViewSession] = useState<ScoringViewSessionState | null>(null);\n  const [pausedGames, setPausedGames] = useState<PausedCasualGame[]>([]);\n  const [isExitGameOpen, setIsExitGameOpen] = useState(false);\n\n  const legsNeededToWin = Math.ceil(bestOfLegs / 2);\n',
)
replace_once(
    "app/page.tsx",
    '      setIsMatchComplete(parsedMatch.isMatchComplete ?? false);\n      setMessage(parsedMatch.message ?? "Player 1 to throw");\n',
    '      setIsMatchComplete(parsedMatch.isMatchComplete ?? false);\n      setMessage(parsedMatch.message ?? "Player 1 to throw");\n      setScoreInput(parsedMatch.scoreInput ?? "");\n      setPendingCheckoutTurn(parsedMatch.pendingCheckoutTurn ?? null);\n      setPendingDartsUsedTurn(parsedMatch.pendingDartsUsedTurn ?? null);\n      setScoringViewSession(parsedMatch.scoringViewSession ?? null);\n',
)
replace_once(
    "app/page.tsx",
    '  }, []);\n  /* eslint-enable react-hooks/set-state-in-effect */\n\n  useEffect(() => {\n',
    '  }, []);\n\n  useEffect(() => { setPausedGames(listPausedCasualGames()); }, []);\n  /* eslint-enable react-hooks/set-state-in-effect */\n\n  useEffect(() => {\n',
)
replace_once(
    "app/page.tsx",
    '      isMatchComplete,\n      message,\n    };\n',
    '      isMatchComplete,\n      message,\n      scoreInput,\n      pendingCheckoutTurn,\n      pendingDartsUsedTurn,\n      scoringViewSession,\n    };\n',
)
replace_once(
    "app/page.tsx",
    '    isMatchComplete,\n    message,\n  ]);\n',
    '    isMatchComplete,\n    message,\n    scoreInput,\n    pendingCheckoutTurn,\n    pendingDartsUsedTurn,\n    scoringViewSession,\n  ]);\n',
)

helpers = '''  function getPausedParticipantNames() {\n    if (competitionFormat === "individual") return sides.map((side) => side.name);\n    const names = sides.flatMap((side) => side.members.filter((member) => !member.isDummy).map((member) => member.name));\n    return names.length > 0 ? names : sides.map((side) => side.name);\n  }\n\n  function getPausedGameLabel() {\n    return `${startingScore} X01 · ${finishRule === "double_out" ? "Double Out" : "Straight Out"} · Best of ${bestOfLegs}`;\n  }\n\n  function getSuggestedPausedGameName() {\n    const matchup = sides.map((side) => side.name).slice(0, 3).join(" vs ") || "Casual Game";\n    return `${matchup} · ${startingScore} · ${new Date().toLocaleDateString()}`;\n  }\n\n  function getCurrentSavedMatchState(): SavedMatchState {\n    return { matchId: matchId || undefined, matchCreatedAt: matchCreatedAt ?? undefined, startingScore, competitionFormat, individualPlayerNames, finishRule, bestOfLegs, scoreEntryMode, themeName, brandName, refreshBehavior, activeView: "score", isGameModeActive: true, defaultScoreLayout, rotationMode, dummyScore, sideOneSize, sideTwoSize, teamOneName, teamTwoName, teamOneMemberNames, teamTwoMemberNames, sides, currentSideIndex, startingSideIndex, currentLegNumber, startingMemberIndexBySide, turnHistory, completedLegs, isLegComplete, isMatchComplete, message, scoreInput, pendingCheckoutTurn, pendingDartsUsedTurn, scoringViewSession };\n  }\n\n  function clearActiveCasualGame(status: string) {\n    localStorage.removeItem(savedMatchKey);\n    sessionStorage.removeItem("dart-scorekeeper-fullscreen-board-active");\n    setMatchId(""); setMatchCreatedAt(null);\n    setSides([createTeamSide("side-1", "Player 1", ["Player 1"], startingScore), createTeamSide("side-2", "Player 2", ["Player 2"], startingScore)]);\n    setCurrentSideIndex(0); setStartingSideIndex(0); setCurrentLegNumber(1); setStartingMemberIndexBySide({ "side-1": 0, "side-2": 0 });\n    setTurnHistory([]); setCompletedLegs([]); setScoreInput(""); setPendingCheckoutTurn(null); setPendingDartsUsedTurn(null); setScoringViewSession(null);\n    setIsLegComplete(false); setIsMatchComplete(false); setIsGameModeActive(false); setIsGameMenuOpen(false); setIsExitGameOpen(false); setActiveView("game"); setMessage(status);\n  }\n\n  function pauseCurrentGame(name: string) {\n    if (isMatchComplete) return;\n    const pausedId = matchId || createMatchId();\n    try {\n      const next = savePausedCasualGame({ schemaVersion: 1, id: pausedId, name, gameType: "x01", gameLabel: getPausedGameLabel(), participantNames: getPausedParticipantNames(), pausedAt: Date.now(), state: { ...getCurrentSavedMatchState(), matchId: pausedId } });\n      setPausedGames(next); clearActiveCasualGame(`Paused “${name}”.`);\n    } catch (error) { setMessage(error instanceof Error ? error.message : "Could not pause this game."); }\n  }\n\n  function discardCurrentGame() { clearActiveCasualGame("Game discarded. No result or statistics were recorded."); }\n\n  function resumePausedGame(id: string) {\n    const game = pausedGames.find((item) => item.id === id);\n    if (!game || game.gameType !== "x01") return;\n    const state = game.state as SavedMatchState;\n    if (!state || typeof state !== "object" || !Array.isArray(state.sides)) { setMessage("This saved game could not be restored."); return; }\n    localStorage.setItem(savedMatchKey, JSON.stringify({ ...state, activeView: "score", isGameModeActive: true }));\n    sessionStorage.setItem("dart-scorekeeper-fullscreen-board-active", String(state.scoringViewSession?.isScoringView === true));\n    setPausedGames(deletePausedCasualGame(id));\n    window.location.href = "/";\n  }\n\n  function deletePausedGame(id: string) { setPausedGames(deletePausedCasualGame(id)); }\n\n'''
replace_once("app/page.tsx", '  function getCurrentThrowerName(side: MatchSide): string {\n', helpers + '  function getCurrentThrowerName(side: MatchSide): string {\n')
replace_once(
    "app/page.tsx",
    '        isCurrentThrowerDummy={isCurrentThrowerDummy()}\n        dummyScore={dummyScore}\n        submitDummyScore={submitDummyScore}\n      />\n    );\n  }\n\n  function getFeedbackDiagnostics() {\n',
    '        isCurrentThrowerDummy={isCurrentThrowerDummy()}\n        dummyScore={dummyScore}\n        submitDummyScore={submitDummyScore}\n        initialSessionState={scoringViewSession}\n        onSessionStateChange={setScoringViewSession}\n        onExitGame={() => setIsExitGameOpen(true)}\n      />\n    );\n  }\n\n  function getFeedbackDiagnostics() {\n',
)
replace_once(
    "app/page.tsx",
    '            cancelClearSavedMatch={cancelClearSavedMatch}\n          />\n',
    '            cancelClearSavedMatch={cancelClearSavedMatch}\n            pausedGames={pausedGames}\n            resumePausedGame={resumePausedGame}\n            deletePausedGame={deletePausedGame}\n          />\n',
)
replace_once(
    "app/page.tsx",
    '                {renderScoreCards()}\n              </div>\n            </div>\n          </>\n',
    '                {renderScoreCards()}\n              </div>\n            </div>\n\n            {!isMatchComplete && (\n              <div className="mt-2 flex justify-end">\n                <button type="button" onClick={() => setIsExitGameOpen(true)} className="rounded-lg border border-[var(--color-panel-border)] bg-[var(--color-panel)] px-3 py-2 text-xs font-bold text-[var(--color-text-muted)] hover:bg-[var(--color-panel-soft)] hover:text-[var(--color-text-main)]">Exit Game</button>\n              </div>\n            )}\n          </>\n',
)
replace_once(
    "app/page.tsx",
    '        <FeedbackModal\n',
    '        {isExitGameOpen && !isMatchComplete && (\n          <CasualExitGameDialog games={pausedGames} suggestedName={getSuggestedPausedGameName()} onCancel={() => setIsExitGameOpen(false)} onPause={pauseCurrentGame} onDiscard={discardCurrentGame} onDeleteSavedGame={deletePausedGame} />\n        )}\n        <FeedbackModal\n',
)

replace_once(
    "CHANGELOG.md",
    '### Added\n',
    '### Added\n- Casual games can be paused into up to five named local save slots and resumed with exact score, turn, leg, history, checkout-prompt, and in-progress dart-entry state preserved.\n- Active casual games now have an Exit Game action with Pause Game and confirmed Discard Game paths; paused/discarded games never enter completed-match statistics.\n',
)
replace_once(
    "CHANGELOG.md",
    '### Changed\n',
    '### Changed\n- Renamed the dedicated dart-entry interface to Scoring View and its presentation-only return control to App View.\n- Updated production version to v0.4.0-alpha.3.\n',
)
print("Applied production casual pause/discard update.")
