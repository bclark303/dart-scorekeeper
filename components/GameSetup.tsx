import { FinishRule, StartingScore } from "@/lib/scoring";
import { BestOfLegs, MatchType, TeamSize } from "@/lib/types";


type GameSetupProps = {
  playerOneName: string;
  playerTwoName: string;
  teamOneName: string;
  teamTwoName: string;
  teamOnePlayerTwoName: string;
  teamTwoPlayerTwoName: string;
  startingScore: StartingScore;
  finishRule: FinishRule;
  bestOfLegs: BestOfLegs;
  matchType: MatchType;
  setPlayerOneName: (name: string) => void;
  setPlayerTwoName: (name: string) => void;
  setTeamOneName: (name: string) => void;
  setTeamTwoName: (name: string) => void;
  setTeamOnePlayerTwoName: (name: string) => void;
  setTeamTwoPlayerTwoName: (name: string) => void;
  setStartingScore: (score: StartingScore) => void;
  setFinishRule: (finishRule: FinishRule) => void;
  setBestOfLegs: (bestOfLegs: BestOfLegs) => void;
  setMatchType: (matchType: MatchType) => void;
  startNewGame: () => void;
  clearSavedMatch: () => void;
  isResetConfirmationVisible: boolean;
  confirmResetMatch: () => void;
  cancelResetMatch: () => void;
  teamSize: TeamSize;
  teamOneMemberNames: string[];
  teamTwoMemberNames: string[];
  resizeTeamMembers: (size: TeamSize) => void;
  setTeamOneMemberNames: (names: string[]) => void;
  setTeamTwoMemberNames: (names: string[]) => void;
};

export function GameSetup({
  playerOneName,
  playerTwoName,
  teamOneName,
  teamTwoName,
  teamOnePlayerTwoName,
  teamTwoPlayerTwoName,
  startingScore,
  finishRule,
  bestOfLegs,
  matchType,
  setPlayerOneName,
  setPlayerTwoName,
  setTeamOneName,
  setTeamTwoName,
  setTeamOnePlayerTwoName,
  setTeamTwoPlayerTwoName,
  setStartingScore,
  setFinishRule,
  setBestOfLegs,
  setMatchType,
  startNewGame,
  clearSavedMatch,
  isResetConfirmationVisible,
  confirmResetMatch,
  cancelResetMatch,
}: GameSetupProps) {
return (
  <section className="rounded-2xl bg-slate-900 border border-slate-700 p-6 mb-8">
    <h2 className="text-2xl font-bold mb-6">Game Setup</h2>

    <div className="mb-8">
      <h3 className="text-lg font-bold mb-3 text-slate-200">Match</h3>

      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <label className="block">
          <span className="block text-slate-300 mb-2">Type</span>
          <select
            className="w-full rounded-xl bg-slate-800 border border-slate-600 p-3"
            value={matchType}
            onChange={(event) => setMatchType(event.target.value as MatchType)}
          >
            <option value="singles">Singles</option>
            <option value="doubles">Doubles</option>
          </select>
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
            onChange={(event) => setFinishRule(event.target.value as FinishRule)}
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
    </div>

    <div className="mb-8">
      <h3 className="text-lg font-bold mb-3 text-slate-200">
        {matchType === "doubles" ? "Teams" : "Players"}
      </h3>

      {matchType === "doubles" ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="rounded-xl bg-slate-800 border border-slate-700 p-4">
            <h4 className="font-bold mb-3">Team 1</h4>

            <div className="grid grid-cols-1 gap-4">
              <label className="block">
                <span className="block text-slate-300 mb-2">Team Name</span>
                <input
                  className="w-full rounded-xl bg-slate-900 border border-slate-600 p-3"
                  value={teamOneName}
                  onChange={(event) => setTeamOneName(event.target.value)}
                />
              </label>

              <label className="block">
                <span className="block text-slate-300 mb-2">Player A</span>
                <input
                  className="w-full rounded-xl bg-slate-900 border border-slate-600 p-3"
                  value={playerOneName}
                  onChange={(event) => setPlayerOneName(event.target.value)}
                />
              </label>

              <label className="block">
                <span className="block text-slate-300 mb-2">Player B</span>
                <input
                  className="w-full rounded-xl bg-slate-900 border border-slate-600 p-3"
                  value={teamOnePlayerTwoName}
                  onChange={(event) =>
                    setTeamOnePlayerTwoName(event.target.value)
                  }
                />
              </label>
            </div>
          </div>

          <div className="rounded-xl bg-slate-800 border border-slate-700 p-4">
            <h4 className="font-bold mb-3">Team 2</h4>

            <div className="grid grid-cols-1 gap-4">
              <label className="block">
                <span className="block text-slate-300 mb-2">Team Name</span>
                <input
                  className="w-full rounded-xl bg-slate-900 border border-slate-600 p-3"
                  value={teamTwoName}
                  onChange={(event) => setTeamTwoName(event.target.value)}
                />
              </label>

              <label className="block">
                <span className="block text-slate-300 mb-2">Player A</span>
                <input
                  className="w-full rounded-xl bg-slate-900 border border-slate-600 p-3"
                  value={playerTwoName}
                  onChange={(event) => setPlayerTwoName(event.target.value)}
                />
              </label>

              <label className="block">
                <span className="block text-slate-300 mb-2">Player B</span>
                <input
                  className="w-full rounded-xl bg-slate-900 border border-slate-600 p-3"
                  value={teamTwoPlayerTwoName}
                  onChange={(event) =>
                    setTeamTwoPlayerTwoName(event.target.value)
                  }
                />
              </label>
            </div>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
        </div>
      )}
    </div>

    {isResetConfirmationVisible && (
        <div className="mb-6 rounded-2xl border border-amber-500/50 bg-amber-950/30 p-5">
            <div className="text-xl font-bold text-amber-200 mb-2">
            Reset current match?
            </div>

            <p className="text-amber-100/90 mb-4">
            This will clear the current scores, turns, legs, and match history. This
            cannot be undone.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <button
                onClick={confirmResetMatch}
                className="rounded-xl bg-red-600 hover:bg-red-500 px-6 py-3 text-lg font-bold"
            >
                Yes, Reset Match
            </button>

            <button
                onClick={cancelResetMatch}
                className="rounded-xl bg-slate-700 hover:bg-slate-600 px-6 py-3 text-lg font-bold"
            >
                Cancel
            </button>
            </div>
        </div>
        )}

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
);
}