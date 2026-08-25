import {
  FinishRule,
  StartingScore,
  X01_STARTING_SCORES,
} from "@/lib/scoring";

import {
  BestOfLegs,
  CompetitionFormat,
  RotationMode,
  TeamSize,
  ScoreEntryMode,
} from "@/lib/types";
import type { PausedCasualGame } from "@/lib/persistence/casualSavedGames";
import { PausedCasualGamesPanel } from "@/components/PausedCasualGamesPanel";

type GameSetupProps = {
  competitionFormat: CompetitionFormat;
  individualPlayerNames: string[];
  teamOneName: string;
  teamTwoName: string;
  startingScore: StartingScore;
  finishRule: FinishRule;
  bestOfLegs: BestOfLegs;
  scoreEntryMode: ScoreEntryMode;
  setCompetitionFormat: (format: CompetitionFormat) => void;
  setIndividualPlayerNames: (names: string[]) => void;
  setScoreEntryMode: (mode: ScoreEntryMode) => void;
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
  isClearSavedConfirmationVisible: boolean;
  confirmClearSavedMatch: () => void;
  cancelClearSavedMatch: () => void;
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
  pausedGames: PausedCasualGame[];
  resumePausedGame: (id: string) => void;
  deletePausedGame: (id: string) => void;
};

export function GameSetup({
  competitionFormat,
  individualPlayerNames,
  teamOneName,
  teamTwoName,
  startingScore,
  finishRule,
  bestOfLegs,
  scoreEntryMode,
  setCompetitionFormat,
  setIndividualPlayerNames,
  setScoreEntryMode,
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
  isClearSavedConfirmationVisible,
  confirmClearSavedMatch,
  cancelClearSavedMatch,
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
  pausedGames,
  resumePausedGame,
  deletePausedGame,
}: GameSetupProps) {
  const isIndividual = competitionFormat === "individual";

  function updateIndividualPlayerName(index: number, name: string) {
    const updatedNames = [...individualPlayerNames];
    updatedNames[index] = name;
    setIndividualPlayerNames(updatedNames);
  }

  function addIndividualPlayer() {
    setIndividualPlayerNames([...individualPlayerNames, ""]);
  }

  function removeIndividualPlayer(index: number) {
    if (individualPlayerNames.length <= 2) {
      return;
    }

    setIndividualPlayerNames(
      individualPlayerNames.filter((_, playerIndex) => playerIndex !== index),
    );
  }

  return (
    <section className="rounded-2xl bg-[var(--color-panel)] border border-[var(--color-panel-border)] p-6 mb-8">
      <h2 className="text-2xl font-bold mb-6">Game Setup</h2>

      {pausedGames.length > 0 && (
        <div className="mb-8">
          <PausedCasualGamesPanel
            games={pausedGames}
            onResume={resumePausedGame}
            onDelete={deletePausedGame}
          />
        </div>
      )}

      <div className="mb-8">
        <h3 className="text-lg font-bold mb-3 text-[var(--color-text-main)]">
          Match
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <label className="block">
            <span className="block text-[var(--color-text-muted)] mb-2">
              Play As
            </span>
            <select
              className="w-full rounded-xl bg-[var(--color-panel-soft)] border border-[var(--color-panel-border)] p-3"
              value={competitionFormat}
              onChange={(event) =>
                setCompetitionFormat(event.target.value as CompetitionFormat)
              }
            >
              <option value="individual">Individuals</option>
              <option value="team">Teams</option>
            </select>
          </label>

          {!isIndividual && (
            <>
              <label className="block">
                <span className="block text-[var(--color-text-muted)] mb-2">
                  Team A Size
                </span>
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
                <span className="block text-[var(--color-text-muted)] mb-2">
                  Team B Size
                </span>
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
                <label className="block">
                  <span className="block text-[var(--color-text-muted)] mb-2">
                    Rotation
                  </span>
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
              )}

              {sideOneSize !== sideTwoSize && rotationMode === "dummy" && (
                <label className="block">
                  <span className="block text-[var(--color-text-muted)] mb-2">
                    Dummy Score
                  </span>
                  <input
                    className="w-full rounded-xl bg-[var(--color-panel-soft)] border border-[var(--color-panel-border)] p-3"
                    value={dummyScore}
                    onChange={(event) => {
                      const nextScore = Number(event.target.value);
                      setDummyScore(Number.isNaN(nextScore) ? 0 : nextScore);
                    }}
                    inputMode="numeric"
                  />
                </label>
              )}
            </>
          )}

          <label className="block">
            <span className="block text-[var(--color-text-muted)] mb-2">
              X01 Start
            </span>
            <select
              className="w-full rounded-xl bg-[var(--color-panel-soft)] border border-[var(--color-panel-border)] p-3"
              value={startingScore}
              onChange={(event) => setStartingScore(Number(event.target.value))}
            >
              {X01_STARTING_SCORES.map((score) => (
                <option key={score} value={score}>
                  {score}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="block text-[var(--color-text-muted)] mb-2">
              Finish
            </span>
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
            <span className="block text-[var(--color-text-muted)] mb-2">
              Score Entry
            </span>
            <select
              className="w-full rounded-xl bg-[var(--color-panel-soft)] border border-[var(--color-panel-border)] p-3"
              value={scoreEntryMode}
              onChange={(event) =>
                setScoreEntryMode(event.target.value as ScoreEntryMode)
              }
            >
              <option value="turn">Total Turn Score</option>
              <option value="dart">Dart-by-Dart</option>
            </select>
          </label>

          <label className="block">
            <span className="block text-[var(--color-text-muted)] mb-2">
              Legs
            </span>
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
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-lg font-bold text-[var(--color-text-main)]">
              {isIndividual ? "Players" : "Teams"}
            </h3>
            {isIndividual && (
              <p className="text-sm text-[var(--color-text-muted)]">
                Each player keeps an individual score and takes a turn in order.
              </p>
            )}
          </div>

          {isIndividual && (
            <button
              type="button"
              onClick={addIndividualPlayer}
              className="rounded-xl bg-[var(--color-panel-soft)] hover:bg-[var(--color-panel-border)] px-4 py-2 text-sm font-bold"
            >
              + Add Player
            </button>
          )}
        </div>

        {isIndividual ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {individualPlayerNames.map((playerName, index) => (
              <div
                key={index}
                className="rounded-xl bg-[var(--color-panel-soft)] border border-[var(--color-panel-border)] p-3"
              >
                <label className="block">
                  <span className="block text-[var(--color-text-muted)] mb-2">
                    Player {index + 1}
                  </span>
                  <input
                    className="w-full rounded-xl bg-[var(--color-panel)] border border-[var(--color-panel-border)] p-3"
                    value={playerName}
                    placeholder={`Player ${index + 1}`}
                    onChange={(event) =>
                      updateIndividualPlayerName(index, event.target.value)
                    }
                  />
                </label>

                {individualPlayerNames.length > 2 && (
                  <button
                    type="button"
                    onClick={() => removeIndividualPlayer(index)}
                    className="mt-3 text-sm font-bold text-[var(--color-danger-hover)] hover:underline"
                  >
                    Remove Player
                  </button>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {[
              {
                title: "Team A",
                teamName: teamOneName,
                setTeamName: setTeamOneName,
                memberNames: teamOneMemberNames,
                setMemberNames: setTeamOneMemberNames,
                suffix: "A",
              },
              {
                title: "Team B",
                teamName: teamTwoName,
                setTeamName: setTeamTwoName,
                memberNames: teamTwoMemberNames,
                setMemberNames: setTeamTwoMemberNames,
                suffix: "B",
              },
            ].map((team) => (
              <div
                key={team.title}
                className="rounded-xl bg-[var(--color-panel-soft)] border border-[var(--color-panel-border)] p-4"
              >
                <h4 className="font-bold mb-3">{team.title}</h4>

                <div className="grid grid-cols-1 gap-4">
                  <label className="block">
                    <span className="block text-[var(--color-text-muted)] mb-2">
                      Team Name
                    </span>
                    <input
                      className="w-full rounded-xl bg-[var(--color-panel)] border border-[var(--color-panel-border)] p-3"
                      value={team.teamName}
                      placeholder={team.title}
                      onChange={(event) => team.setTeamName(event.target.value)}
                    />
                  </label>

                  {team.memberNames.map((memberName, index) => (
                    <label key={index} className="block">
                      <span className="block text-[var(--color-text-muted)] mb-2">
                        Player {index + 1}
                      </span>
                      <input
                        className="w-full rounded-xl bg-[var(--color-panel)] border border-[var(--color-panel-border)] p-3"
                        value={memberName}
                        placeholder={`Player ${index + 1}-${team.suffix}`}
                        onChange={(event) => {
                          const updatedNames = [...team.memberNames];
                          updatedNames[index] = event.target.value;
                          team.setMemberNames(updatedNames);
                        }}
                      />
                    </label>
                  ))}
                </div>
              </div>
            ))}
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

      {isClearSavedConfirmationVisible && (
        <div className="mb-6 rounded-2xl border border-[var(--color-danger)]/50 bg-[var(--color-danger)]/20 p-5">
          <div className="text-xl font-bold text-[var(--color-danger-hover)] mb-2">
            Clear saved match and settings?
          </div>
          <p className="text-[var(--color-text-muted)] mb-4">
            This clears the saved match, players, game options, app name, and
            current scores from this browser. This cannot be undone.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <button
              onClick={confirmClearSavedMatch}
              className="rounded-xl bg-[var(--color-danger)] hover:bg-[var(--color-danger-hover)] px-6 py-3 text-lg font-bold"
            >
              Yes, Clear Everything
            </button>
            <button
              onClick={cancelClearSavedMatch}
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
