"use client";

import {
  BestOfLegs,
  CompetitionFormat,
  CompletedLeg,
  MatchPlayer,
  MatchSide,
  MatchType,
  PlayerStats,
  RotationMode,
  SavedMatchState,
  TeamSize,
  ThemeName,
  createTeamSide,
  RefreshBehavior,
  DefaultScoreLayout,
  ScoreEntryMode,
  ScoringViewSessionState,
} from "@/lib/types";

import { FeedbackModal } from "@/components/FeedbackModal";
import { CasualExitGameDialog } from "@/components/CasualExitGameDialog";
import { APP_VERSION } from "@/lib/appInfo";
import {
  buildCompletedX01MatchArchive,
  createMatchId,
  createMatchIdentity,
  queueLocalX01MatchArchive,
} from "@/lib/persistence";
import { DartEntry } from "@/components/DartEntry";
import { ScoreEntry } from "@/components/ScoreEntry";
import { GameSetup } from "@/components/GameSetup";
import { MatchSummary } from "@/components/MatchSummary";
import { CompletedLegs } from "@/components/CompletedLegs";
import { LocalMatchHistory } from "@/components/LocalMatchHistory";
import { TurnHistory } from "@/components/TurnHistory";
import { PlayerCard } from "@/components/PlayerCard";
import { useEffect, useState } from "react";
import { CurrentTurnBanner } from "@/components/CurrentTurnBanner";
import { AppSettings } from "@/components/AppSettings";
import { SyncCoordinator } from "@/components/SyncCoordinator";
import {
  deletePausedCasualGame,
  listPausedCasualGames,
  savePausedCasualGame,
  type PausedCasualGame,
} from "@/lib/persistence/casualSavedGames";
import {
  DartThrow,
  FinishRule,
  StartingScore,
  Turn,
  scoreTurn,
  validateTurnScore,
} from "@/lib/scoring";

type AppView = "score" | "game" | "league" | "app" | "stats" | "history";
type ScoreLayout = "compact" | "full";
type FeedbackType = "bug" | "feature" | "general";
type FeedbackSubmitStatus = "idle" | "submitting" | "success" | "error";

export default function Home() {
  const [feedbackSubmitStatus, setFeedbackSubmitStatus] =
    useState<FeedbackSubmitStatus>("idle");
  const [feedbackSubmitError, setFeedbackSubmitError] = useState("");

  // Visual theme.
  // This controls the CSS variable set used by the app shell and components.
  const [themeName, setThemeName] = useState<ThemeName>("default");

  // Feedback modal state.
  // The submit action will later send this to a hosted form endpoint.
  const [isFeedbackModalOpen, setIsFeedbackModalOpen] = useState(false);
  const [feedbackType, setFeedbackType] = useState<FeedbackType>("bug");
  const [feedbackMessage, setFeedbackMessage] = useState("");

  // Branding.
  // This is shown in the app header and can later be reused for TV displays/printouts.
  const [brandName, setBrandName] = useState("Dart Scorekeeper");

  // Refresh behavior.
  // Controls whether a browser refresh opens Score or restores the last tab.
  const [refreshBehavior, setRefreshBehavior] =
    useState<RefreshBehavior>("score");

  // Match setup options.
  // These control the X01 rules used when a new match is started.
  const [startingScore, setStartingScore] = useState<StartingScore>(501);
  const [competitionFormat, setCompetitionFormat] =
    useState<CompetitionFormat>("individual");
  const [individualPlayerNames, setIndividualPlayerNames] = useState<string[]>([
    "",
    "",
  ]);
  const [finishRule, setFinishRule] = useState<FinishRule>("double_out");
  const [bestOfLegs, setBestOfLegs] = useState<BestOfLegs>(3);

  // Score entry mode.
  // Total-turn entry is current behavior. Dart-by-dart will be added later.
  const [scoreEntryMode, setScoreEntryMode] = useState<ScoreEntryMode>("dart");

  // Legacy/simple match type.
  // Kept while old saved matches and older setup logic transition to side sizes.
  const [matchType, setMatchType] = useState<MatchType>("singles");

  // Team-size setup.
  // teamSize is kept as a compatibility/display value.
  // sideOneSize and sideTwoSize are the real current setup values.
  const [teamSize, setTeamSize] = useState<TeamSize>(1);
  const [sideOneSize, setSideOneSize] = useState<TeamSize>(1);
  const [sideTwoSize, setSideTwoSize] = useState<TeamSize>(1);

  // Score tab layout.
  // Compact mode is intended for tablets/phones during active play.
  const [scoreLayout, setScoreLayout] = useState<ScoreLayout>("compact");
  // Default score layout preference.
  // The Score tab can still be switched manually during use.
  const [defaultScoreLayout, setDefaultScoreLayout] =
    useState<DefaultScoreLayout>("compact");

  // Uneven-team rotation settings.
  // Independent mode lets each side rotate through only its listed members.
  // Dummy mode pads the shorter side with automatic-score missing-player slots.
  const [rotationMode, setRotationMode] = useState<RotationMode>("independent");

  const [dummyScore, setDummyScore] = useState(0);

  // App navigation.
  // Tabs keep setup, scoring, stats, and history separated for smaller screens.
  const [activeView, setActiveView] = useState<AppView>("game");
  const [isGameModeActive, setIsGameModeActive] = useState(false);
  const [isGameMenuOpen, setIsGameMenuOpen] = useState(false);

  // Durable local-first match identity. This ID is created in the browser,
  // survives refreshes, and will later be reused for idempotent sync.
  const [matchId, setMatchId] = useState("");
  const [matchCreatedAt, setMatchCreatedAt] = useState<number | null>(null);

  // Legacy/simple name fields.
  // These mostly exist to load older saved matches while the app transitions
  // to teamOneMemberNames/teamTwoMemberNames.
  const [playerOneName, setPlayerOneName] = useState("");
  const [playerTwoName, setPlayerTwoName] = useState("");
  const [teamOneName, setTeamOneName] = useState("");
  const [teamTwoName, setTeamTwoName] = useState("");
  const [teamOnePlayerTwoName, setTeamOnePlayerTwoName] = useState("");
  const [teamTwoPlayerTwoName, setTeamTwoPlayerTwoName] = useState("");
  // Current setup member names.
  // These arrays are now the main source for creating singles, doubles,
  // and larger team sides.
  const [teamOneMemberNames, setTeamOneMemberNames] = useState<string[]>([""]);

  const [teamTwoMemberNames, setTeamTwoMemberNames] = useState<string[]>([""]);

  // Active match sides.
  // A side can be one player, a doubles pair, or a larger team.
  // The side owns the score and legs won; members determine throw order.
  const [sides, setSides] = useState<MatchSide[]>([
    createTeamSide("side-1", "Player 1", ["Player 1"], 501),
    createTeamSide("side-2", "Player 2", ["Player 2"], 501),
  ]);

  // Active match progress.
  // currentSideIndex tells us which side is throwing now.
  // startingSideIndex alternates who starts each new leg.
  const [currentSideIndex, setCurrentSideIndex] = useState(0);
  const [startingSideIndex, setStartingSideIndex] = useState(0);
  const [currentLegNumber, setCurrentLegNumber] = useState(1);

  // Starting member rotation by side.
  // This lets doubles/team matches rotate who starts future legs.
  const [startingMemberIndexBySide, setStartingMemberIndexBySide] = useState<
    Record<string, number>
  >({
    "side-1": 0,
    "side-2": 0,
  });

  // Score entry and user-facing status.
  const [scoreInput, setScoreInput] = useState("");
  const [message, setMessage] = useState("Player 1 to throw");

  // Match history.
  // turnHistory is only the current leg.
  // completedLegs stores snapshots of finished legs.
  const [turnHistory, setTurnHistory] = useState<Turn[]>([]);
  const [completedLegs, setCompletedLegs] = useState<CompletedLeg[]>([]);

  // Completion flags.
  const [isLegComplete, setIsLegComplete] = useState(false);
  const [isMatchComplete, setIsMatchComplete] = useState(false);

  // Checkout confirmation flow.
  // Total-score entry cannot know whether the final dart was a double
  // or how many darts were used, so the UI asks after a possible checkout.
  const [pendingCheckoutTurn, setPendingCheckoutTurn] = useState<Turn | null>(
    null,
  );

  const [pendingDartsUsedTurn, setPendingDartsUsedTurn] = useState<Turn | null>(
    null,
  );
  const [scoringViewSession, setScoringViewSession] =
    useState<ScoringViewSessionState | null>(null);
  const [pausedGames, setPausedGames] = useState<PausedCasualGame[]>([]);
  const [isExitGameOpen, setIsExitGameOpen] = useState(false);

  const legsNeededToWin = Math.ceil(bestOfLegs / 2);

  const quickScores = [26, 41, 45, 60, 81, 85, 100, 121, 140, 180];

  const keypadButtons = [
    "1",
    "2",
    "3",
    "4",
    "5",
    "6",
    "7",
    "8",
    "9",
    "C",
    "0",
    "⌫",
  ];

  function normalizeSavedSides(
    savedSides: Array<MatchSide | MatchPlayer>,
  ): MatchSide[] {
    return savedSides.map((savedSide, index) => {
      if ("members" in savedSide && savedSide.members.length > 0) {
        return savedSide;
      }

      return {
        id: savedSide.id,
        name: savedSide.name,
        score: savedSide.score,
        legsWon: savedSide.legsWon,
        members: [
          {
            id: `player-${index + 1}`,
            name: savedSide.name,
          },
        ],
        currentMemberIndex: 0,
      };
    });
  }

  const savedMatchKey = "dart-scorekeeper-current-match";
  const [hasLoadedSavedMatch, setHasLoadedSavedMatch] = useState(false);
  const [isResetConfirmationVisible, setIsResetConfirmationVisible] =
    useState(false);
  const [isClearSavedConfirmationVisible, setIsClearSavedConfirmationVisible] =
    useState(false);

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    const savedMatch = localStorage.getItem(savedMatchKey);

    if (!savedMatch) {
      setHasLoadedSavedMatch(true);
      return;
    }

    try {
      const parsedMatch = JSON.parse(savedMatch) as SavedMatchState;

      // Older local saves predate durable match IDs. Assign one once during
      // load so subsequent saves/sync retries refer to the same match.
      setMatchId(parsedMatch.matchId ?? createMatchId());
      setMatchCreatedAt(parsedMatch.matchCreatedAt ?? Date.now());

      setStartingScore(parsedMatch.startingScore);
      setFinishRule(parsedMatch.finishRule);
      setBestOfLegs(parsedMatch.bestOfLegs);
      setScoreEntryMode(parsedMatch.scoreEntryMode ?? "turn");
      setMatchType(parsedMatch.matchType ?? "singles");

      const loadedSideOneSize =
        parsedMatch.sideOneSize ??
        parsedMatch.teamSize ??
        (parsedMatch.matchType === "doubles" ? 2 : 1);

      const loadedSideTwoSize =
        parsedMatch.sideTwoSize ??
        parsedMatch.teamSize ??
        (parsedMatch.matchType === "doubles" ? 2 : 1);

      const loadedSides = normalizeSavedSides(
        parsedMatch.sides ?? parsedMatch.players ?? [],
      );
      const loadedCompetitionFormat =
        parsedMatch.competitionFormat ??
        (loadedSides.length > 2 ||
        (loadedSideOneSize === 1 && loadedSideTwoSize === 1)
          ? "individual"
          : "team");

      setCompetitionFormat(loadedCompetitionFormat);
      setIndividualPlayerNames(
        parsedMatch.individualPlayerNames ??
          (loadedCompetitionFormat === "individual" && loadedSides.length >= 2
            ? loadedSides.map((side) => side.name)
            : [
                parsedMatch.playerOneName ?? "Player 1",
                parsedMatch.playerTwoName ?? "Player 2",
              ]),
      );

      setThemeName(parsedMatch.themeName ?? "default");

      setBrandName(parsedMatch.brandName ?? "Dart Scorekeeper");

      const loadedDefaultScoreLayout =
        parsedMatch.defaultScoreLayout ?? "compact";

      setDefaultScoreLayout(loadedDefaultScoreLayout);
      setScoreLayout(loadedDefaultScoreLayout);

      const loadedRefreshBehavior = parsedMatch.refreshBehavior ?? "score";
      setRefreshBehavior(loadedRefreshBehavior);
      const restoredView =
        loadedRefreshBehavior === "last"
          ? (parsedMatch.activeView ?? "score")
          : "score";
      setActiveView(restoredView === "league" ? "game" : restoredView);
      setIsGameModeActive(parsedMatch.isGameModeActive ?? false);

      setSideOneSize(loadedSideOneSize);
      setSideTwoSize(loadedSideTwoSize);
      setTeamSize(Math.max(loadedSideOneSize, loadedSideTwoSize) as TeamSize);

      setRotationMode(parsedMatch.rotationMode ?? "independent");
      setDummyScore(parsedMatch.dummyScore ?? 0);

      setPlayerOneName(parsedMatch.playerOneName ?? "Player 1");
      setPlayerTwoName(parsedMatch.playerTwoName ?? "Player 2");
      setTeamOneName(parsedMatch.teamOneName ?? "Team 1");
      setTeamTwoName(parsedMatch.teamTwoName ?? "Team 2");
      setTeamOnePlayerTwoName(parsedMatch.teamOnePlayerTwoName ?? "Player 1B");
      setTeamTwoPlayerTwoName(parsedMatch.teamTwoPlayerTwoName ?? "Player 2B");

      setTeamOneMemberNames(
        parsedMatch.teamOneMemberNames ??
        [
          parsedMatch.playerOneName ?? "Player 1",
          parsedMatch.teamOnePlayerTwoName ?? "Player 1B",
        ].slice(0, loadedSideOneSize),
      );

      setTeamTwoMemberNames(
        parsedMatch.teamTwoMemberNames ??
        [
          parsedMatch.playerTwoName ?? "Player 2",
          parsedMatch.teamTwoPlayerTwoName ?? "Player 2B",
        ].slice(0, loadedSideTwoSize),
      );

      setSides(loadedSides);
      setCurrentSideIndex(
        parsedMatch.currentSideIndex ?? parsedMatch.currentPlayerIndex ?? 0,
      );
      setStartingSideIndex(
        parsedMatch.startingSideIndex ?? parsedMatch.startingPlayerIndex ?? 0,
      );
      setCurrentLegNumber(parsedMatch.currentLegNumber);
      setStartingMemberIndexBySide(
        parsedMatch.startingMemberIndexBySide ?? {
          "side-1": 0,
          "side-2": 0,
        },
      );
      setTurnHistory(parsedMatch.turnHistory ?? []);
      setCompletedLegs(parsedMatch.completedLegs ?? []);
      setIsLegComplete(parsedMatch.isLegComplete ?? false);
      setIsMatchComplete(parsedMatch.isMatchComplete ?? false);
      setMessage(parsedMatch.message ?? "Player 1 to throw");
      setScoreInput(parsedMatch.scoreInput ?? "");
      setPendingCheckoutTurn(parsedMatch.pendingCheckoutTurn ?? null);
      setPendingDartsUsedTurn(parsedMatch.pendingDartsUsedTurn ?? null);
      setScoringViewSession(parsedMatch.scoringViewSession ?? null);
    } catch {
      localStorage.removeItem(savedMatchKey);
    } finally {
      setHasLoadedSavedMatch(true);
    }
  }, []);

  useEffect(() => {
    setPausedGames(listPausedCasualGames());
  }, []);
  /* eslint-enable react-hooks/set-state-in-effect */

  useEffect(() => {
    if (!hasLoadedSavedMatch) {
      return;
    }

    const matchState: SavedMatchState = {
      matchId: matchId || undefined,
      matchCreatedAt: matchCreatedAt ?? undefined,
      startingScore,
      competitionFormat,
      individualPlayerNames,
      finishRule,
      bestOfLegs,
      scoreEntryMode,
      themeName,
      brandName,
      refreshBehavior,
      activeView,
      isGameModeActive,
      defaultScoreLayout,
      rotationMode,
      dummyScore,
      sideOneSize,
      sideTwoSize,
      teamOneName,
      teamTwoName,
      teamOneMemberNames,
      teamTwoMemberNames,
      sides,
      currentSideIndex,
      startingSideIndex,
      currentLegNumber,
      startingMemberIndexBySide,
      turnHistory,
      completedLegs,
      isLegComplete,
      isMatchComplete,
      message,
      scoreInput,
      pendingCheckoutTurn,
      pendingDartsUsedTurn,
      scoringViewSession,
    };
    localStorage.setItem(savedMatchKey, JSON.stringify(matchState));
  }, [
    hasLoadedSavedMatch,
    matchId,
    matchCreatedAt,
    startingScore,
    competitionFormat,
    individualPlayerNames,
    finishRule,
    bestOfLegs,
    scoreEntryMode,
    themeName,
    brandName,
    refreshBehavior,
    activeView,
    isGameModeActive,
    defaultScoreLayout,
    matchType,
    teamSize,
    rotationMode,
    dummyScore,
    sideOneSize,
    sideTwoSize,
    playerOneName,
    playerTwoName,
    teamOneName,
    teamTwoName,
    teamOnePlayerTwoName,
    teamTwoPlayerTwoName,
    teamOneMemberNames,
    teamTwoMemberNames,
    sides,
    currentSideIndex,
    startingSideIndex,
    currentLegNumber,
    startingMemberIndexBySide,
    turnHistory,
    completedLegs,
    isLegComplete,
    isMatchComplete,
    message,
    scoreInput,
    pendingCheckoutTurn,
    pendingDartsUsedTurn,
    scoringViewSession,
  ]);

  // Completed matches are copied into a separate IndexedDB archive queue.
  // Active scoring remains localStorage-driven and never waits for IndexedDB
  // or a network request. The durable match ID makes repeated effect/load runs
  // safe because queueLocalX01MatchArchive only stores each completed match once.
  useEffect(() => {
    if (!hasLoadedSavedMatch || !isMatchComplete || !matchId) {
      return;
    }

    try {
      const archive = buildCompletedX01MatchArchive({
        matchId,
        matchCreatedAt: matchCreatedAt ?? undefined,
        startingScore,
        finishRule,
        bestOfLegs,
        scoreEntryMode,
        rotationMode,
        dummyScore,
        sides,
        completedLegs,
        isMatchComplete,
      });

      void queueLocalX01MatchArchive(archive).catch((error) => {
        console.error("Could not queue completed match in IndexedDB.", error);
      });
    } catch (error) {
      console.error("Could not build completed match archive.", error);
    }
  }, [
    hasLoadedSavedMatch,
    isMatchComplete,
    matchId,
    matchCreatedAt,
    startingScore,
    finishRule,
    bestOfLegs,
    scoreEntryMode,
    rotationMode,
    dummyScore,
    sides,
    completedLegs,
  ]);

  function getDefaultTeamName(sideNumber: 1 | 2) {
    return sideNumber === 1 ? "Team A" : "Team B";
  }

  function getDefaultMemberName(sideNumber: 1 | 2, memberIndex: number) {
    const suffix = sideNumber === 1 ? "A" : "B";
    return `Player ${memberIndex + 1}-${suffix}`;
  }

  function resolveMemberNames(
    memberNames: string[],
    sideNumber: 1 | 2,
    sideSize: TeamSize,
  ) {
    return Array.from({ length: sideSize }, (_, index) => {
      return memberNames[index]?.trim() || getDefaultMemberName(sideNumber, index);
    });
  }

  function resizeSideOneMembers(size: TeamSize) {
    setSideOneSize(size);

    setTeamOneMemberNames((currentNames) =>
      Array.from({ length: size }, (_, index) => {
        return currentNames[index] ?? "";
      }),
    );

    const newOverallTeamSize = Math.max(size, sideTwoSize);
    setTeamSize(newOverallTeamSize as TeamSize);
    setMatchType(newOverallTeamSize === 1 ? "singles" : "doubles");
  }

  function resizeSideTwoMembers(size: TeamSize) {
    setSideTwoSize(size);

    setTeamTwoMemberNames((currentNames) =>
      Array.from({ length: size }, (_, index) => {
        return currentNames[index] ?? "";
      }),
    );

    const newOverallTeamSize = Math.max(sideOneSize, size);
    setTeamSize(newOverallTeamSize as TeamSize);
    setMatchType(newOverallTeamSize === 1 ? "singles" : "doubles");
  }

  function hasMatchActivity() {
    if (isMatchComplete) {
      return false;
    }

    return (
      turnHistory.length > 0 || completedLegs.length > 0 || currentLegNumber > 1
    );
  }

  function getTabClass(view: AppView) {
    return activeView === view
      ? "rounded-xl bg-[var(--color-primary)] px-4 py-3 font-bold text-white"
      : "rounded-xl bg-[var(--color-panel-soft)] hover:bg-[var(--color-panel-border)] px-4 py-3 font-bold text-[var(--color-text-muted)]";
  }

  function getGameMenuButtonClass(view: AppView) {
    return activeView === view
      ? "rounded-xl bg-blue-600 px-4 py-3 text-left font-bold text-white"
      : "rounded-xl bg-slate-800 px-4 py-3 text-left font-bold text-slate-100 hover:bg-slate-700";
  }

  function openGameMenuView(view: AppView) {
    setActiveView(view);
    setIsGameMenuOpen(false);
  }

  function getActiveViewLabel() {
    switch (activeView) {
      case "score":
        return "Score";
      case "game":
        return "New Match";
      case "league":
        return "League";
      case "app":
        return "Settings";
      case "stats":
        return "Stats";
      case "history":
        return "History";
    }
  }

  function addDummyMembersIfNeeded(
    side: MatchSide,
    targetSize: number,
  ): MatchSide {
    if (side.members.length >= targetSize) {
      return side;
    }

    const dummyMembers = Array.from(
      { length: targetSize - side.members.length },
      (_, index) => {
        const dummyNumber = side.members.length + index + 1;

        return {
          id: `${side.id}-dummy-${dummyNumber}`,
          name: `Missing Player ${dummyNumber}`,
          isDummy: true,
        };
      },
    );

    return {
      ...side,
      members: [...side.members, ...dummyMembers],
    };
  }

  function startNewGame() {
    const newMatchIdentity = createMatchIdentity();
    setMatchId(newMatchIdentity.id);
    setMatchCreatedAt(newMatchIdentity.createdAt);

    let newSides: MatchSide[];

    if (competitionFormat === "individual") {
      const playerCount = Math.max(2, individualPlayerNames.length);
      const resolvedPlayerNames = Array.from(
        { length: playerCount },
        (_, index) =>
          individualPlayerNames[index]?.trim() || `Player ${index + 1}`,
      );

      newSides = resolvedPlayerNames.map((playerName, index) =>
        createTeamSide(
          `side-${index + 1}`,
          playerName,
          [playerName],
          startingScore,
        ),
      );
    } else {
      const resolvedTeamOneMemberNames = resolveMemberNames(
        teamOneMemberNames,
        1,
        sideOneSize,
      );
      const resolvedTeamTwoMemberNames = resolveMemberNames(
        teamTwoMemberNames,
        2,
        sideTwoSize,
      );

      const sideOneName = teamOneName.trim() || getDefaultTeamName(1);
      const sideTwoName = teamTwoName.trim() || getDefaultTeamName(2);

      newSides = [
        createTeamSide(
          "side-1",
          sideOneName,
          resolvedTeamOneMemberNames,
          startingScore,
        ),
        createTeamSide(
          "side-2",
          sideTwoName,
          resolvedTeamTwoMemberNames,
          startingScore,
        ),
      ];

      if (rotationMode === "dummy" && sideOneSize !== sideTwoSize) {
        const targetSize = Math.max(sideOneSize, sideTwoSize);
        newSides = newSides.map((side) =>
          addDummyMembersIfNeeded(side, targetSize),
        );
      }
    }

    const initialMemberIndexes = Object.fromEntries(
      newSides.map((side) => [side.id, 0]),
    );

    setSides(newSides);
    setCurrentSideIndex(0);
    setStartingSideIndex(0);
    setCurrentLegNumber(1);
    setStartingMemberIndexBySide(initialMemberIndexes);
    setScoreInput("");
    setTurnHistory([]);
    setCompletedLegs([]);
    setIsLegComplete(false);
    setIsMatchComplete(false);
    setPendingCheckoutTurn(null);
    setPendingDartsUsedTurn(null);
    setIsGameModeActive(true);
    setIsGameMenuOpen(false);
    setMessage(getTurnDisplayName(newSides[0]));
  }

  function handleStartNewGame() {
    if (hasMatchActivity()) {
      setIsResetConfirmationVisible(true);
      return;
    }

    startNewGame();
    setActiveView("score");
  }

  function confirmResetMatch() {
    setIsResetConfirmationVisible(false);
    startNewGame();
    setActiveView("score");
  }

  function cancelResetMatch() {
    setIsResetConfirmationVisible(false);
  }

  function handleReplayMatch() {
    startNewGame();
    setActiveView("score");
  }

  function handleNewGameSetup() {
    setActiveView("game");
    setIsGameMenuOpen(false);
  }

  function handleViewFinishedGame() {
    setActiveView("history");
    setIsGameMenuOpen(false);
  }

  function resetAppToDefaults() {
    localStorage.removeItem(savedMatchKey);

    const resetSides: MatchSide[] = [
      createTeamSide("side-1", "Player 1", ["Player 1"], 501),
      createTeamSide("side-2", "Player 2", ["Player 2"], 501),
    ];

    setStartingScore(501);
    setCompetitionFormat("individual");
    setIndividualPlayerNames(["", ""]);
    setFinishRule("double_out");
    setBestOfLegs(3);
    setMatchType("singles");
    setTeamSize(1);
    setRotationMode("independent");
    setDummyScore(0);
    setSideOneSize(1);
    setSideTwoSize(1);
    setPlayerOneName("");
    setPlayerTwoName("");
    setTeamOneName("");
    setTeamTwoName("");
    setTeamOnePlayerTwoName("");
    setTeamTwoPlayerTwoName("");
    setTeamOneMemberNames([""]);
    setTeamTwoMemberNames([""]);
    setSides(resetSides);
    setCurrentSideIndex(0);
    setStartingSideIndex(0);
    setCurrentLegNumber(1);
    setBrandName("Dart Scorekeeper");
    setStartingMemberIndexBySide({
      "side-1": 0,
      "side-2": 0,
    });
    setScoreInput("");
    setTurnHistory([]);
    setCompletedLegs([]);
    setIsLegComplete(false);
    setIsMatchComplete(false);
    setPendingCheckoutTurn(null);
    setPendingDartsUsedTurn(null);
    setIsGameModeActive(false);
    setIsGameMenuOpen(false);
    setMatchId("");
    setMatchCreatedAt(null);
    setIsClearSavedConfirmationVisible(false);
    setMessage("Saved match cleared. Player 1 to throw.");
  }

  function clearSavedMatch() {
    setIsClearSavedConfirmationVisible(true);
  }

  function confirmClearSavedMatch() {
    resetAppToDefaults();
    setActiveView("score");
  }

  function cancelClearSavedMatch() {
    setIsClearSavedConfirmationVisible(false);
  }

  function getPausedParticipantNames() {
    if (competitionFormat === "individual") {
      return sides.map((side) => side.name);
    }

    const playerNames = sides.flatMap((side) =>
      side.members.filter((member) => !member.isDummy).map((member) => member.name),
    );
    return playerNames.length > 0 ? playerNames : sides.map((side) => side.name);
  }

  function getPausedGameLabel() {
    const finishLabel = finishRule === "double_out" ? "Double Out" : "Straight Out";
    return `${startingScore} X01 · ${finishLabel} · Best of ${bestOfLegs}`;
  }

  function getSuggestedPausedGameName() {
    const matchup = sides.map((side) => side.name).slice(0, 3).join(" vs ") || "Casual Game";
    return `${matchup} · ${startingScore} · ${new Date().toLocaleDateString()}`;
  }

  function getCurrentSavedMatchState(): SavedMatchState {
    return {
      matchId: matchId || undefined,
      matchCreatedAt: matchCreatedAt ?? undefined,
      startingScore,
      competitionFormat,
      individualPlayerNames,
      finishRule,
      bestOfLegs,
      scoreEntryMode,
      themeName,
      brandName,
      refreshBehavior,
      activeView: "score",
      isGameModeActive: true,
      defaultScoreLayout,
      rotationMode,
      dummyScore,
      sideOneSize,
      sideTwoSize,
      teamOneName,
      teamTwoName,
      teamOneMemberNames,
      teamTwoMemberNames,
      sides,
      currentSideIndex,
      startingSideIndex,
      currentLegNumber,
      startingMemberIndexBySide,
      turnHistory,
      completedLegs,
      isLegComplete,
      isMatchComplete,
      message,
      scoreInput,
      pendingCheckoutTurn,
      pendingDartsUsedTurn,
      scoringViewSession,
    };
  }

  function clearActiveCasualGame(status: string) {
    localStorage.removeItem(savedMatchKey);
    sessionStorage.removeItem("dart-scorekeeper-fullscreen-board-active");

    setMatchId("");
    setMatchCreatedAt(null);
    setSides([
      createTeamSide("side-1", "Player 1", ["Player 1"], startingScore),
      createTeamSide("side-2", "Player 2", ["Player 2"], startingScore),
    ]);
    setCurrentSideIndex(0);
    setStartingSideIndex(0);
    setCurrentLegNumber(1);
    setStartingMemberIndexBySide({ "side-1": 0, "side-2": 0 });
    setTurnHistory([]);
    setCompletedLegs([]);
    setScoreInput("");
    setPendingCheckoutTurn(null);
    setPendingDartsUsedTurn(null);
    setScoringViewSession(null);
    setIsLegComplete(false);
    setIsMatchComplete(false);
    setIsGameModeActive(false);
    setIsGameMenuOpen(false);
    setIsExitGameOpen(false);
    setActiveView("game");
    setMessage(status);
  }

  function pauseCurrentGame(name: string) {
    if (isMatchComplete) return;

    const pausedAt = Date.now();
    const pausedId = matchId || createMatchId();
    const state = { ...getCurrentSavedMatchState(), matchId: pausedId };

    try {
      const next = savePausedCasualGame({
        schemaVersion: 1,
        id: pausedId,
        name,
        gameType: "x01",
        gameLabel: getPausedGameLabel(),
        participantNames: getPausedParticipantNames(),
        pausedAt,
        state,
      });
      setPausedGames(next);
      clearActiveCasualGame(`Paused “${name}”.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not pause this game.");
    }
  }

  function discardCurrentGame() {
    clearActiveCasualGame("Game discarded. No result or statistics were recorded.");
  }

  function resumePausedGame(id: string) {
    const game = pausedGames.find((item) => item.id === id);
    if (!game || game.gameType !== "x01") return;

    const state = game.state as SavedMatchState;
    if (!state || typeof state !== "object" || !Array.isArray(state.sides)) {
      setMessage("This saved game could not be restored.");
      return;
    }

    localStorage.setItem(
      savedMatchKey,
      JSON.stringify({ ...state, activeView: "score", isGameModeActive: true }),
    );
    sessionStorage.setItem(
      "dart-scorekeeper-fullscreen-board-active",
      String(state.scoringViewSession?.isScoringView === true),
    );
    setPausedGames(deletePausedCasualGame(id));
    window.location.href = "/casual";
  }

  function deletePausedGame(id: string) {
    setPausedGames(deletePausedCasualGame(id));
  }

  function getCurrentThrowerName(side: MatchSide): string {
    return side.members[side.currentMemberIndex]?.name ?? side.name;
  }

  function getTurnDisplayName(side: MatchSide): string {
    const throwerName = getCurrentThrowerName(side);
    return competitionFormat === "individual"
      ? `${throwerName} to throw`
      : `${throwerName} (${side.name}) to throw`;
  }

  function getDartLabel(dart: DartThrow) {
    if (dart.segment === "miss") {
      return "Miss";
    }

    if (dart.segment === "outer-bull") {
      return "Outer Bull";
    }

    if (dart.segment === "bull") {
      return "Bull";
    }

    const prefix =
      dart.multiplier === 3 ? "T" : dart.multiplier === 2 ? "D" : "S";

    return `${prefix}${dart.segment}`;
  }

  function getDartSummary(darts: DartThrow[]) {
    return darts.map(getDartLabel).join(", ");
  }

  function getCurrentThrower(side: MatchSide) {
    return side.members[side.currentMemberIndex];
  }

  function isCurrentThrowerDummy() {
    const currentSide = sides[currentSideIndex];
    const currentThrower = getCurrentThrower(currentSide);

    return currentThrower?.isDummy === true;
  }

  function appendScoreDigit(digit: string) {
    if (
      isLegComplete ||
      isMatchComplete ||
      pendingCheckoutTurn ||
      pendingDartsUsedTurn
    ) {
      return;
    }

    setScoreInput((currentInput) => {
      const nextInput = `${currentInput}${digit}`;

      if (nextInput.length > 3) {
        return currentInput;
      }

      return nextInput;
    });
  }

  function backspaceScoreInput() {
    setScoreInput((currentInput) => currentInput.slice(0, -1));
  }

  function setQuickScore(score: number) {
    if (
      isLegComplete ||
      isMatchComplete ||
      pendingCheckoutTurn ||
      pendingDartsUsedTurn
    ) {
      return;
    }

    setScoreInput(String(score));
  }

  function submitScore() {
    if (isMatchComplete) {
      setMessage("The match is complete. Start/reset the game to play again.");
      return;
    }

    if (isLegComplete) {
      setMessage("The leg is complete. Start the next leg.");
      return;
    }

    if (pendingCheckoutTurn || pendingDartsUsedTurn) {
      setMessage("Finish the checkout prompt before entering another score.");
      return;
    }

    const validationError = validateTurnScore(scoreInput);

    if (validationError) {
      setMessage(validationError);
      return;
    }

    const currentSide = sides[currentSideIndex];
    const scoreEntered = Number(scoreInput);
    const result = scoreTurn(currentSide, scoreEntered, finishRule);

    const turnWithThrower: Turn = {
      ...result.turn,
      throwerId: currentSide.members[currentSide.currentMemberIndex]?.id,
      throwerName: getCurrentThrowerName(currentSide),
    };

    const resultWithThrower = {
      ...result,
      turn: turnWithThrower,
    };

    setScoreInput("");

    if (resultWithThrower.needsDoubleOutConfirmation) {
      setPendingCheckoutTurn(resultWithThrower.turn);
      setMessage(resultWithThrower.message);
      return;
    }

    if (resultWithThrower.isLegComplete) {
      setPendingDartsUsedTurn(resultWithThrower.turn);
      setMessage(
        `${resultWithThrower.turn.throwerName ?? resultWithThrower.turn.playerName} checked out. How many darts were used?`,
      );
      return;
    }

    setTurnHistory((previousHistory) => [
      resultWithThrower.turn,
      ...previousHistory,
    ]);

    if (!resultWithThrower.turn.isBust) {
      const updatedsides = [...sides];
      updatedsides[currentSideIndex] = {
        ...updatedsides[currentSideIndex],
        score: resultWithThrower.updatedPlayer.score,
        currentMemberIndex: getNextMemberIndex(updatedsides[currentSideIndex]),
      };
      setSides(updatedsides);
    } else {
      advanceCurrentSideMember();
    }

    const nextPlayerIndex = getNextSideIndex();
    setCurrentSideIndex(nextPlayerIndex);

    const nextTurn = getTurnDisplayName(sides[nextPlayerIndex]);
    setMessage(`${resultWithThrower.message} ${nextTurn}.`);
  }

  function submitDartTurn(darts: DartThrow[]) {
    if (isMatchComplete) {
      setMessage("The match is complete. Start/reset the game to play again.");
      return;
    }

    if (isLegComplete) {
      setMessage("The leg is complete. Start the next leg.");
      return;
    }

    if (pendingCheckoutTurn || pendingDartsUsedTurn) {
      setMessage("Finish the checkout prompt before entering another score.");
      return;
    }

    if (darts.length === 0 || darts.length > 3) {
      setMessage("Enter 1 to 3 darts before submitting the turn.");
      return;
    }

    const currentSide = sides[currentSideIndex];
    const currentThrower = getCurrentThrower(currentSide);
    const scoreEntered = darts.reduce((total, dart) => total + dart.score, 0);

    const result = scoreTurn(currentSide, scoreEntered, finishRule);

    let turnWithDarts: Turn = {
      ...result.turn,
      darts,
      dartsThrown: darts.length as 1 | 2 | 3,
      throwerId: currentThrower?.id,
      throwerName: currentThrower?.name ?? getCurrentThrowerName(currentSide),
      isDummy: currentThrower?.isDummy === true,
    };

    let resultWithDarts = {
      ...result,
      turn: turnWithDarts,
    };

    const isInvalidDoubleOutCheckout =
      resultWithDarts.needsDoubleOutConfirmation &&
      !isValidDartCheckout(darts, finishRule);

    if (isInvalidDoubleOutCheckout) {
      turnWithDarts = {
        ...turnWithDarts,
        scoreAfter: currentSide.score,
        isBust: true,
        isCheckout: false,
      };

      resultWithDarts = {
        ...resultWithDarts,
        turn: turnWithDarts,
        updatedPlayer: {
          ...currentSide,
          score: currentSide.score,
        },
        isLegComplete: false,
        needsDoubleOutConfirmation: false,
        message: `${turnWithDarts.throwerName ?? turnWithDarts.playerName
          } busts with ${getDartSummary(darts)}. Final dart was not a double.`,
      };
    }

    if (resultWithDarts.needsDoubleOutConfirmation) {
      resultWithDarts = {
        ...resultWithDarts,
        isLegComplete: true,
        needsDoubleOutConfirmation: false,
        message: `${resultWithDarts.turn.throwerName ?? resultWithDarts.turn.playerName
          } wins the leg!`,
      };
    }

    if (resultWithDarts.isLegComplete) {
      completeLegWithTurn(resultWithDarts.turn);
      return;
    }

    setTurnHistory((previousHistory) => [
      resultWithDarts.turn,
      ...previousHistory,
    ]);

    if (!resultWithDarts.turn.isBust) {
      const updatedSides = [...sides];

      updatedSides[currentSideIndex] = {
        ...updatedSides[currentSideIndex],
        score: resultWithDarts.updatedPlayer.score,
        currentMemberIndex: getNextMemberIndex(updatedSides[currentSideIndex]),
      };

      setSides(updatedSides);
    } else {
      advanceCurrentSideMember();
    }

    const nextSideIndex = getNextSideIndex();
    setCurrentSideIndex(nextSideIndex);

    const nextSide = sides[nextSideIndex];
    const nextTurn = getTurnDisplayName(nextSide);

    const dartSummary = getDartSummary(darts);
    const throwerName =
      resultWithDarts.turn.throwerName ?? resultWithDarts.turn.playerName;

    const turnMessage = isInvalidDoubleOutCheckout
      ? resultWithDarts.message
      : resultWithDarts.turn.isBust
        ? `${throwerName} busts with ${dartSummary}.`
        : `${throwerName} scored ${resultWithDarts.turn.scoreEntered} with ${dartSummary}.`;

    setMessage(`${turnMessage} ${nextTurn}.`);
  }

  function submitDummyScore() {
    if (!isCurrentThrowerDummy()) {
      return;
    }

    if (
      isMatchComplete ||
      isLegComplete ||
      pendingCheckoutTurn ||
      pendingDartsUsedTurn
    ) {
      return;
    }

    const currentSide = sides[currentSideIndex];
    const currentThrower = getCurrentThrower(currentSide);

    if (!currentThrower) {
      return;
    }

    const result = scoreTurn(currentSide, dummyScore, finishRule);

    const dummyTurn: Turn = {
      ...result.turn,
      throwerId: currentThrower.id,
      throwerName: currentThrower.name,
      isDummy: true,
    };

    setTurnHistory((previousHistory) => [dummyTurn, ...previousHistory]);

    if (!dummyTurn.isBust) {
      const updatedSides = [...sides];
      updatedSides[currentSideIndex] = {
        ...updatedSides[currentSideIndex],
        score: result.updatedPlayer.score,
        currentMemberIndex: getNextMemberIndex(updatedSides[currentSideIndex]),
      };

      setSides(updatedSides);
    } else {
      advanceCurrentSideMember();
    }

    if (result.isLegComplete) {
      setPendingDartsUsedTurn(dummyTurn);
      setMessage(
        `${currentThrower.name} checked out. How many darts were used?`,
      );
      return;
    }

    const nextSideIndex = getNextSideIndex();
    setCurrentSideIndex(nextSideIndex);

    const nextSide = sides[nextSideIndex];
    const nextThrowerName = getCurrentThrowerName(nextSide);

    setMessage(
      `${currentThrower.name} dummy score ${dummyScore}. ${nextThrowerName} (${nextSide.name}) to throw.`,
    );
  }

  function getNextMemberIndex(side: MatchSide): number {
    if (side.members.length <= 1) {
      return 0;
    }

    return side.currentMemberIndex === side.members.length - 1
      ? 0
      : side.currentMemberIndex + 1;
  }

  function advanceCurrentSideMember() {
    setSides((currentsides) => {
      const updatedsides = [...currentsides];
      const currentSide = updatedsides[currentSideIndex];

      updatedsides[currentSideIndex] = {
        ...currentSide,
        currentMemberIndex: getNextMemberIndex(currentSide),
      };

      return updatedsides;
    });
  }

  function confirmDoubleOut(wasDouble: boolean) {
    if (!pendingCheckoutTurn) {
      return;
    }

    if (wasDouble) {
      setPendingDartsUsedTurn(pendingCheckoutTurn);
      setMessage(
        `${pendingCheckoutTurn.playerName} checked out. How many darts were used?`,
      );
      setPendingCheckoutTurn(null);
      return;
    }

    const bustTurn: Turn = {
      ...pendingCheckoutTurn,
      scoreAfter: pendingCheckoutTurn.scoreBefore,
      isBust: true,
      isCheckout: false,
    };

    setTurnHistory((previousHistory) => [bustTurn, ...previousHistory]);

    advanceCurrentSideMember();

    const nextPlayerIndex = getNextSideIndex();
    const nextTurn = getTurnDisplayName(sides[nextPlayerIndex]);

    setCurrentSideIndex(nextPlayerIndex);
    setMessage(
      `${pendingCheckoutTurn.throwerName ?? pendingCheckoutTurn.playerName} busts! ${nextTurn}.`,
    );
    setPendingCheckoutTurn(null);
  }

  function completeLegWithTurn(completedTurn: Turn) {
    const updatedSides = sides.map((side) => {
      if (side.id !== completedTurn.playerId) {
        return side;
      }

      return {
        ...side,
        score: completedTurn.scoreAfter,
        legsWon: side.legsWon + 1,
        currentMemberIndex: getNextMemberIndex(side),
      };
    });

    const winnerSide = updatedSides.find(
      (side) => side.id === completedTurn.playerId,
    );

    if (!winnerSide) {
      return;
    }

    const completedLeg: CompletedLeg = {
      legNumber: currentLegNumber,
      winnerId: completedTurn.playerId,
      winnerName: completedTurn.playerName,
      turns: [completedTurn, ...turnHistory],
    };

    const nextCompletedLegs = [completedLeg, ...completedLegs];
    const opponentLegs = getOpponentLegs(updatedSides, completedTurn.playerId);
    const isMatchNowComplete =
      winnerSide.legsWon >= legsNeededToWin &&
      winnerSide.legsWon > opponentLegs;

    setSides(updatedSides);
    setTurnHistory((previousHistory) => [completedTurn, ...previousHistory]);
    setCompletedLegs(nextCompletedLegs);
    setIsLegComplete(true);
    setIsMatchComplete(isMatchNowComplete);
    setPendingCheckoutTurn(null);
    setPendingDartsUsedTurn(null);

    const checkoutDartSummary =
      completedTurn.darts && completedTurn.darts.length > 0
        ? ` with ${getDartSummary(completedTurn.darts)}`
        : "";

    const checkoutThrowerName =
      completedTurn.throwerName ?? completedTurn.playerName;

    if (isMatchNowComplete) {
      setMessage(
        `${checkoutThrowerName} checked out${checkoutDartSummary}. ${completedTurn.playerName} wins the match!`,
      );
      return;
    }

    setMessage(
      `${checkoutThrowerName} checked out${checkoutDartSummary}. ${completedTurn.playerName} wins the leg!`,
    );
  }

  function confirmCheckoutDartsUsed(dartsUsed: 1 | 2 | 3) {
    if (!pendingDartsUsedTurn) {
      return;
    }

    const completedTurn: Turn = {
      ...pendingDartsUsedTurn,
      dartsThrown: dartsUsed,
    };

    completeLegWithTurn(completedTurn);
  }

  function isDoubleOutDart(dart: DartThrow) {
    return dart.segment === "bull" || dart.multiplier === 2;
  }

  function isValidDartCheckout(darts: DartThrow[], finishRule: FinishRule) {
    if (finishRule === "straight_out") {
      return true;
    }

    const finalDart = darts[darts.length - 1];

    if (!finalDart) {
      return false;
    }

    return isDoubleOutDart(finalDart);
  }

  function startNextLeg() {
    if (isMatchComplete) {
      setMessage("The match is complete. Start/reset the game to play again.");
      return;
    }

    const nextstartingSideIndex =
      sides.length === 0 ? 0 : (startingSideIndex + 1) % sides.length;
    const nextStartingSide = sides[nextstartingSideIndex];

    const nextStartingMemberIndexBySide = {
      ...startingMemberIndexBySide,
    };

    if (nextStartingSide.members.length > 1) {
      nextStartingMemberIndexBySide[nextStartingSide.id] = getNextMemberIndex({
        ...nextStartingSide,
        currentMemberIndex: startingMemberIndexBySide[nextStartingSide.id] ?? 0,
      });
    }

    const resetSides = sides.map((player) => ({
      ...player,
      score: startingScore,
      currentMemberIndex: nextStartingMemberIndexBySide[player.id] ?? 0,
    }));

    setSides(resetSides);
    setStartingMemberIndexBySide(nextStartingMemberIndexBySide);
    setStartingSideIndex(nextstartingSideIndex);
    setCurrentSideIndex(nextstartingSideIndex);
    setCurrentLegNumber((previousLegNumber) => previousLegNumber + 1);
    setTurnHistory([]);
    setScoreInput("");
    setIsLegComplete(false);
    setPendingCheckoutTurn(null);
    setPendingDartsUsedTurn(null);

    const startingSide = resetSides[nextstartingSideIndex];
    setMessage(getTurnDisplayName(startingSide));
  }
  function getOpponentLegs(sideList: MatchSide[], winnerPlayerId: string) {
    return sideList.reduce((highestLegCount, side) => {
      if (side.id === winnerPlayerId) return highestLegCount;
      return Math.max(highestLegCount, side.legsWon);
    }, 0);
  }

  function getAllMatchTurns(): Turn[] {
    const completedLegTurns = completedLegs.flatMap((leg) => leg.turns);

    const currentLegIsAlreadySaved = completedLegs.some(
      (leg) => leg.legNumber === currentLegNumber,
    );

    if (currentLegIsAlreadySaved) {
      return completedLegTurns;
    }

    return [...turnHistory, ...completedLegTurns];
  }

  function getPlayerStats(playerId: string): PlayerStats {
    const allTurns = getAllMatchTurns();

    const playerTurns = allTurns.filter((turn) => turn.playerId === playerId);

    const scoringTurns = playerTurns.filter((turn) => !turn.isBust);

    const pointsScored = scoringTurns.reduce((total, turn) => {
      return total + turn.scoreEntered;
    }, 0);

    const dartsThrown = scoringTurns.reduce((total, turn) => {
      return total + turn.dartsThrown;
    }, 0);

    const threeDartAverage =
      dartsThrown === 0 ? 0 : (pointsScored / dartsThrown) * 3;

    const checkoutTurns = scoringTurns.filter((turn) => turn.isCheckout);

    const highestCheckout = checkoutTurns.reduce((highest, turn) => {
      return Math.max(highest, turn.scoreEntered);
    }, 0);

    const count180s = scoringTurns.filter(
      (turn) => turn.scoreEntered === 180,
    ).length;

    const count140Plus = scoringTurns.filter(
      (turn) => turn.scoreEntered >= 140,
    ).length;

    const count100Plus = scoringTurns.filter(
      (turn) => turn.scoreEntered >= 100,
    ).length;

    const busts = playerTurns.filter((turn) => turn.isBust).length;

    return {
      pointsScored,
      dartsThrown,
      threeDartAverage,
      highestCheckout,
      count180s,
      count140Plus,
      count100Plus,
      busts,
    };
  }

  function getMatchScoreText(): string {
    return sides
      .map((player) => `${player.name}: ${player.legsWon}`)
      .join(" | ");
  }

  function getMatchWinnerName(): string | null {
    const winner = sides.find((player) => player.legsWon >= legsNeededToWin);

    return winner?.name ?? null;
  }

  function getNextSideIndex() {
    if (sides.length === 0) return 0;
    return (currentSideIndex + 1) % sides.length;
  }

  function undoLastTurn() {
    if (pendingDartsUsedTurn) {
      setPendingDartsUsedTurn(null);
      setScoreInput("");
      setMessage(`Cancelled ${pendingDartsUsedTurn.playerName}'s checkout.`);
      return;
    }

    if (pendingCheckoutTurn) {
      setPendingCheckoutTurn(null);
      setScoreInput("");
      setMessage(`Cancelled ${pendingCheckoutTurn.playerName}'s checkout.`);
      return;
    }

    const lastTurn = turnHistory[0];

    if (!lastTurn) {
      setMessage("There is no turn to undo.");
      return;
    }

    const restoredSides = sides.map((side) => {
      if (side.id !== lastTurn.playerId) {
        return side;
      }

      const restoredMemberIndex = lastTurn.throwerId
        ? side.members.findIndex((member) => member.id === lastTurn.throwerId)
        : side.currentMemberIndex;

      return {
        ...side,
        score: lastTurn.scoreBefore,
        legsWon: lastTurn.isCheckout
          ? Math.max(0, side.legsWon - 1)
          : side.legsWon,
        currentMemberIndex:
          restoredMemberIndex >= 0
            ? restoredMemberIndex
            : side.currentMemberIndex,
      };
    });

    const restoredSideIndex = restoredSides.findIndex(
      (side) => side.id === lastTurn.playerId,
    );

    setSides(restoredSides);
    setCurrentSideIndex(restoredSideIndex);
    setTurnHistory((previousHistory) => previousHistory.slice(1));

    if (lastTurn.isCheckout) {
      setCompletedLegs((previousLegs) => previousLegs.slice(1));
    }

    setIsLegComplete(false);
    setIsMatchComplete(false);
    setScoreInput("");
    setMessage(`Undid ${lastTurn.playerName}'s last turn.`);
  }

  // Score view sections.
  // These helpers let compact and full layouts reuse the same components
  // in a different order without duplicating large JSX prop blocks.
  function renderScoreCards() {
    return (
      <section className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
        {sides.map((side, index) => (
          <PlayerCard
            key={side.id}
            player={side}
            isCurrentPlayer={index === currentSideIndex}
            isLegComplete={isLegComplete}
            isMatchComplete={isMatchComplete}
            finishRule={finishRule}
            stats={getPlayerStats(side.id)}
            compact={scoreLayout === "compact"}
          />
        ))}
      </section>
    );
  }

  function renderScoreEntryModeToggle() {
    const isBoardMode = scoreEntryMode === "dart";

    return (
      <div
        className={`mb-3 flex items-center justify-between gap-2 rounded-2xl border border-[var(--color-panel-border)] bg-[var(--color-panel)] ${shouldUseGameModeShell ? "p-2" : "p-3"
          }`}
      >
        <div>
          <div className="text-xs font-bold uppercase tracking-wide text-[var(--color-text-muted)]">
            Input
          </div>
          <div className="text-sm font-bold text-[var(--color-text-main)]">
            {isBoardMode ? "Dart-by-dart" : "Turn total"}
          </div>
        </div>

        <div className="grid grid-cols-2 rounded-xl border border-[var(--color-panel-border)] bg-[var(--color-panel-soft)] p-1">
          <button
            type="button"
            onClick={() => setScoreEntryMode("turn")}
            className={`rounded-lg px-3 py-2 text-sm font-bold transition ${!isBoardMode
              ? "bg-[var(--color-primary)] text-white shadow"
              : "text-[var(--color-text-muted)] hover:bg-[var(--color-panel-border)] hover:text-[var(--color-text-main)]"
              }`}
            aria-pressed={!isBoardMode}
          >
            Turn
          </button>

          <button
            type="button"
            onClick={() => setScoreEntryMode("dart")}
            className={`rounded-lg px-3 py-2 text-sm font-bold transition ${isBoardMode
              ? "bg-[var(--color-primary)] text-white shadow"
              : "text-[var(--color-text-muted)] hover:bg-[var(--color-panel-border)] hover:text-[var(--color-text-main)]"
              }`}
            aria-pressed={isBoardMode}
          >
            Darts
          </button>
        </div>
      </div>
    );
  }

  function renderScoreEntry() {
    return (
      <ScoreEntry
        message={message}
        scoreInput={scoreInput}
        compact={scoreLayout === "compact"}
        setScoreInput={setScoreInput}
        submitScore={submitScore}
        undoLastTurn={undoLastTurn}
        startNextLeg={startNextLeg}
        confirmDoubleOut={confirmDoubleOut}
        confirmCheckoutDartsUsed={confirmCheckoutDartsUsed}
        appendScoreDigit={appendScoreDigit}
        backspaceScoreInput={backspaceScoreInput}
        setQuickScore={setQuickScore}
        pendingCheckoutTurn={pendingCheckoutTurn}
        pendingDartsUsedTurn={pendingDartsUsedTurn}
        isLegComplete={isLegComplete}
        isMatchComplete={isMatchComplete}
        quickScores={quickScores}
        keypadButtons={keypadButtons}
        replayMatch={handleReplayMatch}
        newGameSetup={handleNewGameSetup}
        viewFinishedGame={handleViewFinishedGame}
        isCurrentThrowerDummy={isCurrentThrowerDummy()}
        dummyScore={dummyScore}
        submitDummyScore={submitDummyScore}
      />
    );
  }

  // Dart-by-dart score entry.
  // This is a placeholder until we add the actual dart controls.
  function renderDartEntry() {
    return (
      <DartEntry
        message={message}
        compact={scoreLayout === "compact"}
        currentScore={sides[currentSideIndex]?.score ?? 0}
        currentSideName={sides[currentSideIndex]?.name ?? "Side"}
        currentThrowerName={
          sides[currentSideIndex]
            ? getCurrentThrowerName(sides[currentSideIndex])
            : "Player"
        }
        currentLegNumber={currentLegNumber}
        finishRule={finishRule}
        fullscreenScoreCards={sides.map((side, index) => ({
          id: side.id,
          name: side.name,
          throwerName: getCurrentThrowerName(side),
          score: side.score,
          isCurrent: index === currentSideIndex,
        }))}
        lastTurn={turnHistory[0] ?? null}
        submitDartTurn={submitDartTurn}
        undoLastTurn={undoLastTurn}
        startNextLeg={startNextLeg}
        replayMatch={handleReplayMatch}
        newGameSetup={handleNewGameSetup}
        viewFinishedGame={handleViewFinishedGame}
        isLegComplete={isLegComplete}
        isMatchComplete={isMatchComplete}
        isCurrentThrowerDummy={isCurrentThrowerDummy()}
        dummyScore={dummyScore}
        submitDummyScore={submitDummyScore}
        initialSessionState={scoringViewSession}
        onSessionStateChange={setScoringViewSession}
        onExitGame={() => setIsExitGameOpen(true)}
      />
    );
  }

  function getFeedbackDiagnostics() {
    const recentTurns = turnHistory.slice(0, 5).map((turn) => ({
      playerName: turn.playerName,
      throwerName: turn.throwerName,
      scoreEntered: turn.scoreEntered,
      scoreBefore: turn.scoreBefore,
      scoreAfter: turn.scoreAfter,
      dartsThrown: turn.dartsThrown,
      isBust: turn.isBust,
      isCheckout: turn.isCheckout,
      darts: turn.darts?.map((dart) => ({
        segment: dart.segment,
        multiplier: dart.multiplier,
        score: dart.score,
      })),
    }));

    return JSON.stringify(
      {
        appVersion: APP_VERSION,
        timestamp: new Date().toISOString(),
        activeView,
        themeName,
        brandName,
        scoreLayout,
        defaultScoreLayout,
        refreshBehavior,
        game: {
          startingScore,
          competitionFormat,
          individualPlayerCount: individualPlayerNames.length,
          finishRule,
          bestOfLegs,
          scoreEntryMode,
          sideOneSize,
          sideTwoSize,
          rotationMode,
          dummyScore,
        },
        match: {
          matchId: matchId || null,
          matchCreatedAt,
          currentLegNumber,
          currentSideIndex,
          isLegComplete,
          isMatchComplete,
          message,
          sides: sides.map((side) => ({
            id: side.id,
            name: side.name,
            score: side.score,
            legsWon: side.legsWon,
            currentMemberIndex: side.currentMemberIndex,
            members: side.members.map((member) => ({
              id: member.id,
              name: member.name,
              isDummy: member.isDummy,
            })),
          })),
        },
        recentTurns,
        browser:
          typeof window === "undefined" || typeof navigator === "undefined"
            ? {
              userAgent: "Unavailable during server prerender",
              language: "Unavailable during server prerender",
              screen: {
                width: null,
                height: null,
              },
              viewport: {
                width: null,
                height: null,
              },
            }
            : {
              userAgent: navigator.userAgent,
              language: navigator.language,
              screen: {
                width: window.screen.width,
                height: window.screen.height,
              },
              viewport: {
                width: window.innerWidth,
                height: window.innerHeight,
              },
            },
      },
      null,
      2,
    );
  }

  async function submitFeedback() {
    const endpoint = process.env.NEXT_PUBLIC_FEEDBACK_ENDPOINT;

    if (!endpoint) {
      setFeedbackSubmitStatus("error");
      setFeedbackSubmitError(
        "Feedback endpoint is not configured. Add NEXT_PUBLIC_FEEDBACK_ENDPOINT to .env.local.",
      );
      return;
    }

    if (feedbackMessage.trim() === "") {
      setFeedbackSubmitStatus("error");
      setFeedbackSubmitError("Enter a message before submitting feedback.");
      return;
    }

    setFeedbackSubmitStatus("submitting");
    setFeedbackSubmitError("");

    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          type: feedbackType,
          message: feedbackMessage,
          diagnostics: getFeedbackDiagnostics(),
        }),
      });

      if (!response.ok) {
        throw new Error("Feedback service returned an error.");
      }

      setFeedbackSubmitStatus("success");
      setFeedbackMessage("");
    } catch {
      setFeedbackSubmitStatus("error");
      setFeedbackSubmitError(
        "Feedback could not be sent. Check your connection and try again.",
      );
    }
  }

  function renderFullNavigation() {
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

  function renderGameModeHeader() {
    const currentSide = sides[currentSideIndex];
    const currentThrowerName = currentSide ? getCurrentThrowerName(currentSide) : "Player";

    return (
      <div className="relative mb-3 rounded-2xl border border-[var(--color-panel-border)] bg-[var(--color-panel)] p-2.5 shadow-lg">
        <div className="flex items-center justify-between gap-3">
          <button
            onClick={() => setIsGameMenuOpen((isOpen) => !isOpen)}
            className="rounded-xl bg-[var(--color-primary)] px-4 py-2.5 text-xl font-bold text-white hover:bg-[var(--color-primary-hover)]"
            aria-expanded={isGameMenuOpen}
            aria-label="Open match menu"
          >
            ☰
          </button>
          <div className="min-w-0 flex-1">
            <div className="truncate text-lg font-bold">Casual Play</div>
            <div className="truncate text-sm text-[var(--color-text-muted)]">
              Leg {currentLegNumber} · {currentThrowerName}
              {currentSide ? ` (${currentSide.name})` : ""}
            </div>
          </div>
          <a href="/help?from=casual-play" className="rounded-xl border border-[var(--color-panel-border)] bg-[var(--color-panel-soft)] px-3 py-2 text-sm font-bold">?</a>
        </div>

        {isGameMenuOpen && (
          <div className="fixed inset-0 z-50 bg-black/70 p-4" role="dialog" aria-modal="true" aria-label="Match menu">
            <div className="mx-auto max-w-sm rounded-2xl border border-slate-600 bg-slate-950 p-4 text-white shadow-2xl">
              <div className="mb-3 flex items-center justify-between gap-3">
                <div>
                  <div className="text-lg font-bold">Casual Match</div>
                  <div className="text-sm text-slate-300">{brandName} · v{APP_VERSION}</div>
                </div>
                <button onClick={() => setIsGameMenuOpen(false)} className="rounded-xl bg-slate-800 px-3 py-2 text-sm font-bold hover:bg-slate-700">Close</button>
              </div>
              <div className="grid grid-cols-1 gap-2">
                <button onClick={() => openGameMenuView("score")} className={getGameMenuButtonClass("score")}>Score</button>
                <button onClick={() => openGameMenuView("game")} className={getGameMenuButtonClass("game")}>Match Options</button>
                <button onClick={() => openGameMenuView("stats")} className={getGameMenuButtonClass("stats")}>Match Stats</button>
                <button onClick={() => openGameMenuView("history")} className={getGameMenuButtonClass("history")}>History</button>
                <button onClick={() => openGameMenuView("app")} className={getGameMenuButtonClass("app")}>Settings</button>
                <a href="/help?from=casual-play" className="rounded-xl bg-slate-800 px-4 py-3 text-left font-bold text-slate-100 hover:bg-slate-700">Help / Feedback</a>
                <button type="button" onClick={() => { setIsGameMenuOpen(false); setIsExitGameOpen(true); }} className="rounded-xl border border-slate-700 bg-slate-900 px-4 py-3 text-left font-bold text-slate-100 hover:bg-slate-800">Exit Game…</button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  const shouldUseGameModeShell = isGameModeActive && !isMatchComplete;

  return (
    <main
      className={`min-h-screen bg-[var(--color-app-bg)] text-[var(--color-text-main)] ${shouldUseGameModeShell ? "p-3 sm:p-4" : "p-6"
        } ${themeName === "firehall" ? "theme-firehall" : ""}`}
    >
      <SyncCoordinator />
      <div className="mx-auto max-w-4xl">
        {shouldUseGameModeShell ? (
          renderGameModeHeader()
        ) : (
          <>
            <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="text-sm font-bold uppercase tracking-wide text-[var(--color-text-muted)]">Local · no account required</div>
                <h1 className="mt-1 text-4xl font-bold">Casual Play</h1>
                <p className="mt-1 text-[var(--color-text-muted)]">Set up a match, then score from the focused board screen.</p>
              </div>
              <div className="rounded-xl border border-[var(--color-panel-border)] bg-[var(--color-panel)] px-3 py-2 text-sm text-[var(--color-text-muted)]">v{APP_VERSION}</div>
            </div>
            {renderFullNavigation()}
          </>
        )}

        {activeView === "game" && (
          <GameSetup
            teamOneName={teamOneName}
            teamTwoName={teamTwoName}
            startingScore={startingScore}
            competitionFormat={competitionFormat}
            individualPlayerNames={individualPlayerNames}
            finishRule={finishRule}
            bestOfLegs={bestOfLegs}
            scoreEntryMode={scoreEntryMode}
            setScoreEntryMode={setScoreEntryMode}
            sideOneSize={sideOneSize}
            sideTwoSize={sideTwoSize}
            rotationMode={rotationMode}
            dummyScore={dummyScore}
            setRotationMode={setRotationMode}
            setDummyScore={setDummyScore}
            setTeamOneName={setTeamOneName}
            setTeamTwoName={setTeamTwoName}
            teamOneMemberNames={teamOneMemberNames}
            teamTwoMemberNames={teamTwoMemberNames}
            resizeSideOneMembers={resizeSideOneMembers}
            resizeSideTwoMembers={resizeSideTwoMembers}
            setTeamOneMemberNames={setTeamOneMemberNames}
            setTeamTwoMemberNames={setTeamTwoMemberNames}
            setStartingScore={setStartingScore}
            setCompetitionFormat={setCompetitionFormat}
            setIndividualPlayerNames={setIndividualPlayerNames}
            setFinishRule={setFinishRule}
            setBestOfLegs={setBestOfLegs}
            startNewGame={handleStartNewGame}
            clearSavedMatch={clearSavedMatch}
            isResetConfirmationVisible={isResetConfirmationVisible}
            confirmResetMatch={confirmResetMatch}
            cancelResetMatch={cancelResetMatch}
            isClearSavedConfirmationVisible={isClearSavedConfirmationVisible}
            confirmClearSavedMatch={confirmClearSavedMatch}
            cancelClearSavedMatch={cancelClearSavedMatch}
            pausedGames={pausedGames}
            resumePausedGame={resumePausedGame}
            deletePausedGame={deletePausedGame}
          />
        )}


        {activeView === "app" && (
          <>
            <AppSettings
              brandName={brandName}
              themeName={themeName}
              refreshBehavior={refreshBehavior}
              defaultScoreLayout={defaultScoreLayout}
              setBrandName={setBrandName}
              setThemeName={setThemeName}
              setRefreshBehavior={setRefreshBehavior}
              setDefaultScoreLayout={setDefaultScoreLayout}
            />
          </>
        )}

        {activeView === "score" && (
          <>
            {!shouldUseGameModeShell && (
              <CurrentTurnBanner
                currentSide={sides[currentSideIndex]}
                currentLegNumber={currentLegNumber}
                bestOfLegs={bestOfLegs}
                legsNeededToWin={legsNeededToWin}
                startingScore={startingScore}
                finishRule={finishRule}
                isCurrentThrowerDummy={isCurrentThrowerDummy()}
                dummyScore={dummyScore}
                scoreLayout={scoreLayout}
                setScoreLayout={setScoreLayout}
              />
            )}

            {!isLegComplete &&
              !isMatchComplete &&
              !isCurrentThrowerDummy() &&
              renderScoreEntryModeToggle()}

            <div className="flex flex-col">
              <div
                className={
                  shouldUseGameModeShell
                    ? "order-2"
                    : scoreLayout === "compact"
                      ? "order-1"
                      : "order-2"
                }
              >
                {scoreEntryMode === "dart" ? renderDartEntry() : renderScoreEntry()}
              </div>

              <div
                className={
                  shouldUseGameModeShell
                    ? "order-1"
                    : scoreLayout === "compact"
                      ? "order-2"
                      : "order-1"
                }
              >
                {renderScoreCards()}
              </div>
            </div>

            {!isMatchComplete && (
              <div className="mt-2 flex justify-end">
                <button
                  type="button"
                  onClick={() => setIsExitGameOpen(true)}
                  className="rounded-lg border border-[var(--color-panel-border)] bg-[var(--color-panel)] px-3 py-2 text-xs font-bold text-[var(--color-text-muted)] hover:bg-[var(--color-panel-soft)] hover:text-[var(--color-text-main)]"
                >
                  Exit Game
                </button>
              </div>
            )}
          </>
        )}

        {activeView === "stats" && (
          <MatchSummary
            players={sides}
            isMatchComplete={isMatchComplete}
            isLegComplete={isLegComplete}
            currentLegNumber={currentLegNumber}
            getMatchScoreText={getMatchScoreText}
            getMatchWinnerName={getMatchWinnerName}
            getPlayerStats={getPlayerStats}
          />
        )}

        {activeView === "history" && (
          <>
            <LocalMatchHistory />
            <TurnHistory turns={turnHistory} />
            <CompletedLegs completedLegs={completedLegs} />
          </>
        )}
        {isExitGameOpen && !isMatchComplete && (
          <CasualExitGameDialog
            games={pausedGames}
            suggestedName={getSuggestedPausedGameName()}
            onCancel={() => setIsExitGameOpen(false)}
            onPause={pauseCurrentGame}
            onDiscard={discardCurrentGame}
            onDeleteSavedGame={deletePausedGame}
          />
        )}
        <FeedbackModal
          isOpen={isFeedbackModalOpen}
          feedbackType={feedbackType}
          feedbackMessage={feedbackMessage}
          diagnostics={getFeedbackDiagnostics()}
          feedbackSubmitStatus={feedbackSubmitStatus}
          feedbackSubmitError={feedbackSubmitError}
          setFeedbackType={setFeedbackType}
          setFeedbackMessage={setFeedbackMessage}
          submitFeedback={submitFeedback}
          closeFeedbackModal={() => setIsFeedbackModalOpen(false)}
        />
      </div>
    </main>
  );
}
