import {
  FinishRule,
  StartingScore,
  X01_STARTING_SCORES,
} from "@/lib/scoring";
import {
  BestOfLegs,
  CompetitionFormat,
  RotationMode,
  ScoreEntryMode,
  TeamSize,
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

const selectClass =
  "w-full rounded-xl border border-[var(--color-panel-border)] bg-[var(--color-panel-soft)] p-3";
const inputClass =
  "w-full rounded-xl border border-[var(--color-panel-border)] bg-[var(--color-panel-soft)] p-3";

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
  const playerCount = isIndividual
    ? individualPlayerNames.length
    : sideOneSize + sideTwoSize;

  function updateIndividualPlayerName(index: number, name: string) {
    const next = [...individualPlayerNames];
    next[index] = name;
    setIndividualPlayerNames(next);
  }

  function addIndividualPlayer() {
    setIndividualPlayerNames([...individualPlayerNames, ""]);
  }

  function removeIndividualPlayer(index: number) {
    if (individualPlayerNames.length <= 2) return;
    setIndividualPlayerNames(
      individualPlayerNames.filter((_, playerIndex) => playerIndex !== index),
    );
  }

  return (
    <section className="mb-8">
      <div className="mb-6">
        <div className="text-xs font-black uppercase tracking-[0.14em] text-[var(--color-text-muted)]">
          Local · no account required
        </div>
        <h2 className="mt-1 text-3xl font-black">Casual Play Setup</h2>
        <p className="mt-2 max-w-2xl text-sm text-[var(--color-text-muted)]">
          Choose individual or team play, enter the players, and set the X01 rules.
          Starting the match opens the focused scoring interface.
        </p>
      </div>

      <div className="grid gap-5 lg:grid-cols-[1fr_320px]">
        <div className="space-y-5">
          <PausedCasualGamesPanel
            games={pausedGames}
            onResume={resumePausedGame}
            onDelete={deletePausedGame}
          />

          <section className="rounded-2xl border border-[var(--color-panel-border)] bg-[var(--color-panel)] p-5">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <h3 className="text-lg font-black">Players</h3>
                <p className="mt-1 text-xs text-[var(--color-text-muted)]">
                  Individual play gives every player their own score and turn.
                </p>
              </div>
              <label className="min-w-44 text-sm font-bold">
                Play as
                <select
                  value={competitionFormat}
                  onChange={(event) =>
                    setCompetitionFormat(event.target.value as CompetitionFormat)
                  }
                  className={`mt-2 ${selectClass}`}
                >
                  <option value="individual">Individuals</option>
                  <option value="team">Teams</option>
                </select>
              </label>
            </div>

            {isIndividual ? (
              <div className="mt-4">
                <div className="grid gap-3 sm:grid-cols-2">
                  {individualPlayerNames.map((playerName, index) => (
                    <div
                      key={index}
                      className="rounded-xl border border-[var(--color-panel-border)] bg-[var(--color-panel-soft)] p-3"
                    >
                      <label className="text-sm font-bold">
                        Player {index + 1}
                        <input
                          value={playerName}
                          onChange={(event) =>
                            updateIndividualPlayerName(index, event.target.value)
                          }
                          placeholder={`Player ${index + 1}`}
                          className="mt-2 w-full rounded-xl border border-[var(--color-panel-border)] bg-[var(--color-panel)] p-3"
                        />
                      </label>
                      {individualPlayerNames.length > 2 && (
                        <button
                          type="button"
                          onClick={() => removeIndividualPlayer(index)}
                          className="mt-2 text-xs font-bold text-[var(--color-danger-hover)] underline underline-offset-4"
                        >
                          Remove
                        </button>
                      )}
                    </div>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={addIndividualPlayer}
                  className="mt-4 rounded-xl border border-[var(--color-panel-border)] bg-[var(--color-panel-soft)] px-4 py-2.5 text-sm font-black hover:bg-[var(--color-panel-border)]"
                >
                  + Add Player
                </button>
              </div>
            ) : (
              <div className="mt-4 grid gap-4 lg:grid-cols-2">
                <div className="rounded-xl border border-[var(--color-panel-border)] bg-[var(--color-panel-soft)] p-4">
                  <label className="text-sm font-bold">
                    Team A
                    <input
                      value={teamOneName}
                      onChange={(event) => setTeamOneName(event.target.value)}
                      placeholder="Team A"
                      className="mt-2 w-full rounded-xl border border-[var(--color-panel-border)] bg-[var(--color-panel)] p-3"
                    />
                  </label>
                  <div className="mt-3 space-y-3">
                    {teamOneMemberNames.map((member, index) => (
                      <input
                        key={index}
                        value={member}
                        onChange={(event) => {
                          const next = [...teamOneMemberNames];
                          next[index] = event.target.value;
                          setTeamOneMemberNames(next);
                        }}
                        placeholder={`Player ${index + 1}`}
                        className="w-full rounded-xl border border-[var(--color-panel-border)] bg-[var(--color-panel)] p-3"
                      />
                    ))}
                  </div>
                </div>

                <div className="rounded-xl border border-[var(--color-panel-border)] bg-[var(--color-panel-soft)] p-4">
                  <label className="text-sm font-bold">
                    Team B
                    <input
                      value={teamTwoName}
                      onChange={(event) => setTeamTwoName(event.target.value)}
                      placeholder="Team B"
                      className="mt-2 w-full rounded-xl border border-[var(--color-panel-border)] bg-[var(--color-panel)] p-3"
                    />
                  </label>
                  <div className="mt-3 space-y-3">
                    {teamTwoMemberNames.map((member, index) => (
                      <input
                        key={index}
                        value={member}
                        onChange={(event) => {
                          const next = [...teamTwoMemberNames];
                          next[index] = event.target.value;
                          setTeamTwoMemberNames(next);
                        }}
                        placeholder={`Player ${index + 1}`}
                        className="w-full rounded-xl border border-[var(--color-panel-border)] bg-[var(--color-panel)] p-3"
                      />
                    ))}
                  </div>
                </div>
              </div>
            )}
          </section>

          <section className="rounded-2xl border border-[var(--color-panel-border)] bg-[var(--color-panel)] p-5">
            <h3 className="text-lg font-black">Game Rules</h3>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <label className="text-sm font-bold">
                Starting score
                <select
                  value={startingScore}
                  onChange={(event) => setStartingScore(Number(event.target.value))}
                  className={`mt-2 ${selectClass}`}
                >
                  {X01_STARTING_SCORES.map((score) => (
                    <option key={score} value={score}>
                      {score}
                    </option>
                  ))}
                </select>
              </label>

              <label className="text-sm font-bold">
                Finish
                <select
                  value={finishRule}
                  onChange={(event) =>
                    setFinishRule(event.target.value as FinishRule)
                  }
                  className={`mt-2 ${selectClass}`}
                >
                  <option value="double_out">Double Out</option>
                  <option value="straight_out">Straight Out</option>
                </select>
              </label>

              <label className="text-sm font-bold">
                Match length
                <select
                  value={bestOfLegs}
                  onChange={(event) =>
                    setBestOfLegs(Number(event.target.value) as BestOfLegs)
                  }
                  className={`mt-2 ${selectClass}`}
                >
                  <option value={1}>Best of 1</option>
                  <option value={3}>Best of 3</option>
                  <option value={5}>Best of 5</option>
                  <option value={7}>Best of 7</option>
                  <option value={9}>Best of 9</option>
                </select>
              </label>

              <label className="text-sm font-bold">
                Scoring style
                <select
                  value={scoreEntryMode}
                  onChange={(event) =>
                    setScoreEntryMode(event.target.value as ScoreEntryMode)
                  }
                  className={`mt-2 ${selectClass}`}
                >
                  <option value="dart">Graphical Board</option>
                  <option value="turn">Turn Total</option>
                </select>
              </label>
            </div>
          </section>

          {!isIndividual && (
            <details className="rounded-2xl border border-[var(--color-panel-border)] bg-[var(--color-panel)] p-5">
              <summary className="cursor-pointer font-black">More team options</summary>
              <div className="mt-5 grid gap-4 sm:grid-cols-2">
                <label className="text-sm font-bold">
                  Team A size
                  <select
                    value={sideOneSize}
                    onChange={(event) =>
                      resizeSideOneMembers(Number(event.target.value) as TeamSize)
                    }
                    className={`mt-2 ${selectClass}`}
                  >
                    {[1, 2, 3, 4, 5].map((size) => (
                      <option key={size} value={size}>
                        {size} {size === 1 ? "player" : "players"}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="text-sm font-bold">
                  Team B size
                  <select
                    value={sideTwoSize}
                    onChange={(event) =>
                      resizeSideTwoMembers(Number(event.target.value) as TeamSize)
                    }
                    className={`mt-2 ${selectClass}`}
                  >
                    {[1, 2, 3, 4, 5].map((size) => (
                      <option key={size} value={size}>
                        {size} {size === 1 ? "player" : "players"}
                      </option>
                    ))}
                  </select>
                </label>

                {sideOneSize !== sideTwoSize && (
                  <label className="text-sm font-bold">
                    Uneven-team rotation
                    <select
                      value={rotationMode}
                      onChange={(event) =>
                        setRotationMode(event.target.value as RotationMode)
                      }
                      className={`mt-2 ${selectClass}`}
                    >
                      <option value="independent">Independent</option>
                      <option value="dummy">Use Dummy Score</option>
                    </select>
                  </label>
                )}

                {sideOneSize !== sideTwoSize && rotationMode === "dummy" && (
                  <label className="text-sm font-bold">
                    Dummy score
                    <input
                      value={dummyScore}
                      inputMode="numeric"
                      onChange={(event) =>
                        setDummyScore(Number(event.target.value) || 0)
                      }
                      className={`mt-2 ${inputClass}`}
                    />
                  </label>
                )}
              </div>
            </details>
          )}

          <details className="rounded-2xl border border-[var(--color-panel-border)] bg-[var(--color-panel)] p-5">
            <summary className="cursor-pointer font-black">Local data</summary>
            <button
              type="button"
              onClick={clearSavedMatch}
              className="mt-4 text-sm font-bold text-[var(--color-text-muted)] underline underline-offset-4"
            >
              Clear saved local match and preferences
            </button>
          </details>

          {isResetConfirmationVisible && (
            <section className="rounded-2xl border border-amber-500/40 bg-amber-500/10 p-5">
              <h3 className="text-lg font-black">Replace the current match?</h3>
              <p className="mt-2 text-sm text-[var(--color-text-muted)]">
                Current turns and leg progress will be reset.
              </p>
              <div className="mt-4 flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={confirmResetMatch}
                  className="rounded-xl bg-[var(--color-danger)] px-4 py-2.5 font-black text-white"
                >
                  Start new match
                </button>
                <button
                  type="button"
                  onClick={cancelResetMatch}
                  className="rounded-xl border border-[var(--color-panel-border)] px-4 py-2.5 font-black"
                >
                  Cancel
                </button>
              </div>
            </section>
          )}

          {isClearSavedConfirmationVisible && (
            <section className="rounded-2xl border border-red-500/40 bg-red-500/10 p-5">
              <h3 className="text-lg font-black">Clear saved local data?</h3>
              <p className="mt-2 text-sm text-[var(--color-text-muted)]">
                This clears the saved match and local scorer preferences from
                this browser.
              </p>
              <div className="mt-4 flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={confirmClearSavedMatch}
                  className="rounded-xl bg-[var(--color-danger)] px-4 py-2.5 font-black text-white"
                >
                  Clear local data
                </button>
                <button
                  type="button"
                  onClick={cancelClearSavedMatch}
                  className="rounded-xl border border-[var(--color-panel-border)] px-4 py-2.5 font-black"
                >
                  Cancel
                </button>
              </div>
            </section>
          )}
        </div>

        <aside className="h-fit rounded-2xl border border-[var(--color-panel-border)] bg-[var(--color-panel)] p-5 lg:sticky lg:top-5">
          <div className="text-xs font-black uppercase tracking-wide text-[var(--color-text-muted)]">
            Match summary
          </div>
          <div className="mt-4 space-y-3 text-sm">
            <div className="flex items-center justify-between gap-3 border-b border-[var(--color-panel-border)] pb-3">
              <span className="text-[var(--color-text-muted)]">Play</span>
              <strong>{isIndividual ? "Individuals" : "Teams"}</strong>
            </div>
            <div className="flex items-center justify-between gap-3 border-b border-[var(--color-panel-border)] pb-3">
              <span className="text-[var(--color-text-muted)]">Players</span>
              <strong>{playerCount}</strong>
            </div>
            <div className="flex items-center justify-between gap-3 border-b border-[var(--color-panel-border)] pb-3">
              <span className="text-[var(--color-text-muted)]">Game</span>
              <strong>{startingScore}</strong>
            </div>
            <div className="flex items-center justify-between gap-3 border-b border-[var(--color-panel-border)] pb-3">
              <span className="text-[var(--color-text-muted)]">Finish</span>
              <strong>{finishRule === "double_out" ? "Double Out" : "Straight Out"}</strong>
            </div>
            <div className="flex items-center justify-between gap-3 border-b border-[var(--color-panel-border)] pb-3">
              <span className="text-[var(--color-text-muted)]">Length</span>
              <strong>Best of {bestOfLegs}</strong>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="text-[var(--color-text-muted)]">Scoring</span>
              <strong>{scoreEntryMode === "dart" ? "Graphical Board" : "Turn Total"}</strong>
            </div>
          </div>

          <button
            type="button"
            onClick={startNewGame}
            className="mt-6 w-full rounded-xl bg-emerald-600 px-5 py-4 text-lg font-black text-white hover:bg-emerald-500"
          >
            🎯 Start Match
          </button>
        </aside>
      </div>
    </section>
  );
}
