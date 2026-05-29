"use client";

import {
  BestOfLegs,
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
} from "@/lib/types";

import { FeedbackModal } from "@/components/FeedbackModal";
import { APP_VERSION } from "@/lib/appInfo";
import { DartEntry } from "@/components/DartEntry";
import { ScoreEntry } from "@/components/ScoreEntry";
import { GameSetup } from "@/components/GameSetup";
import { MatchSummary } from "@/components/MatchSummary";
import { CompletedLegs } from "@/components/CompletedLegs";
import { TurnHistory } from "@/components/TurnHistory";
import { PlayerCard } from "@/components/PlayerCard";
import { useEffect, useState } from "react";
import { CurrentTurnBanner } from "@/components/CurrentTurnBanner";
import { AppSettings } from "@/components/AppSettings";
import {
  DartThrow,
  FinishRule,
  StartingScore,
  Turn,
  scoreTurn,
  validateTurnScore,
} from "@/lib/scoring";

type AppView = "score" | "game" | "app" | "stats" | "history";
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
  const [finishRule, setFinishRule] = useState<FinishRule>("double_out");
  const [bestOfLegs, setBestOfLegs] = useState<BestOfLegs>(3);

  // Score entry mode.
  // Total-turn entry is current behavior. Dart-by-dart will be added later.
  const [scoreEntryMode, setScoreEntryMode] = useState<ScoreEntryMode>("turn");

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
  const [activeView, setActiveView] = useState<AppView>("score");
  const [isGameModeActive, setIsGameModeActive] = useState(false);
  const [isGameMenuOpen, setIsGameMenuOpen] = useState(false);

  // Legacy/simple name fields.
  // These mostly exist to load older saved matches while the app transitions
  // to teamOneMemberNames/teamTwoMemberNames.
  const [playerOneName, setPlayerOneName] = useState("Player 1");
  const [playerTwoName, setPlayerTwoName] = useState("Player 2");
  const [teamOneName, setTeamOneName] = useState("Team 1");
  const [teamTwoName, setTeamTwoName] = useState("Team 2");
  const [teamOnePlayerTwoName, setTeamOnePlayerTwoName] = useState("Player 1B");
  const [teamTwoPlayerTwoName, setTeamTwoPlayerTwoName] = useState("Player 2B");

  // Current setup member names.
  // These arrays are now the main source for creating singles, doubles,
  // and larger team sides.
  const [teamOneMemberNames, setTeamOneMemberNames] = useState<string[]>([
    "Player 1",
  ]);

  const [teamTwoMemberNames, setTeamTwoMemberNames] = useState<string[]>([
    "Player 2",
  ]);

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

      setThemeName(parsedMatch.themeName ?? "default");

      setBrandName(parsedMatch.brandName ?? "Dart Scorekeeper");

      const loadedDefaultScoreLayout =
        parsedMatch.defaultScoreLayout ?? "compact";

      setDefaultScoreLayout(loadedDefaultScoreLayout);
      setScoreLayout(loadedDefaultScoreLayout);

      const loadedRefreshBehavior = parsedMatch.refreshBehavior ?? "score";
      setRefreshBehavior(loadedRefreshBehavior);
      setActiveView(
        loadedRefreshBehavior === "last"
          ? (parsedMatch.activeView ?? "score")
          : "score",
      );
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

      setSides(
        normalizeSavedSides(parsedMatch.sides ?? parsedMatch.players ?? []),
      );
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
    } catch {
      localStorage.removeItem(savedMatchKey);
    } finally {
      setHasLoadedSavedMatch(true);
    }
  }, []);
  /* eslint-enable react-hooks/set-state-in-effect */

  useEffect(() => {
    if (!hasLoadedSavedMatch) {
      return;
    }

    const matchState: SavedMatchState = {
      startingScore,
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
    };
    localStorage.setItem(savedMatchKey, JSON.stringify(matchState));
  }, [
    hasLoadedSavedMatch,
    startingScore,
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
  ]);

  function resizeSideOneMembers(size: TeamSize) {
    setSideOneSize(size);

    setTeamOneMemberNames((currentNames) =>
      Array.from({ length: size }, (_, index) => {
        return currentNames[index] ?? `Team 1 Player ${index + 1}`;
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
        return currentNames[index] ?? `Team 2 Player ${index + 1}`;
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
        return "Game Setup";
      case "app":
        return "App Settings";
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
    const isSinglesMatch = sideOneSize === 1 && sideTwoSize === 1;

    const sideOneName = isSinglesMatch
      ? teamOneMemberNames[0]?.trim() || "Player 1"
      : teamOneName.trim() || "Team 1";

    const sideTwoName = isSinglesMatch
      ? teamTwoMemberNames[0]?.trim() || "Player 2"
      : teamTwoName.trim() || "Team 2";

    let newSides: MatchSide[] = [
      createTeamSide("side-1", sideOneName, teamOneMemberNames, startingScore),
      createTeamSide("side-2", sideTwoName, teamTwoMemberNames, startingScore),
    ];

    if (rotationMode === "dummy" && sideOneSize !== sideTwoSize) {
      const targetSize = Math.max(sideOneSize, sideTwoSize);

      newSides = newSides.map((side) =>
        addDummyMembersIfNeeded(side, targetSize),
      );
    }

    setSides(newSides);
    setCurrentSideIndex(0);
    setStartingSideIndex(0);
    setCurrentLegNumber(1);
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
    setIsGameModeActive(true);
    setIsGameMenuOpen(false);
    setMessage(
      `${getCurrentThrowerName(newSides[0])} (${newSides[0].name}) to throw`,
    );
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
    setFinishRule("double_out");
    setBestOfLegs(3);
    setMatchType("singles");
    setTeamSize(1);
    setRotationMode("independent");
    setDummyScore(0);
    setSideOneSize(1);
    setSideTwoSize(1);
    setPlayerOneName("Player 1");
    setPlayerTwoName("Player 2");
    setTeamOneName("Team 1");
    setTeamTwoName("Team 2");
    setTeamOnePlayerTwoName("Player 1B");
    setTeamTwoPlayerTwoName("Player 2B");
    setTeamOneMemberNames(["Player 1"]);
    setTeamTwoMemberNames(["Player 2"]);
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

  function getCurrentThrowerName(side: MatchSide): string {
    return side.members[side.currentMemberIndex]?.name ?? side.name;
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

    const nextPlayerName = sides[nextPlayerIndex].name;
    const nextThrowerName = getCurrentThrowerName(sides[nextPlayerIndex]);

    setMessage(
      `${resultWithThrower.message} ${nextThrowerName} (${nextPlayerName}) to throw.`,
    );
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
        message: `${
          turnWithDarts.throwerName ?? turnWithDarts.playerName
        } busts with ${getDartSummary(darts)}. Final dart was not a double.`,
      };
    }

    if (resultWithDarts.needsDoubleOutConfirmation) {
      resultWithDarts = {
        ...resultWithDarts,
        isLegComplete: true,
        needsDoubleOutConfirmation: false,
        message: `${
          resultWithDarts.turn.throwerName ?? resultWithDarts.turn.playerName
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
    const nextThrowerName = getCurrentThrowerName(nextSide);

    const dartSummary = getDartSummary(darts);
    const throwerName =
      resultWithDarts.turn.throwerName ?? resultWithDarts.turn.playerName;

    const turnMessage = isInvalidDoubleOutCheckout
      ? resultWithDarts.message
      : resultWithDarts.turn.isBust
        ? `${throwerName} busts with ${dartSummary}.`
        : `${throwerName} scored ${resultWithDarts.turn.scoreEntered} with ${dartSummary}.`;

    setMessage(
      `${turnMessage} ${nextThrowerName} (${nextSide.name}) to throw.`,
    );
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
    const nextThrowerName = getCurrentThrowerName(sides[nextPlayerIndex]);

    setCurrentSideIndex(nextPlayerIndex);
    setMessage(
      `${pendingCheckoutTurn.throwerName ?? pendingCheckoutTurn.playerName} busts! ${nextThrowerName} (${sides[nextPlayerIndex].name}) to throw.`,
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

    const nextstartingSideIndex = startingSideIndex === 0 ? 1 : 0;
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
    const startingThrower = getCurrentThrowerName(startingSide);

    setMessage(`${startingThrower} (${startingSide.name}) to throw`);
  }
  function getOpponentLegs(sideList: MatchSide[], winnerPlayerId: string) {
    const opponent = sideList.find((side) => side.id !== winnerPlayerId);
    return opponent?.legsWon ?? 0;
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
    return currentSideIndex === 0 ? 1 : 0;
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
        submitDartTurn={submitDartTurn}
        undoLastTurn={undoLastTurn}
        startNextLeg={startNextLeg}
        replayMatch={handleReplayMatch}
        newGameSetup={handleNewGameSetup}
        viewFinishedGame={handleViewFinishedGame}
        isLegComplete={isLegComplete}
        isMatchComplete={isMatchComplete}
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
          finishRule,
          bestOfLegs,
          scoreEntryMode,
          sideOneSize,
          sideTwoSize,
          rotationMode,
          dummyScore,
        },
        match: {
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
      <nav className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-8">
        <button
          onClick={() => setActiveView("score")}
          className={getTabClass("score")}
        >
          Score
        </button>

        <button
          onClick={() => setActiveView("game")}
          className={getTabClass("game")}
        >
          Game
        </button>

        <button
          onClick={() => setActiveView("app")}
          className={getTabClass("app")}
        >
          App
        </button>

        <button
          onClick={() => setActiveView("stats")}
          className={getTabClass("stats")}
        >
          Stats
        </button>

        <button
          onClick={() => setActiveView("history")}
          className={getTabClass("history")}
        >
          History
        </button>
      </nav>
    );
  }

  function renderGameModeHeader() {
    const currentSide = sides[currentSideIndex];
    const currentThrowerName = currentSide
      ? getCurrentThrowerName(currentSide)
      : "Player";

    return (
      <div className="relative mb-3 rounded-2xl border border-[var(--color-panel-border)] bg-[var(--color-panel)] p-2.5 shadow-lg">
        <div className="flex items-center justify-between gap-3">
          <button
            onClick={() => setIsGameMenuOpen((isOpen) => !isOpen)}
            className="rounded-xl bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] px-4 py-2.5 text-xl font-bold text-white"
            aria-expanded={isGameMenuOpen}
            aria-label="Open game menu"
          >
            ☰
          </button>

          <div className="min-w-0 flex-1">
            <div className="truncate text-lg font-bold">{brandName}</div>
            <div className="truncate text-sm text-[var(--color-text-muted)]">
              {getActiveViewLabel()} · Leg {currentLegNumber} · {currentThrowerName}
              {currentSide ? ` (${currentSide.name})` : ""}
            </div>
          </div>

          <button
            onClick={() => {
              setActiveView("score");
              setIsGameMenuOpen(false);
            }}
            className="rounded-xl bg-[var(--color-panel-soft)] hover:bg-[var(--color-panel-border)] px-4 py-2.5 text-sm font-bold text-[var(--color-text-main)]"
          >
            Score
          </button>
        </div>

        {isGameMenuOpen && (
          <div
            className="fixed inset-0 z-50 bg-black/70 p-4"
            role="dialog"
            aria-modal="true"
            aria-label="Game menu"
          >
            <div className="mx-auto max-w-sm rounded-2xl border border-slate-600 bg-slate-950 p-4 text-white shadow-2xl">
              <div className="mb-3 flex items-center justify-between gap-3">
                <div>
                  <div className="text-lg font-bold">Game Menu</div>
                  <div className="text-sm text-slate-300">{brandName} · v{APP_VERSION}</div>
                </div>

                <button
                  onClick={() => setIsGameMenuOpen(false)}
                  className="rounded-xl bg-slate-800 px-3 py-2 text-sm font-bold text-white hover:bg-slate-700"
                >
                  Close
                </button>
              </div>

              <div className="grid grid-cols-1 gap-2">
                <button
                  onClick={() => openGameMenuView("score")}
                  className={getGameMenuButtonClass("score")}
                >
                  Score
                </button>

                <button
                  onClick={() => openGameMenuView("game")}
                  className={getGameMenuButtonClass("game")}
                >
                  Game Setup
                </button>

                <button
                  onClick={() => openGameMenuView("app")}
                  className={getGameMenuButtonClass("app")}
                >
                  App Settings
                </button>

                <button
                  onClick={() => openGameMenuView("stats")}
                  className={getGameMenuButtonClass("stats")}
                >
                  Stats
                </button>

                <button
                  onClick={() => openGameMenuView("history")}
                  className={getGameMenuButtonClass("history")}
                >
                  History
                </button>

                <button
                  onClick={() => {
                    setFeedbackSubmitStatus("idle");
                    setFeedbackSubmitError("");
                    setIsFeedbackModalOpen(true);
                    setIsGameMenuOpen(false);
                  }}
                  className="rounded-xl bg-slate-800 px-4 py-3 text-left font-bold text-slate-100 hover:bg-slate-700"
                >
                  Feedback
                </button>

                <button
                  onClick={() => {
                    setIsGameModeActive(false);
                    setIsGameMenuOpen(false);
                  }}
                  className="rounded-xl bg-slate-800 px-4 py-3 text-left font-bold text-slate-100 hover:bg-slate-700"
                >
                  Show full tabs
                </button>
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
      className={`min-h-screen bg-[var(--color-app-bg)] text-[var(--color-text-main)] ${
        shouldUseGameModeShell ? "p-3 sm:p-4" : "p-6"
      } ${themeName === "firehall" ? "theme-firehall" : ""}`}
    >
      <div className="mx-auto max-w-4xl">
        {shouldUseGameModeShell ? (
          renderGameModeHeader()
        ) : (
          <>
            <div className="mb-6">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                <div>
                  <div className="text-sm uppercase tracking-wide text-[var(--color-text-muted)]">
                    Local Scoring App
                  </div>

                  <h1 className="text-4xl font-bold mb-2">{brandName}</h1>

                  <p className="text-[var(--color-text-muted)]">
                    X01 scorer for singles, doubles, and team play
                  </p>
                </div>

                <div className="flex flex-col sm:items-end gap-2">
                  <div className="rounded-xl bg-[var(--color-panel)] border border-[var(--color-panel-border)] px-3 py-2 text-sm text-[var(--color-text-muted)]">
                    v{APP_VERSION}
                  </div>

                  <button
                    onClick={() => {
                      setFeedbackSubmitStatus("idle");
                      setFeedbackSubmitError("");
                      setIsFeedbackModalOpen(true);
                    }}
                    className="rounded-xl bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] px-4 py-2 text-sm font-bold"
                  >
                    Feedback
                  </button>

                  {activeView === "score" && !isMatchComplete && (
                    <button
                      onClick={() => setIsGameModeActive(true)}
                      className="rounded-xl bg-[var(--color-panel-soft)] hover:bg-[var(--color-panel-border)] px-4 py-2 text-sm font-bold text-[var(--color-text-main)]"
                    >
                      Game Mode
                    </button>
                  )}
                </div>
              </div>
            </div>

            {renderFullNavigation()}
          </>
        )}

        {activeView === "game" && (
          <GameSetup
            teamOneName={teamOneName}
            teamTwoName={teamTwoName}
            startingScore={startingScore}
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
          />
        )}

        {activeView === "app" && (
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
                {scoreEntryMode === "dart"
                  ? renderDartEntry()
                  : renderScoreEntry()}
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
            <TurnHistory turns={turnHistory} />
            <CompletedLegs completedLegs={completedLegs} />
          </>
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
