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

export default function Home() {
  const [startingScore, setStartingScore] = useState<StartingScore>(501);
  const [finishRule, setFinishRule] = useState<FinishRule>("double_out");
  const [bestOfLegs, setBestOfLegs] = useState<BestOfLegs>(3);
  const [matchType, setMatchType] = useState<MatchType>("singles");

  const [playerOneName, setPlayerOneName] = useState("Player 1");
  const [playerTwoName, setPlayerTwoName] = useState("Player 2");
  const [teamOnePlayerTwoName, setTeamOnePlayerTwoName] = useState("Player 1B");
  const [teamTwoPlayerTwoName, setTeamTwoPlayerTwoName] = useState("Player 2B");

  const [players, setPlayers] = useState<MatchSide[]>([
    createSinglesSide("side-1", "player-1", "Player 1", 501),
    createSinglesSide("side-2", "player-2", "Player 2", 501),
  ]);

  const [currentPlayerIndex, setCurrentPlayerIndex] = useState(0);
  const [startingPlayerIndex, setStartingPlayerIndex] = useState(0);
  const [currentLegNumber, setCurrentLegNumber] = useState(1);
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
    setTeamOnePlayerTwoName(parsedMatch.teamOnePlayerTwoName ?? "Player 1B");
    setTeamTwoPlayerTwoName(parsedMatch.teamTwoPlayerTwoName ?? "Player 2B");
    setPlayers(normalizeSavedPlayers(parsedMatch.players));
    setCurrentPlayerIndex(parsedMatch.currentPlayerIndex);
    setStartingPlayerIndex(parsedMatch.startingPlayerIndex);
    setCurrentLegNumber(parsedMatch.currentLegNumber);
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
    teamOnePlayerTwoName,
    teamTwoPlayerTwoName,
    players,
    currentPlayerIndex,
    startingPlayerIndex,
    currentLegNumber,
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
  playerOneName,
  playerTwoName,
  teamOnePlayerTwoName,
  teamTwoPlayerTwoName,
  players,
  currentPlayerIndex,
  startingPlayerIndex,
  currentLegNumber,
  turnHistory,
  completedLegs,
  isLegComplete,
  isMatchComplete,
  message,
]);

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
              "Team 1",
              "player-1a",
              playerOneName.trim() || "Player 1A",
              "player-1b",
              teamOnePlayerTwoName.trim() || "Player 1B",
              startingScore
            ),
            createDoublesSide(
              "side-2",
              "Team 2",
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
    setScoreInput("");
    setTurnHistory([]);
    setCompletedLegs([]);
    setIsLegComplete(false);
    setIsMatchComplete(false);
    setPendingCheckoutTurn(null);
    setPendingDartsUsedTurn(null);
    setMessage(`${newPlayers[0].name} to throw`);
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
      setTeamOnePlayerTwoName("Player 1B");
      setTeamTwoPlayerTwoName("Player 2B");
      setPlayers(resetPlayers);
      setCurrentPlayerIndex(0);
      setStartingPlayerIndex(0);
      setCurrentLegNumber(1);
      setScoreInput("");
      setTurnHistory([]);
      setCompletedLegs([]);
      setIsLegComplete(false);
      setIsMatchComplete(false);
      setPendingCheckoutTurn(null);
      setPendingDartsUsedTurn(null);
      setMessage("Saved match cleared. Player 1 to throw.");
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

  setScoreInput("");

  if (result.needsDoubleOutConfirmation) {
    setPendingCheckoutTurn(result.turn);
    setMessage(result.message);
    return;
  }

  if (result.isLegComplete) {
    setPendingDartsUsedTurn(result.turn);
    setMessage(
      `${result.turn.playerName} checked out. How many darts were used?`
    );
    return;
  }

  setTurnHistory((previousHistory) => [result.turn, ...previousHistory]);

  if (!result.turn.isBust) {
    const updatedPlayers = [...players];
    updatedPlayers[currentPlayerIndex] = {
      ...updatedPlayers[currentPlayerIndex],
      score: result.updatedPlayer.score,
    };
    setPlayers(updatedPlayers);
  }

  const nextPlayerIndex = getNextPlayerIndex();
  setCurrentPlayerIndex(nextPlayerIndex);

  const nextPlayerName = players[nextPlayerIndex].name;
  setMessage(`${result.message} ${nextPlayerName} to throw.`);
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

    const nextPlayerIndex = getNextPlayerIndex();
    setCurrentPlayerIndex(nextPlayerIndex);
    setMessage(
      `${pendingCheckoutTurn.playerName} busts! ${players[nextPlayerIndex].name} to throw.`
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

  setPlayers(updatedPlayers);
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

    const resetPlayers = players.map((player) => ({
      ...player,
      score: startingScore,
    }));

    setPlayers(resetPlayers);
    setStartingPlayerIndex(nextStartingPlayerIndex);
    setCurrentPlayerIndex(nextStartingPlayerIndex);
    setCurrentLegNumber((previousLegNumber) => previousLegNumber + 1);
    setTurnHistory([]);
    setScoreInput("");
    setIsLegComplete(false);
    setPendingCheckoutTurn(null);
    setMessage(`${resetPlayers[nextStartingPlayerIndex].name} to throw`);
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
        <p className="text-slate-300 mb-8">Basic X01 scorer</p>

       <GameSetup
          playerOneName={playerOneName}
          playerTwoName={playerTwoName}
          teamOnePlayerTwoName={teamOnePlayerTwoName}
          teamTwoPlayerTwoName={teamTwoPlayerTwoName}
          startingScore={startingScore}
          finishRule={finishRule}
          bestOfLegs={bestOfLegs}
          matchType={matchType}
          setPlayerOneName={setPlayerOneName}
          setPlayerTwoName={setPlayerTwoName}
          setTeamOnePlayerTwoName={setTeamOnePlayerTwoName}
          setTeamTwoPlayerTwoName={setTeamTwoPlayerTwoName}
          setStartingScore={setStartingScore}
          setFinishRule={setFinishRule}
          setBestOfLegs={setBestOfLegs}
          setMatchType={setMatchType}
          startNewGame={startNewGame}
          clearSavedMatch={clearSavedMatch}
        />

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
        />

        <TurnHistory turns={turnHistory} />

        <CompletedLegs completedLegs={completedLegs} />

        <MatchSummary
          players={players}
          isMatchComplete={isMatchComplete}
          isLegComplete={isLegComplete}
          currentLegNumber={currentLegNumber}
          getMatchScoreText={getMatchScoreText}
          getMatchWinnerName={getMatchWinnerName}
          getPlayerStats={getPlayerStats}
        />
      </div>
    </main>
  );
}