import { FinishRule, StartingScore } from "@/lib/scoring";
import { BestOfLegs, MatchType } from "@/lib/types";

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
}: GameSetupProps) {
  return (
    <section className="rounded-2xl bg-slate-900 border border-slate-700 p-6 mb-8">
      <h2 className="text-2xl font-bold mb-4">Game Setup</h2>

      <div className="grid grid-cols-1 sm:grid-cols-6 gap-4 mb-4">
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
          <span className="block text-slate-300 mb-2">
            {matchType === "doubles" ? "Team 1 Player A" : "Player 1"}
          </span>
          <input
            className="w-full rounded-xl bg-slate-800 border border-slate-600 p-3"
            value={playerOneName}
            onChange={(event) => setPlayerOneName(event.target.value)}
          />
        </label>

        <label className="block">
          <span className="block text-slate-300 mb-2">
            {matchType === "doubles" ? "Team 2 Player A" : "Player 2"}
          </span>
          <input
            className="w-full rounded-xl bg-slate-800 border border-slate-600 p-3"
            value={playerTwoName}
            onChange={(event) => setPlayerTwoName(event.target.value)}
          />
        </label>
        
          {matchType === "doubles" && (
            <>
                <label className="block">
                  <span className="block text-slate-300 mb-2">Team 1 Name</span>
                  <input
                    className="w-full rounded-xl bg-slate-800 border border-slate-600 p-3"
                    value={teamOneName}
                    onChange={(event) => setTeamOneName(event.target.value)}
                  />
                </label>

                <label className="block">
                  <span className="block text-slate-300 mb-2">Team 2 Name</span>
                  <input
                    className="w-full rounded-xl bg-slate-800 border border-slate-600 p-3"
                    value={teamTwoName}
                    onChange={(event) => setTeamTwoName(event.target.value)}
                  />
                </label>

                <label className="block">
                <span className="block text-slate-300 mb-2">Team 1 Player B</span>
                <input
                    className="w-full rounded-xl bg-slate-800 border border-slate-600 p-3"
                    value={teamOnePlayerTwoName}
                    onChange={(event) => setTeamOnePlayerTwoName(event.target.value)}
                />
                </label>

                <label className="block">
                <span className="block text-slate-300 mb-2">Team 2 Player B</span>
                <input
                    className="w-full rounded-xl bg-slate-800 border border-slate-600 p-3"
                    value={teamTwoPlayerTwoName}
                    onChange={(event) => setTeamTwoPlayerTwoName(event.target.value)}
                />
                </label>
            </>
            )}

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