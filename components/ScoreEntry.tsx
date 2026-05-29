import { Turn } from "@/lib/scoring";

type ScoreEntryProps = {
  message: string;
  scoreInput: string;
  compact: boolean;
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
  compact,
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
    <section
      className={`rounded-2xl bg-[var(--color-panel)] border border-[var(--color-panel-border)] mb-8 ${
        compact ? "p-4" : "p-6"
      }`}
    >
      <div className={compact ? "text-lg mb-3" : "text-xl mb-4"}>{message}</div>

      {isMatchComplete && (
        <div className="rounded-2xl bg-[var(--color-panel-soft)] border border-[var(--color-panel-border)] p-4 mb-4">
          <div className="text-lg font-bold mb-4">Match complete</div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <button
              onClick={undoLastTurn}
              className="rounded-xl bg-[var(--color-warning)] hover:bg-[var(--color-warning-hover)] p-4 text-xl font-bold"
            >
              Undo Last Turn
            </button>

            <button
              onClick={replayMatch}
              className="rounded-xl bg-[var(--color-success)] hover:bg-[var(--color-success-hover)] p-4 text-xl font-bold"
            >
              Replay Match
            </button>

            <button
              onClick={newGameSetup}
              className="rounded-xl bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] p-4 text-xl font-bold"
            >
              New Game / Setup
            </button>

            <button
              onClick={viewFinishedGame}
              className="rounded-xl bg-[var(--color-accent)] hover:bg-[var(--color-accent-hover)] p-4 text-xl font-bold"
            >
              View Match History
            </button>
          </div>
        </div>
      )}

      {isLegComplete && !isMatchComplete && (
        <div className="mb-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
          <button
            onClick={undoLastTurn}
            className="rounded-xl bg-[var(--color-warning)] hover:bg-[var(--color-warning-hover)] p-4 text-xl font-bold"
          >
            Undo Last Turn
          </button>

          <button
            onClick={startNextLeg}
            className="rounded-xl bg-[var(--color-accent)] hover:bg-[var(--color-accent-hover)] p-4 text-xl font-bold"
          >
            Start Next Leg
          </button>
        </div>
      )}

      {pendingDartsUsedTurn ? (
        <div className="rounded-2xl bg-[var(--color-panel-soft)] border border-[var(--color-panel-border)] p-4 mb-4">
          <div className="text-lg font-semibold mb-4">
            How many darts were used to finish?
          </div>

          <div className="grid grid-cols-3 gap-4">
            <button
              onClick={() => confirmCheckoutDartsUsed(1)}
              className="rounded-xl bg-[var(--color-success)] hover:bg-[var(--color-success-hover)] p-4 text-xl font-bold"
            >
              1 Dart
            </button>

            <button
              onClick={() => confirmCheckoutDartsUsed(2)}
              className="rounded-xl bg-[var(--color-success)] hover:bg-[var(--color-success-hover)] p-4 text-xl font-bold"
            >
              2 Darts
            </button>

            <button
              onClick={() => confirmCheckoutDartsUsed(3)}
              className="rounded-xl bg-[var(--color-success)] hover:bg-[var(--color-success-hover)] p-4 text-xl font-bold"
            >
              3 Darts
            </button>
          </div>
        </div>
      ) : pendingCheckoutTurn ? (
        <div className="rounded-2xl bg-[var(--color-panel-soft)] border border-[var(--color-panel-border)] p-4 mb-4">
          <div className="text-lg font-semibold mb-4">
            Confirm double-out checkout
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <button
              onClick={() => confirmDoubleOut(true)}
              className="rounded-xl bg-[var(--color-success)] hover:bg-[var(--color-success-hover)] p-4 text-xl font-bold"
            >
              Yes, final dart was a double
            </button>

            <button
              onClick={() => confirmDoubleOut(false)}
              className="rounded-xl bg-[var(--color-danger)] hover:bg-[var(--color-danger-hover)] p-4 text-xl font-bold"
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
              <div className="rounded-2xl bg-[var(--color-panel-soft)] border border-[var(--color-panel-border)] p-4">
                <div className="text-lg font-bold mb-2">Dummy player turn</div>

                <p className="text-[var(--color-text-muted)] mb-4">
                  This slot will automatically score{" "}
                  <span className="font-bold text-[var(--color-text-main)]">
                    {dummyScore}
                  </span>
                  .
                </p>

                <button
                  onClick={submitDummyScore}
                  className="w-full rounded-xl bg-[var(--color-accent)] hover:bg-[var(--color-accent-hover)] p-4 text-xl font-bold"
                >
                  Apply Dummy Score
                </button>
              </div>
            ) : (
              <>
                <label className="block mb-2 text-[var(--color-text-muted)]">
                  Score this turn
                </label>

                <div className="mb-4 grid grid-cols-2 gap-3">
                  <input
                    className={`w-full rounded-xl bg-[var(--color-panel-soft)] border border-[var(--color-panel-border)] text-center ${
                      compact ? "p-3 text-3xl" : "p-4 text-3xl"
                    }`}
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

                  <button
                    onClick={submitScore}
                    className={`rounded-xl bg-[var(--color-success)] hover:bg-[var(--color-success-hover)] font-bold whitespace-nowrap ${
                      compact ? "px-5 py-3 text-lg" : "px-6 py-4 text-xl"
                    }`}
                  >
                    Enter Score
                  </button>
                </div>

                <div className="mb-4">
                  <div className="mb-2 text-[var(--color-text-muted)]">
                    Quick scores
                  </div>

                  <div
                    className={
                      compact
                        ? "grid grid-cols-5 gap-2"
                        : "grid grid-cols-2 sm:grid-cols-5 gap-3"
                    }
                  >
                    {quickScores.map((score) => (
                      <button
                        key={score}
                        onClick={() => setQuickScore(score)}
                        className={`rounded-xl bg-[var(--color-panel-soft)] hover:bg-[var(--color-panel-border)] border border-[var(--color-panel-border)] font-bold ${
                          compact ? "p-3 text-lg" : "p-4 text-xl"
                        }`}
                      >
                        {score}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="mb-4">
                  <div className="mb-2 text-[var(--color-text-muted)]">
                    Keypad
                  </div>

                  <div
                    className={
                      compact
                        ? "grid grid-cols-3 gap-2"
                        : "grid grid-cols-3 gap-3"
                    }
                  >
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
                        className={`rounded-xl bg-[var(--color-panel-soft)] hover:bg-[var(--color-panel-border)] border border-[var(--color-panel-border)] font-bold ${
                          compact ? "p-3 text-lg" : "p-4 text-xl"
                        }`}
                      >
                        {button}
                      </button>
                    ))}
                  </div>
                </div>
              </>
            )}
          </>
        )
      )}

      <button
        onClick={undoLastTurn}
        className={`mt-4 w-full rounded-xl bg-[var(--color-warning)] hover:bg-[var(--color-warning-hover)] font-bold ${
          compact ? "p-3 text-lg" : "p-4 text-xl"
        }`}
      >
        Undo Last Turn
      </button>
    </section>
  );
}
