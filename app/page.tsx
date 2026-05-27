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
  createTeamSide,
} from "@/lib/types";

import { ScoreEntry } from "@/components/ScoreEntry";
import { GameSetup } from "@/components/GameSetup";
import { MatchSummary } from "@/components/MatchSummary";
import { CompletedLegs } from "@/components/CompletedLegs";
import { TurnHistory } from "@/components/TurnHistory";
import { PlayerCard } from "@/components/PlayerCard";
import { useEffect, useState } from "react";
import { CurrentTurnBanner } from "@/components/CurrentTurnBanner";
import {
  FinishRule,
  StartingScore,
  Turn,
  scoreTurn,
  validateTurnScore,
} from "@/lib/scoring";

type AppView = "score" | "setup" | "stats" | "history";
type ScoreLayout = "compact" | "full";

export default function Home() {
  const [startingScore, setStartingScore] = useState<StartingScore>(501);
  const [finishRule, setFinishRule] = useState<FinishRule>("double_out");
  const [bestOfLegs, setBestOfLegs] = useState<BestOfLegs>(3);
  const [matchType, setMatchType] = useState<MatchType>("singles");
  const [teamSize, setTeamSize] = useState<TeamSize>(1);
  const [sideOneSize, setSideOneSize] = useState<TeamSize>(1);
  const [sideTwoSize, setSideTwoSize] = useState<TeamSize>(1);
  const [scoreLayout, setScoreLayout] = useState<ScoreLayout>("compact");

  const [rotationMode, setRotationMode] = useState<RotationMode>("independent");

  const [dummyScore, setDummyScore] = useState(0);

  const [activeView, setActiveView] = useState<AppView>("score");
  const [playerOneName, setPlayerOneName] = useState("Player 1");
  const [playerTwoName, setPlayerTwoName] = useState("Player 2");
  const [teamOneName, setTeamOneName] = useState("Team 1");
  const [teamTwoName, setTeamTwoName] = useState("Team 2");
  const [teamOnePlayerTwoName, setTeamOnePlayerTwoName] = useState("Player 1B");
  const [teamTwoPlayerTwoName, setTeamTwoPlayerTwoName] = useState("Player 2B");

  const [teamOneMemberNames, setTeamOneMemberNames] = useState<string[]>([
    "Player 1",
  ]);

  const [teamTwoMemberNames, setTeamTwoMemberNames] = useState<string[]>([
    "Player 2",
  ]);

  const [sides, setSides] = useState<MatchSide[]>([
    createTeamSide("side-1", "Player 1", ["Player 1"], 501),
    createTeamSide("side-2", "Player 2", ["Player 2"], 501),
  ]);

  const [currentSideIndex, setCurrentSideIndex] = useState(0);
  const [startingSideIndex, setStartingSideIndex] = useState(0);
  const [currentLegNumber, setCurrentLegNumber] = useState(1);
  const [startingMemberIndexBySide, setStartingMemberIndexBySide] = useState<
    Record<string, number>
  >({
    "side-1": 0,
    "side-2": 0,
  });
  const [scoreInput, setScoreInput] = useState("");
  const [message, setMessage] = useState("Player 1 to throw");
  const [turnHistory, setTurnHistory] = useState<Turn[]>([]);
  const [completedLegs, setCompletedLegs] = useState<CompletedLeg[]>([]);
  const [isLegComplete, setIsLegComplete] = useState(false);
  const [isMatchComplete, setIsMatchComplete] = useState(false);
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
      setMatchType(parsedMatch.matchType ?? "singles");

      const loadedSideOneSize =
        parsedMatch.sideOneSize ??
        parsedMatch.teamSize ??
        (parsedMatch.matchType === "doubles" ? 2 : 1);

      const loadedSideTwoSize =
        parsedMatch.sideTwoSize ??
        parsedMatch.teamSize ??
        (parsedMatch.matchType === "doubles" ? 2 : 1);

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
      ? "rounded-xl bg-blue-600 px-4 py-3 font-bold text-white"
      : "rounded-xl bg-slate-800 hover:bg-slate-700 px-4 py-3 font-bold text-slate-300";
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
    setActiveView("setup");
  }

  function handleViewFinishedGame() {
    setActiveView("history");
  }

  function clearSavedMatch() {
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
    setMessage("Saved match cleared. Player 1 to throw.");
  }

  function getCurrentThrowerName(side: MatchSide): string {
    return side.members[side.currentMemberIndex]?.name ?? side.name;
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
    if (isLegComplete || isMatchComplete || pendingCheckoutTurn) {
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
    if (isLegComplete || isMatchComplete || pendingCheckoutTurn) {
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

  function confirmCheckoutDartsUsed(dartsUsed: 1 | 2 | 3) {
    if (!pendingDartsUsedTurn) {
      return;
    }

    const completedTurn: Turn = {
      ...pendingDartsUsedTurn,
      dartsThrown: dartsUsed,
    };

    const updatedsides = sides.map((player) => {
      if (player.id !== completedTurn.playerId) {
        return player;
      }

      return {
        ...player,
        score: 0,
      };
    });

    setSides(
      updatedsides.map((player) => {
        if (player.id !== completedTurn.playerId) {
          return player;
        }

        return {
          ...player,
          currentMemberIndex: getNextMemberIndex(player),
        };
      }),
    );

    setTurnHistory((previousHistory) => [completedTurn, ...previousHistory]);
    setPendingDartsUsedTurn(null);
    finishLeg(completedTurn.playerId, completedTurn);
  }

  function finishLeg(winnerPlayerId: string, winningTurn?: Turn) {
    const updatedsides = sides.map((player) => {
      if (player.id !== winnerPlayerId) {
        return player;
      }

      return {
        ...player,
        score: 0,
        legsWon: player.legsWon + 1,
      };
    });

    const winner = updatedsides.find((player) => player.id === winnerPlayerId);

    if (!winner) {
      return;
    }

    const finalTurnHistory = winningTurn
      ? [winningTurn, ...turnHistory]
      : turnHistory;

    const completedLeg: CompletedLeg = {
      legNumber: currentLegNumber,
      winnerId: winner.id,
      winnerName: winner.name,
      turns: finalTurnHistory,
    };

    setCompletedLegs((previousLegs) => [completedLeg, ...previousLegs]);
    setSides(updatedsides);
    setIsLegComplete(true);

    if (winner.legsWon >= legsNeededToWin) {
      setIsMatchComplete(true);
      setMessage(
        `${winner.name} wins the match ${winner.legsWon}-${getOpponentLegs(
          updatedsides,
          winner.id,
        )}!`,
      );
      return;
    }

    setMessage(`${winner.name} wins leg ${currentLegNumber}!`);
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

    const restoredsides = sides.map((player) => {
      if (player.id !== lastTurn.playerId) {
        return player;
      }

      return {
        ...player,
        score: lastTurn.scoreBefore,
        legsWon: lastTurn.isCheckout
          ? Math.max(0, player.legsWon - 1)
          : player.legsWon,
      };
    });

    const restoredPlayerIndex = restoredsides.findIndex(
      (player) => player.id === lastTurn.playerId,
    );

    setSides(restoredsides);
    setCurrentSideIndex(restoredPlayerIndex);
    setTurnHistory((previousHistory) => previousHistory.slice(1));

    if (lastTurn.isCheckout) {
      setCompletedLegs((previousLegs) => previousLegs.slice(1));
    }

    setIsLegComplete(false);
    setIsMatchComplete(false);
    setScoreInput("");
    setMessage(`Undid ${lastTurn.playerName}'s last turn.`);
  }
  return (
    <main className="min-h-screen bg-slate-950 text-white p-6">
      <div className="mx-auto max-w-4xl">
        <h1 className="text-4xl font-bold mb-2">Dart Scorekeeper</h1>
        <p className="text-slate-300 mb-6">Basic X01 scorer</p>

        <nav className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
          <button
            onClick={() => setActiveView("score")}
            className={getTabClass("score")}
          >
            Score
          </button>

          <button
            onClick={() => setActiveView("setup")}
            className={getTabClass("setup")}
          >
            Setup
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

        {activeView === "setup" && (
          <GameSetup
            teamOneName={teamOneName}
            teamTwoName={teamTwoName}
            startingScore={startingScore}
            finishRule={finishRule}
            bestOfLegs={bestOfLegs}
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
          />
        )}

        {activeView === "score" && (
          <>
            <CurrentTurnBanner
              currentSide={sides[currentSideIndex]}
              currentLegNumber={currentLegNumber}
              bestOfLegs={bestOfLegs}
              startingScore={startingScore}
              finishRule={finishRule}
              isCurrentThrowerDummy={isCurrentThrowerDummy()}
              dummyScore={dummyScore}
              scoreLayout={scoreLayout}
              setScoreLayout={setScoreLayout}
            />
            <section className="rounded-2xl bg-slate-900 border border-slate-700 p-4 mb-8">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-center">
                <div>
                  <div className="text-slate-400">Leg</div>
                  <div className="text-2xl font-bold">{currentLegNumber}</div>
                </div>
                <div>
                  <div className="text-slate-400">Format</div>
                  <div className="text-2xl font-bold">Best of {bestOfLegs}</div>
                </div>
                <div>
                  <div className="text-slate-400">To Win</div>
                  <div className="text-2xl font-bold">
                    {legsNeededToWin} legs
                  </div>
                </div>
              </div>
            </section>

            <section className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
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
      </div>
    </main>
  );
}
