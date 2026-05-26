"use client";

import {
  BestOfLegs,
  CompletedLeg,
  MatchPlayer,
  MatchSide,
  MatchType,
  PlayerStats,
  SavedMatchState,
  createDoublesSide,
  createSinglesSide,
} from "@/lib/types";

import { ScoreEntry } from "@/components/ScoreEntry";
import { GameSetup } from "@/components/GameSetup";
import { MatchSummary } from "@/components/MatchSummary";
import { CompletedLegs } from "@/components/CompletedLegs";
import { TurnHistory } from "@/components/TurnHistory";
import { PlayerCard } from "@/components/PlayerCard";
import { useEffect, useState } from "react";
import {
  FinishRule,
  Player,
  StartingScore,
  Turn,
  scoreTurn,
  validateTurnScore,
} from "@/lib/scoring";

type AppView = "score" | "setup" | "stats" | "history";

export default function Home() {
  const [startingScore, setStartingScore] = useState<StartingScore>(501);
  const [finishRule, setFinishRule] = useState<FinishRule>("double_out");
  const [bestOfLegs, setBestOfLegs] = useState<BestOfLegs>(3);
  const [matchType, setMatchType] = useState<MatchType>("singles");
  const [activeView, setActiveView] = useState<AppView>("score");
  const [playerOneName, setPlayerOneName] = useState("Player 1");
  const [playerTwoName, setPlayerTwoName] = useState("Player 2");
  const [teamOneName, setTeamOneName] = useState("Team 1");
  const [teamTwoName, setTeamTwoName] = useState("Team 2");
  const [teamOnePlayerTwoName, setTeamOnePlayerTwoName] = useState("Player 1B");
  const [teamTwoPlayerTwoName, setTeamTwoPlayerTwoName] = useState("Player 2B");

  const [players, setPlayers] = useState<MatchSide[]>([
    createSinglesSide("side-1", "player-1", "Player 1", 501),
    createSinglesSide("side-2", "player-2", "Player 2", 501),
  ]);

  const [currentPlayerIndex, setCurrentPlayerIndex] = useState(0);
  const [startingPlayerIndex, setStartingPlayerIndex] = useState(0);
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
    null
  );

  const [pendingDartsUsedTurn, setPendingDartsUsedTurn] =  useState<Turn | null>(null);

  const legsNeededToWin = Math.ceil(bestOfLegs / 2);

  const quickScores = [26, 41, 45, 60, 81, 85, 100, 121, 140, 180];

  const keypadButtons = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "C", "0", "⌫"];

  const savedMatchKey = "dart-scorekeeper-current-match";

  useEffect(() => {
  const savedMatch = localStorage.getItem(savedMatchKey);

  if (!savedMatch) {
    return;
  }

  try {
    const parsedMatch = JSON.parse(savedMatch) as SavedMatchState;

    setStartingScore(parsedMatch.startingScore);
    setFinishRule(parsedMatch.finishRule);
    setBestOfLegs(parsedMatch.bestOfLegs);
    setMatchType(parsedMatch.matchType ?? "singles");
    setPlayerOneName(parsedMatch.playerOneName);
    setPlayerTwoName(parsedMatch.playerTwoName);
    setTeamOneName(parsedMatch.teamOneName ?? "Team 1");
    setTeamTwoName(parsedMatch.teamTwoName ?? "Team 2");
    setTeamOnePlayerTwoName(parsedMatch.teamOnePlayerTwoName ?? "Player 1B");
    setTeamTwoPlayerTwoName(parsedMatch.teamTwoPlayerTwoName ?? "Player 2B");
    setPlayers(normalizeSavedPlayers(parsedMatch.players));
    setCurrentPlayerIndex(parsedMatch.currentPlayerIndex);
    setStartingPlayerIndex(parsedMatch.startingPlayerIndex);
    setCurrentLegNumber(parsedMatch.currentLegNumber);
    setStartingMemberIndexBySide(
      parsedMatch.startingMemberIndexBySide ?? {
        "side-1": 0,
        "side-2": 0,
      }
    );
    setTurnHistory(parsedMatch.turnHistory);
    setCompletedLegs(parsedMatch.completedLegs);
    setIsLegComplete(parsedMatch.isLegComplete);
    setIsMatchComplete(parsedMatch.isMatchComplete);
    setMessage(parsedMatch.message);
  } catch {
    localStorage.removeItem(savedMatchKey);
  }
}, []);

useEffect(() => {
  const matchState: SavedMatchState = {
    startingScore,
    finishRule,
    bestOfLegs,
    matchType,
    playerOneName,
    playerTwoName,
    teamOneName,
    teamTwoName,
    teamOnePlayerTwoName,
    teamTwoPlayerTwoName,
    players,
    currentPlayerIndex,
    startingPlayerIndex,
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
  startingScore,
  finishRule,
  bestOfLegs,
  matchType,
  playerOneName,
  playerTwoName,
  teamOneName,
  teamTwoName,
  teamOnePlayerTwoName,
  teamTwoPlayerTwoName,
  players,
  currentPlayerIndex,
  startingPlayerIndex,
  currentLegNumber,
  startingMemberIndexBySide,
  turnHistory,
  completedLegs,
  isLegComplete,
  isMatchComplete,
  message,
]);

  function hasMatchActivity() {
    if (isMatchComplete) {
      return false;
    }

    return turnHistory.length > 0 || completedLegs.length > 0 || currentLegNumber > 1;
  }

  function getTabClass(view: AppView) {
    return activeView === view
      ? "rounded-xl bg-blue-600 px-4 py-3 font-bold text-white"
      : "rounded-xl bg-slate-800 hover:bg-slate-700 px-4 py-3 font-bold text-slate-300";
  }

  function normalizeSavedPlayers(savedPlayers: Array<MatchSide | MatchPlayer>): MatchSide[] {
    return savedPlayers.map((savedPlayer, index) => {
      if ("members" in savedPlayer && savedPlayer.members.length > 0) {
        return savedPlayer;
      }

      return {
        id: savedPlayer.id,
        name: savedPlayer.name,
        score: savedPlayer.score,
        legsWon: savedPlayer.legsWon,
        members: [
          {
            id: `player-${index + 1}`,
            name: savedPlayer.name,
          },
        ],
        currentMemberIndex: 0,
      };
    });
  }

  function startNewGame() {
    const newPlayers: MatchSide[] =
      matchType === "doubles"
        ? [
            createDoublesSide(
              "side-1",
              teamOneName.trim() || "Team 1",
              "player-1a",
              playerOneName.trim() || "Player 1A",
              "player-1b",
              teamOnePlayerTwoName.trim() || "Player 1B",
              startingScore
            ),
            createDoublesSide(
              "side-2",
              teamTwoName.trim() || "Team 2",
              "player-2a",
              playerTwoName.trim() || "Player 2A",
              "player-2b",
              teamTwoPlayerTwoName.trim() || "Player 2B",
              startingScore
            ),
          ]
        : [
            createSinglesSide(
              "side-1",
              "player-1",
              playerOneName.trim() || "Player 1",
              startingScore
            ),
            createSinglesSide(
              "side-2",
              "player-2",
              playerTwoName.trim() || "Player 2",
              startingScore
            ),
          ];

    setPlayers(newPlayers);
    setCurrentPlayerIndex(0);
    setStartingPlayerIndex(0);
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
    setMessage(`${newPlayers[0].name} to throw`);
  }

    function handleStartNewGame() {
    if (hasMatchActivity()) {
      const shouldReset = window.confirm(
        "This will reset the current match and clear the current score. Continue?"
      );

      if (!shouldReset) {
        return;
      }
    }

    startNewGame();
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

    const resetPlayers: MatchSide[] = [
      createSinglesSide("side-1", "player-1", "Player 1", 501),
      createSinglesSide("side-2", "player-2", "Player 2", 501),
    ];

      setStartingScore(501);
      setFinishRule("double_out");
      setBestOfLegs(3);
      setMatchType("singles");
      setPlayerOneName("Player 1");
      setPlayerTwoName("Player 2");
      setTeamOneName("Team 1");
      setTeamTwoName("Team 2");
      setTeamOnePlayerTwoName("Player 1B");
      setTeamTwoPlayerTwoName("Player 2B");
      setPlayers(resetPlayers);
      setCurrentPlayerIndex(0);
      setStartingPlayerIndex(0);
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

    const currentPlayer = players[currentPlayerIndex];
    const scoreEntered = Number(scoreInput);
    const result = scoreTurn(currentPlayer, scoreEntered, finishRule);

    const turnWithThrower: Turn = {
      ...result.turn,
      throwerId: currentPlayer.members[currentPlayer.currentMemberIndex]?.id,
      throwerName: getCurrentThrowerName(currentPlayer),
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
        `${resultWithThrower.turn.throwerName ?? resultWithThrower.turn.playerName} checked out. How many darts were used?`
      );
      return;
    }

    setTurnHistory((previousHistory) => [
      resultWithThrower.turn,
      ...previousHistory,
    ]);

    if (!resultWithThrower.turn.isBust) {
      const updatedPlayers = [...players];
      updatedPlayers[currentPlayerIndex] = {
        ...updatedPlayers[currentPlayerIndex],
        score: resultWithThrower.updatedPlayer.score,
        currentMemberIndex: getNextMemberIndex(updatedPlayers[currentPlayerIndex]),
      };
      setPlayers(updatedPlayers);
    } else {
      advanceCurrentSideMember();
    }

    const nextPlayerIndex = getNextPlayerIndex();
    setCurrentPlayerIndex(nextPlayerIndex);

    const nextPlayerName = players[nextPlayerIndex].name;
    const nextThrowerName = getCurrentThrowerName(players[nextPlayerIndex]);

    setMessage(
      `${resultWithThrower.message} ${nextThrowerName} (${nextPlayerName}) to throw.`
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
    setPlayers((currentPlayers) => {
      const updatedPlayers = [...currentPlayers];
      const currentSide = updatedPlayers[currentPlayerIndex];

      updatedPlayers[currentPlayerIndex] = {
        ...currentSide,
        currentMemberIndex: getNextMemberIndex(currentSide),
      };

      return updatedPlayers;
    });
  }

  function confirmDoubleOut(wasDouble: boolean) {
    if (!pendingCheckoutTurn) {
      return;
    }

    if (wasDouble) {
      setPendingDartsUsedTurn(pendingCheckoutTurn);
      setMessage(
        `${pendingCheckoutTurn.playerName} checked out. How many darts were used?`
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

      const nextPlayerIndex = getNextPlayerIndex();
      const nextThrowerName = getCurrentThrowerName(players[nextPlayerIndex]);

      setCurrentPlayerIndex(nextPlayerIndex);
      setMessage(
        `${pendingCheckoutTurn.throwerName ?? pendingCheckoutTurn.playerName} busts! ${nextThrowerName} (${players[nextPlayerIndex].name}) to throw.`
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

  const updatedPlayers = players.map((player) => {
    if (player.id !== completedTurn.playerId) {
      return player;
    }

    return {
      ...player,
      score: 0,
    };
  });

  setPlayers(
    updatedPlayers.map((player) => {
      if (player.id !== completedTurn.playerId) {
        return player;
      }

      return {
        ...player,
        currentMemberIndex: getNextMemberIndex(player),
      };
    })
  );

  setTurnHistory((previousHistory) => [completedTurn, ...previousHistory]);
  setPendingDartsUsedTurn(null);
  finishLeg(completedTurn.playerId, completedTurn);
  }

  function finishLeg(winnerPlayerId: string, winningTurn?: Turn) {
  const updatedPlayers = players.map((player) => {
    if (player.id !== winnerPlayerId) {
      return player;
    }

    return {
      ...player,
      score: 0,
      legsWon: player.legsWon + 1,
    };
  });

  const winner = updatedPlayers.find((player) => player.id === winnerPlayerId);

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
  setPlayers(updatedPlayers);
  setIsLegComplete(true);

  if (winner.legsWon >= legsNeededToWin) {
    setIsMatchComplete(true);
    setMessage(
      `${winner.name} wins the match ${winner.legsWon}-${getOpponentLegs(
        updatedPlayers,
        winner.id
      )}!`
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

    const nextStartingPlayerIndex = startingPlayerIndex === 0 ? 1 : 0;
    const nextStartingSide = players[nextStartingPlayerIndex];

    const nextStartingMemberIndexBySide = {
      ...startingMemberIndexBySide,
    };

    if (nextStartingSide.members.length > 1) {
      nextStartingMemberIndexBySide[nextStartingSide.id] = getNextMemberIndex({
        ...nextStartingSide,
        currentMemberIndex:
          startingMemberIndexBySide[nextStartingSide.id] ?? 0,
      });
    }

    const resetPlayers = players.map((player) => ({
      ...player,
      score: startingScore,
      currentMemberIndex: nextStartingMemberIndexBySide[player.id] ?? 0,
    }));

    setPlayers(resetPlayers);
    setStartingMemberIndexBySide(nextStartingMemberIndexBySide);
    setStartingPlayerIndex(nextStartingPlayerIndex);
    setCurrentPlayerIndex(nextStartingPlayerIndex);
    setCurrentLegNumber((previousLegNumber) => previousLegNumber + 1);
    setTurnHistory([]);
    setScoreInput("");
    setIsLegComplete(false);
    setPendingCheckoutTurn(null);
    setPendingDartsUsedTurn(null);

    const startingSide = resetPlayers[nextStartingPlayerIndex];
    const startingThrower = getCurrentThrowerName(startingSide);

    setMessage(`${startingThrower} (${startingSide.name}) to throw`);
  }
   function getOpponentLegs(playerList: MatchSide[], winnerPlayerId: string) {
    const opponent = playerList.find((player) => player.id !== winnerPlayerId);
    return opponent?.legsWon ?? 0;
  }

  function getAllMatchTurns(): Turn[] {
    const completedLegTurns = completedLegs.flatMap((leg) => leg.turns);

    const currentLegIsAlreadySaved = completedLegs.some(
      (leg) => leg.legNumber === currentLegNumber
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

  const count180s = scoringTurns.filter((turn) => turn.scoreEntered === 180).length;

  const count140Plus = scoringTurns.filter(
    (turn) => turn.scoreEntered >= 140
  ).length;

  const count100Plus = scoringTurns.filter(
    (turn) => turn.scoreEntered >= 100
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
  return players.map((player) => `${player.name}: ${player.legsWon}`).join(" | ");
}

function getMatchWinnerName(): string | null {
  const winner = players.find((player) => player.legsWon >= legsNeededToWin);

  return winner?.name ?? null;
}

  function getNextPlayerIndex() {
    return currentPlayerIndex === 0 ? 1 : 0;
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

  const restoredPlayers = players.map((player) => {
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

  const restoredPlayerIndex = restoredPlayers.findIndex(
    (player) => player.id === lastTurn.playerId
  );

  setPlayers(restoredPlayers);
  setCurrentPlayerIndex(restoredPlayerIndex);
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
          <button onClick={() => setActiveView("score")} className={getTabClass("score")}>
            Score
          </button>

          <button onClick={() => setActiveView("setup")} className={getTabClass("setup")}>
            Setup
          </button>

          <button onClick={() => setActiveView("stats")} className={getTabClass("stats")}>
            Stats
          </button>

          <button onClick={() => setActiveView("history")} className={getTabClass("history")}>
            History
          </button>
        </nav>

      {activeView === "setup" && (
        <GameSetup
          playerOneName={playerOneName}
          playerTwoName={playerTwoName}
          teamOneName={teamOneName}
          teamTwoName={teamTwoName}
          teamOnePlayerTwoName={teamOnePlayerTwoName}
          teamTwoPlayerTwoName={teamTwoPlayerTwoName}
          startingScore={startingScore}
          finishRule={finishRule}
          bestOfLegs={bestOfLegs}
          matchType={matchType}
          setPlayerOneName={setPlayerOneName}
          setPlayerTwoName={setPlayerTwoName}
          setTeamOneName={setTeamOneName}
          setTeamTwoName={setTeamTwoName}
          setTeamOnePlayerTwoName={setTeamOnePlayerTwoName}
          setTeamTwoPlayerTwoName={setTeamTwoPlayerTwoName}
          setStartingScore={setStartingScore}
          setFinishRule={setFinishRule}
          setBestOfLegs={setBestOfLegs}
          setMatchType={setMatchType}
          startNewGame={handleStartNewGame}
          clearSavedMatch={clearSavedMatch}
        />
      )}


{activeView === "score" && (
  <>
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
          <div className="text-2xl font-bold">{legsNeededToWin} legs</div>
        </div>
      </div>
    </section>

    <section className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
      {players.map((player, index) => (
        <PlayerCard
          key={player.id}
          player={player}
          isCurrentPlayer={index === currentPlayerIndex}
          isLegComplete={isLegComplete}
          isMatchComplete={isMatchComplete}
          finishRule={finishRule}
          stats={getPlayerStats(player.id)}
        />
      ))}
    </section>

    <ScoreEntry
      message={message}
      scoreInput={scoreInput}
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
    />
  </>
)}

{activeView === "stats" && (
  <MatchSummary
    players={players}
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