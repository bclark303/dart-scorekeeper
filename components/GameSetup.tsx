import { FinishRule, StartingScore } from "@/lib/scoring";

import { BestOfLegs, RotationMode, TeamSize } from "@/lib/types";

type GameSetupProps = {
  teamOneName: string;
  teamTwoName: string;
  startingScore: StartingScore;
  finishRule: FinishRule;
  bestOfLegs: BestOfLegs;
  setTeamOneName: (name: string) => void;
  setTeamTwoName: (name: string) => void;
  setStartingScore: (score: StartingScore) => void;
  setFinishRule: (finishRule: FinishRule) => void;
  setBestOfLegs: (bestOfLegs: BestOfLegs) => void;
  startNewGame: () => void;
  clearSavedMatch: () => void;
  isResetConfirmationVisible: boolean;
  confirmResetMatch: () => void;
  cancelResetMatch: () => void;
  sideOneSize: TeamSize;
  sideTwoSize: TeamSize;
  teamOneMemberNames: string[];
  teamTwoMemberNames: string[];
  resizeSideOneMembers: (size: TeamSize) => void;
  resizeSideTwoMembers: (size: TeamSize) => void;
  setTeamOneMemberNames: (names: string[]) => void;
  setTeamTwoMemberNames: (names: string[]) => void;
  rotationMode: RotationMode;
  dummyScore: number;
  setRotationMode: (rotationMode: RotationMode) => void;
  setDummyScore: (dummyScore: number) => void;
};

export function GameSetup({
  teamOneName,
  teamTwoName,
  startingScore,
  finishRule,
  bestOfLegs,
  setTeamOneName,
  setTeamTwoName,
  setStartingScore,
  setFinishRule,
  setBestOfLegs,
  startNewGame,
  clearSavedMatch,
  isResetConfirmationVisible,
  confirmResetMatch,
  cancelResetMatch,
  teamOneMemberNames,
  teamTwoMemberNames,
  sideOneSize,
  sideTwoSize,
  resizeSideOneMembers,
  resizeSideTwoMembers,
  setTeamOneMemberNames,
  setTeamTwoMemberNames,
  rotationMode,
  dummyScore,
  setRotationMode,
  setDummyScore,
}: GameSetupProps) {
  return (
    <section className="rounded-2xl bg-[var(--color-panel)] border border-[var(--color-panel-border)] p-6 mb-8">
      <h2 className="text-2xl font-bold mb-6">Game Setup</h2>

      <div className="mb-8">
        <h3 className="text-lg font-bold mb-3 text-[var(--color-text-main)]">
          Match
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-5 lg:grid-cols-4 xl:grid-cols-8 gap-4">
          <label className="block">
            <span className="block text-slate-300 mb-2">Team 1 Size</span>
            <select
              className="w-full rounded-xl bg-[var(--color-panel-soft)] border border-[var(--color-panel-border)] p-3"
              value={sideOneSize}
              onChange={(event) =>
                resizeSideOneMembers(Number(event.target.value) as TeamSize)
              }
            >
              <option value={1}>1 player</option>
              <option value={2}>2 players</option>
              <option value={3}>3 players</option>
              <option value={4}>4 players</option>
              <option value={5}>5 players</option>
            </select>
          </label>

          <label className="block">
            <span className="block text-slate-300 mb-2">Team 2 Size</span>
            <select
              className="w-full rounded-xl bg-[var(--color-panel-soft)] border border-[var(--color-panel-border)] p-3"
              value={sideTwoSize}
              onChange={(event) =>
                resizeSideTwoMembers(Number(event.target.value) as TeamSize)
              }
            >
              <option value={1}>1 player</option>
              <option value={2}>2 players</option>
              <option value={3}>3 players</option>
              <option value={4}>4 players</option>
              <option value={5}>5 players</option>
            </select>
          </label>

          {sideOneSize !== sideTwoSize && (
            <>
              <label className="block">
                <span className="block text-slate-300 mb-2">Rotation</span>
                <select
                  className="w-full rounded-xl bg-[var(--color-panel-soft)] border border-[var(--color-panel-border)] p-3"
                  value={rotationMode}
                  onChange={(event) =>
                    setRotationMode(event.target.value as RotationMode)
                  }
                >
                  <option value="independent">Independent</option>
                  <option value="dummy">Use Dummy Score</option>
                </select>
              </label>

              {rotationMode === "dummy" && (
                <label className="block">
                  <span className="block text-slate-300 mb-2">Dummy Score</span>
                  <input
                    className="w-full rounded-xl bg-[var(--color-panel-soft)] border border-[var(--color-panel-border)] p-3"
                    value={dummyScore}
                    onChange={(event) => {
                      const nextScore = Number(event.target.value);

                      if (Number.isNaN(nextScore)) {
                        setDummyScore(0);
                        return;
                      }

                      setDummyScore(nextScore);
                    }}
                    inputMode="numeric"
                  />
                </label>
              )}
            </>
          )}

          <label className="block">
            <span className="block text-slate-300 mb-2">Game</span>
            <select
              className="w-full rounded-xl bg-[var(--color-panel-soft)] border border-[var(--color-panel-border)] p-3"
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
              className="w-full rounded-xl bg-[var(--color-panel-soft)] border border-[var(--color-panel-border)] p-3"
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
              className="w-full rounded-xl bg-[var(--color-panel-soft)] border border-[var(--color-panel-border)] p-3"
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
      </div>

      <div className="mb-8">
        <h3 className="text-lg font-bold mb-3 text-[var(--color-text-muted)]">
          {sideOneSize === 1 && sideTwoSize === 1 ? "Players" : "Teams"}
        </h3>

        {sideOneSize === 1 && sideTwoSize === 1 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <label className="block">
              <span className="block text-slate-300 mb-2">Player 1</span>
              <input
                className="w-full rounded-xl bg-[var(--color-panel-soft)] border border-[var(--color-panel-border)] p-3"
                value={teamOneMemberNames[0] ?? ""}
                onChange={(event) =>
                  setTeamOneMemberNames([event.target.value])
                }
              />
            </label>

            <label className="block">
              <span className="block text-slate-300 mb-2">Player 2</span>
              <input
                className="w-full rounded-xl bg-[var(--color-panel-soft)] border border-[var(--color-panel-border)] p-3"
                value={teamTwoMemberNames[0] ?? ""}
                onChange={(event) =>
                  setTeamTwoMemberNames([event.target.value])
                }
              />
            </label>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="rounded-xl bg-[var(--color-panel-soft)] border border-[var(--color-panel-border)] p-4">
              <h4 className="font-bold mb-3">Team 1</h4>

              <div className="grid grid-cols-1 gap-4">
                <label className="block">
                  <span className="block text-slate-300 mb-2">Team Name</span>
                  <input
                    className="w-full rounded-xl bg-[var(--color-panel)] border border-[var(--color-panel-border)] p-3"
                    value={teamOneName}
                    onChange={(event) => setTeamOneName(event.target.value)}
                  />
                </label>

                {teamOneMemberNames.map((memberName, index) => (
                  <label key={index} className="block">
                    <span className="block text-slate-300 mb-2">
                      Player {index + 1}
                    </span>
                    <input
                      className="w-full rounded-xl bg-[var(--color-panel)] border border-[var(--color-panel-border)] p-3"
                      value={memberName}
                      onChange={(event) => {
                        const updatedNames = [...teamOneMemberNames];
                        updatedNames[index] = event.target.value;
                        setTeamOneMemberNames(updatedNames);
                      }}
                    />
                  </label>
                ))}
              </div>
            </div>

            <div className="rounded-xl bg-[var(--color-panel-soft)] border border-[var(--color-panel-border)] p-4">
              <h4 className="font-bold mb-3">Team 2</h4>

              <div className="grid grid-cols-1 gap-4">
                <label className="block">
                  <span className="block text-slate-300 mb-2">Team Name</span>
                  <input
                    className="w-full rounded-xl bg-[var(--color-panel)] border border-[var(--color-panel-border)] p-3"
                    value={teamTwoName}
                    onChange={(event) => setTeamTwoName(event.target.value)}
                  />
                </label>

                {teamTwoMemberNames.map((memberName, index) => (
                  <label key={index} className="block">
                    <span className="block text-slate-300 mb-2">
                      Player {index + 1}
                    </span>
                    <input
                      className="w-full rounded-xl bg-[var(--color-panel)] border border-[var(--color-panel-border)] p-3"
                      value={memberName}
                      onChange={(event) => {
                        const updatedNames = [...teamTwoMemberNames];
                        updatedNames[index] = event.target.value;
                        setTeamTwoMemberNames(updatedNames);
                      }}
                    />
                  </label>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {isResetConfirmationVisible && (
        <div className="mb-6 rounded-2xl border border-[var(--color-warning)]/50 bg-[var(--color-warning)]/20 p-5">
          <div className="text-xl font-bold text-[var(--color-warning-hover)] mb-2">
            Reset current match?
          </div>

          <p className="text-[var(--color-text-muted)] mb-4">
            This will clear the current scores, turns, legs, and match history.
            This cannot be undone.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <button
              onClick={confirmResetMatch}
              className="rounded-xl bg-[var(--color-danger)] hover:bg-[var(--color-danger-hover)] px-6 py-3 text-lg font-bold"
            >
              Yes, Reset Match
            </button>

            <button
              onClick={cancelResetMatch}
              className="rounded-xl bg-[var(--color-panel-soft)] hover:bg-[var(--color-panel-border)] px-6 py-3 text-lg font-bold"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <button
          onClick={startNewGame}
          className="rounded-xl bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] px-6 py-3 text-lg font-bold"
        >
          Start / Reset Match
        </button>

        <button
          onClick={clearSavedMatch}
          className="rounded-xl bg-[var(--color-panel-soft)] hover:bg-[var(--color-panel-border)] px-6 py-3 text-lg font-bold"
        >
          Clear Saved Match
        </button>
      </div>
    </section>
  );
}
