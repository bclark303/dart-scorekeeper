"use client";

import { useEffect, useState } from "react";
import {
  FinishRule,
  Player,
  StartingScore,
  Turn,
  getCheckoutSuggestion,
  scoreTurn,
  validateTurnScore,
} from "@/lib/scoring";

type MatchPlayer = Player & {
  legsWon: number;
};

type BestOfLegs = 1 | 3 | 5 | 7 | 9;

type PlayerStats = {
  pointsScored: number;
  dartsThrown: number;
  threeDartAverage: number;
};

type CompletedLeg = {
  legNumber: number;
  winnerId: string;
  winnerName: string;
  turns: Turn[];
};

type SavedMatchState = {
  startingScore: StartingScore;
  finishRule: FinishRule;
  bestOfLegs: BestOfLegs;
  playerOneName: string;
  playerTwoName: string;
  players: MatchPlayer[];
  currentPlayerIndex: number;
  startingPlayerIndex: number;
  currentLegNumber: number;
  turnHistory: Turn[];
  completedLegs: CompletedLeg[];
  isLegComplete: boolean;
  isMatchComplete: boolean;
  message: string;
};

export default function Home() {
  const [startingScore, setStartingScore] = useState<StartingScore>(501);
  const [finishRule, setFinishRule] = useState<FinishRule>("double_out");
  const [bestOfLegs, setBestOfLegs] = useState<BestOfLegs>(3);

  const [playerOneName, setPlayerOneName] = useState("Player 1");
  const [playerTwoName, setPlayerTwoName] = useState("Player 2");

  const [players, setPlayers] = useState<MatchPlayer[]>([
    { id: "player-1", name: "Player 1", score: 501, legsWon: 0 },
    { id: "player-2", name: "Player 2", score: 501, legsWon: 0 },
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
    setPlayerOneName(parsedMatch.playerOneName);
    setPlayerTwoName(parsedMatch.playerTwoName);
    setPlayers(parsedMatch.players);
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
    playerOneName,
    playerTwoName,
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

  function getPlayerCheckoutText(player: MatchPlayer): string | null {
  if (finishRule !== "double_out") {
    return null;
  }

  return getCheckoutSuggestion(player.score);
}

  function startNewGame() {
    const newPlayers: MatchPlayer[] = [
      {
        id: "player-1",
        name: playerOneName.trim() || "Player 1",
        score: startingScore,
        legsWon: 0,
      },
      {
        id: "player-2",
        name: playerTwoName.trim() || "Player 2",
        score: startingScore,
        legsWon: 0,
      },
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
    setMessage(`${newPlayers[0].name} to throw`);
  }

  function clearSavedMatch() {
  localStorage.removeItem(savedMatchKey);

      const resetPlayers: MatchPlayer[] = [
        {
          id: "player-1",
          name: "Player 1",
          score: 501,
          legsWon: 0,
        },
        {
          id: "player-2",
          name: "Player 2",
          score: 501,
          legsWon: 0,
        },
      ];

      setStartingScore(501);
      setFinishRule("double_out");
      setBestOfLegs(3);
      setPlayerOneName("Player 1");
      setPlayerTwoName("Player 2");
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

    if (pendingCheckoutTurn) {
      setMessage("Confirm the checkout before entering another score.");
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

    setTurnHistory((previousHistory) => [result.turn, ...previousHistory]);

    if (!result.turn.isBust) {
      const updatedPlayers = [...players];
      updatedPlayers[currentPlayerIndex] = {
        ...updatedPlayers[currentPlayerIndex],
        score: result.updatedPlayer.score,
      };
      setPlayers(updatedPlayers);
    }

    if (result.isLegComplete) {
  finishLeg(result.turn.playerId, result.turn);
  return;
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
      const updatedPlayers = players.map((player) => {
        if (player.id !== pendingCheckoutTurn.playerId) {
          return player;
        }

        return {
          ...player,
          score: 0,
        };
      });

      setPlayers(updatedPlayers);
      setTurnHistory((previousHistory) => [
        pendingCheckoutTurn,
        ...previousHistory,
      ]);
      setPendingCheckoutTurn(null);
      finishLeg(pendingCheckoutTurn.playerId, pendingCheckoutTurn);
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

  function getOpponentLegs(playerList: MatchPlayer[], winnerPlayerId: string) {
    const opponent = playerList.find((player) => player.id !== winnerPlayerId);
    return opponent?.legsWon ?? 0;
  }

  function getAllMatchTurns(): Turn[] {
  const completedLegTurns = completedLegs.flatMap((leg) => leg.turns);

  return [...turnHistory, ...completedLegTurns];
}

function getPlayerStats(playerId: string): PlayerStats {
  const allTurns = getAllMatchTurns();

  const playerTurns = allTurns.filter(
    (turn) => turn.playerId === playerId && !turn.isBust
  );

  const pointsScored = playerTurns.reduce((total, turn) => {
    return total + turn.scoreEntered;
  }, 0);

  const dartsThrown = playerTurns.length * 3;

  const threeDartAverage =
    dartsThrown === 0 ? 0 : (pointsScored / dartsThrown) * 3;

  return {
    pointsScored,
    dartsThrown,
    threeDartAverage,
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

        <section className="rounded-2xl bg-slate-900 border border-slate-700 p-6 mb-8">
          <h2 className="text-2xl font-bold mb-4">Game Setup</h2>

          <div className="grid grid-cols-1 sm:grid-cols-5 gap-4 mb-4">
            <label className="block">
              <span className="block text-slate-300 mb-2">Player 1</span>
              <input
                className="w-full rounded-xl bg-slate-800 border border-slate-600 p-3"
                value={playerOneName}
                onChange={(event) => setPlayerOneName(event.target.value)}
              />
            </label>

            <label className="block">
              <span className="block text-slate-300 mb-2">Player 2</span>
              <input
                className="w-full rounded-xl bg-slate-800 border border-slate-600 p-3"
                value={playerTwoName}
                onChange={(event) => setPlayerTwoName(event.target.value)}
              />
            </label>

            <label className="block">
              <span className="block text-slate-300 mb-2">Game</span>
              <select
                className="w-full rounded-xl bg-slate-800 border border-slate-600 p-3"
                value={startingScore}
                onChange={(event) =>
                  setStartingScore(Number(event.target.value) as StartingScore)
                }
              >
                <option value={301}>301</option>
                <option value={501}>501</option>
                <option value={701}>701</option>
              </select>
            </label>

            <label className="block">
              <span className="block text-slate-300 mb-2">Finish</span>
              <select
                className="w-full rounded-xl bg-slate-800 border border-slate-600 p-3"
                value={finishRule}
                onChange={(event) =>
                  setFinishRule(event.target.value as FinishRule)
                }
              >
                <option value="double_out">Double Out</option>
                <option value="straight_out">Straight Out</option>
              </select>
            </label>

            <label className="block">
              <span className="block text-slate-300 mb-2">Legs</span>
              <select
                className="w-full rounded-xl bg-slate-800 border border-slate-600 p-3"
                value={bestOfLegs}
                onChange={(event) =>
                  setBestOfLegs(Number(event.target.value) as BestOfLegs)
                }
              >
                <option value={1}>Best of 1</option>
                <option value={3}>Best of 3</option>
                <option value={5}>Best of 5</option>
                <option value={7}>Best of 7</option>
                <option value={9}>Best of 9</option>
              </select>
            </label>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <button
              onClick={startNewGame}
              className="rounded-xl bg-blue-600 hover:bg-blue-500 px-6 py-3 text-lg font-bold"
            >
              Start / Reset Match
            </button>

            <button
              onClick={clearSavedMatch}
              className="rounded-xl bg-slate-700 hover:bg-slate-600 px-6 py-3 text-lg font-bold"
            >
              Clear Saved Match
            </button>
          </div>
        </section>

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
            <div
              key={player.id}
              className={`rounded-2xl p-6 border ${
                index === currentPlayerIndex && !isLegComplete && !isMatchComplete
                  ? "border-green-400 bg-slate-800"
                  : "border-slate-700 bg-slate-900"
              }`}
            >
              <h2 className="text-2xl font-semibold mb-2">{player.name}</h2>
              <div className="text-6xl font-bold">{player.score}</div>
              <div className="mt-4 grid grid-cols-1 gap-2 text-xl">
                <div>
                  Legs won: <span className="font-bold">{player.legsWon}</span>
                </div>

                <div>
                  Avg:{" "}
                  <span className="font-bold">
                    {getPlayerStats(player.id).threeDartAverage.toFixed(1)}
                  </span>
                </div>

                <div className="text-base text-slate-400">
                  Points: {getPlayerStats(player.id).pointsScored} | Darts:{" "}
                  {getPlayerStats(player.id).dartsThrown}
                </div>

                {getPlayerCheckoutText(player) && (
                  <div className="mt-3 rounded-xl border border-green-500/40 bg-green-950/40 p-3">
                    <div className="text-sm text-green-300">Checkout</div>
                    <div className="text-xl font-bold text-green-100">
                      {getPlayerCheckoutText(player)}
                    </div>
                  </div>
                )}
              </div>
              {index === currentPlayerIndex && !isLegComplete && !isMatchComplete && (
                <div className="mt-4 text-green-300 font-semibold">
                  Current throw
                </div>
              )}
            </div>
          ))}
        </section>

        <section className="rounded-2xl bg-slate-900 border border-slate-700 p-6 mb-8">
          <div className="text-xl mb-4">{message}</div>

          {isLegComplete && !isMatchComplete && (
            <button
              onClick={startNextLeg}
              className="mb-4 w-full rounded-xl bg-purple-600 hover:bg-purple-500 p-4 text-xl font-bold"
            >
              Start Next Leg
            </button>
          )}

          {pendingCheckoutTurn ? (
            <div className="rounded-2xl bg-slate-800 border border-slate-700 p-4 mb-4">
              <div className="text-lg font-semibold mb-4">
                Confirm double-out checkout
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <button
                  onClick={() => confirmDoubleOut(true)}
                  className="rounded-xl bg-green-600 hover:bg-green-500 p-4 text-xl font-bold"
                >
                  Yes, final dart was a double
                </button>

                <button
                  onClick={() => confirmDoubleOut(false)}
                  className="rounded-xl bg-red-600 hover:bg-red-500 p-4 text-xl font-bold"
                >
                  No, bust
                </button>
              </div>
            </div>
          ) : (
            !isLegComplete &&
            !isMatchComplete && (
              <>
                <label className="block mb-2 text-slate-300">
                  Score this turn
                </label>

                <input
                  className="w-full rounded-xl bg-slate-800 border border-slate-600 p-4 text-3xl mb-4"
                  value={scoreInput}
                  onChange={(event) => setScoreInput(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      submitScore();
                    }
                  }}
                  inputMode="numeric"
                  autoFocus
                />
                <div className="mb-4">
                  <div className="mb-2 text-slate-300">Quick scores</div>

                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                    {quickScores.map((score) => (
                      <button
                        key={score}
                        onClick={() => setQuickScore(score)}
                        className="rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-600 p-4 text-xl font-bold"
                      >
                        {score}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="mb-4">
                  <div className="mb-2 text-slate-300">Keypad</div>

                  <div className="grid grid-cols-3 gap-3">
                    {keypadButtons.map((button) => (
                      <button
                        key={button}
                        onClick={() => {
                          if (button === "C") {
                            setScoreInput("");
                            return;
                          }

                          if (button === "⌫") {
                            backspaceScoreInput();
                            return;
                          }

                          appendScoreDigit(button);
                        }}
                        className="rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-600 p-5 text-2xl font-bold"
                      >
                        {button}
                      </button>
                    ))}
                  </div>
                </div>

                <button
                  onClick={submitScore}
                  className="w-full rounded-xl bg-green-600 hover:bg-green-500 p-4 text-xl font-bold"
                >
                  Enter Score
                </button>
              </>
            )
          )}

          <button
            onClick={undoLastTurn}
            className="mt-4 w-full rounded-xl bg-amber-600 hover:bg-amber-500 p-4 text-xl font-bold"
          >
            Undo Last Turn
          </button>
        </section>

        <section className="rounded-2xl bg-slate-900 border border-slate-700 p-6">
          <h2 className="text-2xl font-bold mb-4">Current Leg History</h2>

          {turnHistory.length === 0 ? (
            <p className="text-slate-400">No turns yet.</p>
          ) : (
            <div className="space-y-3">
              {turnHistory.map((turn) => (
                <div
                  key={turn.id}
                  className="rounded-xl bg-slate-800 border border-slate-700 p-4"
                >
                  <div className="font-semibold">
                    {turn.playerName} scored {turn.scoreEntered}
                    {turn.isBust ? " — BUST" : ""}
                    {turn.isCheckout ? " — CHECKOUT" : ""}
                  </div>
                  <div className="text-slate-300">
                    {turn.scoreBefore} → {turn.scoreAfter}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
        <section className="mt-8 rounded-2xl bg-slate-900 border border-slate-700 p-6">
          <h2 className="text-2xl font-bold mb-4">Completed Legs</h2>

          {completedLegs.length === 0 ? (
            <p className="text-slate-400">No completed legs yet.</p>
          ) : (
            <div className="space-y-4">
              {completedLegs.map((leg) => (
                <div
                  key={leg.legNumber}
                  className="rounded-xl bg-slate-800 border border-slate-700 p-4"
                >
                  <div className="text-lg font-bold">
                    Leg {leg.legNumber}: {leg.winnerName} won
                  </div>

                  <div className="text-slate-300">
                    Turns thrown: {leg.turns.length}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
        <section className="mt-8 rounded-2xl bg-slate-900 border border-slate-700 p-6">
  <h2 className="text-2xl font-bold mb-4">Match Summary</h2>

  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
    <div className="rounded-xl bg-slate-800 border border-slate-700 p-4">
      <div className="text-slate-400">Status</div>
      <div className="text-xl font-bold">
        {isMatchComplete ? "Complete" : isLegComplete ? "Between legs" : "In progress"}
      </div>
    </div>

    <div className="rounded-xl bg-slate-800 border border-slate-700 p-4">
      <div className="text-slate-400">Match Score</div>
      <div className="text-xl font-bold">{getMatchScoreText()}</div>
    </div>

    <div className="rounded-xl bg-slate-800 border border-slate-700 p-4">
      <div className="text-slate-400">Current Leg</div>
      <div className="text-xl font-bold">{currentLegNumber}</div>
    </div>

    <div className="rounded-xl bg-slate-800 border border-slate-700 p-4">
      <div className="text-slate-400">Winner</div>
      <div className="text-xl font-bold">
        {getMatchWinnerName() ?? "Not decided"}
      </div>
    </div>
  </div>

  <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
    {players.map((player) => {
      const stats = getPlayerStats(player.id);

      return (
        <div
          key={player.id}
          className="rounded-xl bg-slate-800 border border-slate-700 p-4"
        >
          <div className="text-xl font-bold mb-2">{player.name}</div>
          <div className="text-slate-300">
            Legs won: <span className="font-bold text-white">{player.legsWon}</span>
          </div>
          <div className="text-slate-300">
            Match average:{" "}
            <span className="font-bold text-white">
              {stats.threeDartAverage.toFixed(1)}
            </span>
          </div>
          <div className="text-slate-300">
            Points scored:{" "}
            <span className="font-bold text-white">{stats.pointsScored}</span>
          </div>
          <div className="text-slate-300">
            Darts counted:{" "}
            <span className="font-bold text-white">{stats.dartsThrown}</span>
          </div>
        </div>
      );
    })}
  </div>
</section>
      </div>
    </main>
  );
}