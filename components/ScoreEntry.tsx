import { Turn } from "@/lib/scoring";

type ScoreEntryProps = {
  message: string;
  scoreInput: string;
  setScoreInput: (scoreInput: string) => void;
  submitScore: () => void;
  undoLastTurn: () => void;
  startNextLeg: () => void;
  confirmDoubleOut: (wasDouble: boolean) => void;
  confirmCheckoutDartsUsed: (dartsUsed: 1 | 2 | 3) => void;
  appendScoreDigit: (digit: string) => void;
  backspaceScoreInput: () => void;
  setQuickScore: (score: number) => void;
  pendingCheckoutTurn: Turn | null;
  pendingDartsUsedTurn: Turn | null;
  isLegComplete: boolean;
  isMatchComplete: boolean;
  quickScores: number[];
  keypadButtons: string[];
  replayMatch: () => void;
  newGameSetup: () => void;
  viewFinishedGame: () => void;
  isCurrentThrowerDummy: boolean;
  dummyScore: number;
  submitDummyScore: () => void;
};

export function ScoreEntry({
  message,
  scoreInput,
  setScoreInput,
  submitScore,
  undoLastTurn,
  startNextLeg,
  confirmDoubleOut,
  confirmCheckoutDartsUsed,
  appendScoreDigit,
  backspaceScoreInput,
  setQuickScore,
  pendingCheckoutTurn,
  pendingDartsUsedTurn,
  isLegComplete,
  isMatchComplete,
  quickScores,
  keypadButtons,
  replayMatch,
  newGameSetup,
  viewFinishedGame,
  isCurrentThrowerDummy,
  dummyScore,
  submitDummyScore,
}: ScoreEntryProps) {
  return (
    <section className="rounded-2xl bg-slate-900 border border-slate-700 p-6 mb-8">
      <div className="text-xl mb-4">{message}</div>

      {isMatchComplete && (
        <div className="rounded-2xl bg-slate-800 border border-slate-700 p-4 mb-4">
            <div className="text-lg font-bold mb-4">Match complete</div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <button
                onClick={replayMatch}
                className="rounded-xl bg-green-600 hover:bg-green-500 p-4 text-xl font-bold"
            >
                Replay Match
            </button>

            <button
                onClick={newGameSetup}
                className="rounded-xl bg-blue-600 hover:bg-blue-500 p-4 text-xl font-bold"
            >
                New Game / Setup
            </button>

            <button
                onClick={viewFinishedGame}
                className="rounded-xl bg-purple-600 hover:bg-purple-500 p-4 text-xl font-bold"
            >
                View Match History
            </button>
            </div>
        </div>
        )}

      {isLegComplete && !isMatchComplete && (
        <button
          onClick={startNextLeg}
          className="mb-4 w-full rounded-xl bg-purple-600 hover:bg-purple-500 p-4 text-xl font-bold"
        >
          Start Next Leg
        </button>
      )}

      {pendingDartsUsedTurn ? (
        <div className="rounded-2xl bg-slate-800 border border-slate-700 p-4 mb-4">
          <div className="text-lg font-semibold mb-4">
            How many darts were used to finish?
          </div>

          <div className="grid grid-cols-3 gap-4">
            <button
              onClick={() => confirmCheckoutDartsUsed(1)}
              className="rounded-xl bg-green-600 hover:bg-green-500 p-4 text-xl font-bold"
            >
              1 Dart
            </button>

            <button
              onClick={() => confirmCheckoutDartsUsed(2)}
              className="rounded-xl bg-green-600 hover:bg-green-500 p-4 text-xl font-bold"
            >
              2 Darts
            </button>

            <button
              onClick={() => confirmCheckoutDartsUsed(3)}
              className="rounded-xl bg-green-600 hover:bg-green-500 p-4 text-xl font-bold"
            >
              3 Darts
            </button>
          </div>
        </div>
      ) : pendingCheckoutTurn ? (
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
            {isCurrentThrowerDummy ? (
                <div className="rounded-2xl bg-slate-800 border border-slate-700 p-4">
                    <div className="text-lg font-bold mb-2">Dummy player turn</div>

                    <p className="text-slate-300 mb-4">
                    This slot will automatically score{" "}
                    <span className="font-bold text-white">{dummyScore}</span>.
                    </p>

                    <button
                    onClick={submitDummyScore}
                    className="w-full rounded-xl bg-purple-600 hover:bg-purple-500 p-4 text-xl font-bold"
                    >
                    Apply Dummy Score
                    </button>
                </div>
                ) : (
                <>
                    <label className="block mb-2 text-slate-300">Score this turn</label>

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
                )}
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
  );
}