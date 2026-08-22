from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def read(path: str) -> str:
    return (ROOT / path).read_text(encoding="utf-8")


def write(path: str, content: str) -> None:
    (ROOT / path).write_text(content, encoding="utf-8")


def replace_first(path: str, old: str, new: str) -> None:
    text = read(path)
    if old not in text:
        raise RuntimeError(f"Pattern not found in {path}: {old[:100]!r}")
    write(path, text.replace(old, new, 1))


def replace_all(path: str, old: str, new: str) -> None:
    text = read(path)
    if old not in text:
        raise RuntimeError(f"Pattern not found in {path}: {old[:100]!r}")
    write(path, text.replace(old, new))


def replace_section(path: str, start: str, end: str, replacement: str) -> None:
    text = read(path)
    start_index = text.find(start)
    if start_index < 0:
        raise RuntimeError(f"Start marker not found in {path}: {start!r}")
    end_index = text.find(end, start_index)
    if end_index < 0:
        raise RuntimeError(f"End marker not found in {path}: {end!r}")
    write(path, text[:start_index] + replacement + text[end_index:])


# Shared X01 rule configuration. The scorer engine remains generic; the current
# product UI deliberately offers X01 values from 101 through 901.
replace_first(
    "lib/scoring.ts",
    'export type StartingScore = 301 | 501 | 701;\n',
    '''export type StartingScore = number;

export const X01_STARTING_SCORES = [
    101,
    201,
    301,
    401,
    501,
    601,
    701,
    801,
    901,
] as const;

export function isSupportedX01StartingScore(score: number): boolean {
    return (
        Number.isInteger(score) &&
        score >= 101 &&
        score <= 901 &&
        score % 100 === 1
    );
}
''',
)

# Casual-only participant organization. TeamSize remains intentionally capped
# for the existing team setup; individual casual participants use an array.
replace_first(
    "lib/types.ts",
    'export type MatchType = "singles" | "doubles";\n',
    'export type MatchType = "singles" | "doubles";\n\n/** How competitors are organized for a casual match. */\nexport type CompetitionFormat = "individual" | "team";\n',
)
replace_first(
    "lib/types.ts",
    '  // Current team/side setup.\n  sideOneSize: TeamSize;\n',
    '  // Current casual competition setup.\n  competitionFormat?: CompetitionFormat;\n  individualPlayerNames?: string[];\n\n  // Current team/side setup.\n  sideOneSize: TeamSize;\n',
)

# Preserve the preview's redesigned casual setup while separating individual
# and team modes. The individual list has no gameplay maximum.
write(
    "components/GameSetup.tsx",
    '''import {
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
          Starting the match opens the focused scoring board.
        </p>
      </div>

      <div className="grid gap-5 lg:grid-cols-[1fr_320px]">
        <div className="space-y-5">
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
''',
)

# Casual scorer state, persistence, setup, and turn rotation.
replace_first(
    "app/casual/page.tsx",
    '  BestOfLegs,\n  CompletedLeg,\n',
    '  BestOfLegs,\n  CompetitionFormat,\n  CompletedLeg,\n',
)
replace_first(
    "app/casual/page.tsx",
    '  const [startingScore, setStartingScore] = useState<StartingScore>(501);\n  const [finishRule, setFinishRule] = useState<FinishRule>("double_out");\n',
    '''  const [startingScore, setStartingScore] = useState<StartingScore>(501);
  const [competitionFormat, setCompetitionFormat] =
    useState<CompetitionFormat>("individual");
  const [individualPlayerNames, setIndividualPlayerNames] = useState<string[]>([
    "",
    "",
  ]);
  const [finishRule, setFinishRule] = useState<FinishRule>("double_out");
''',
)
replace_first(
    "app/casual/page.tsx",
    '''      const loadedSideTwoSize =
        parsedMatch.sideTwoSize ??
        parsedMatch.teamSize ??
        (parsedMatch.matchType === "doubles" ? 2 : 1);

      setThemeName(parsedMatch.themeName ?? "default");
''',
    '''      const loadedSideTwoSize =
        parsedMatch.sideTwoSize ??
        parsedMatch.teamSize ??
        (parsedMatch.matchType === "doubles" ? 2 : 1);

      const loadedSides = normalizeSavedSides(
        parsedMatch.sides ?? parsedMatch.players ?? [],
      );
      const loadedCompetitionFormat =
        parsedMatch.competitionFormat ??
        (loadedSides.length > 2 ||
        (loadedSideOneSize === 1 && loadedSideTwoSize === 1)
          ? "individual"
          : "team");

      setCompetitionFormat(loadedCompetitionFormat);
      setIndividualPlayerNames(
        parsedMatch.individualPlayerNames ??
          (loadedCompetitionFormat === "individual" && loadedSides.length >= 2
            ? loadedSides.map((side) => side.name)
            : [
                parsedMatch.playerOneName ?? "Player 1",
                parsedMatch.playerTwoName ?? "Player 2",
              ]),
      );

      setThemeName(parsedMatch.themeName ?? "default");
''',
)
replace_first(
    "app/casual/page.tsx",
    '''      setSides(
        normalizeSavedSides(parsedMatch.sides ?? parsedMatch.players ?? []),
      );
''',
    '      setSides(loadedSides);\n',
)
replace_first(
    "app/casual/page.tsx",
    '      startingScore,\n      finishRule,\n',
    '      startingScore,\n      competitionFormat,\n      individualPlayerNames,\n      finishRule,\n',
)
# Only the first dependency block is the localStorage save effect. The archive
# effect intentionally remains dependent on archive fields only.
replace_first(
    "app/casual/page.tsx",
    '    startingScore,\n    finishRule,\n',
    '    startingScore,\n    competitionFormat,\n    individualPlayerNames,\n    finishRule,\n',
)
replace_first(
    "app/casual/page.tsx",
    '''  function getDefaultSinglesPlayerName(sideNumber: 1 | 2) {
    return sideNumber === 1 ? "Player 1" : "Player 2";
  }

''',
    '',
)

new_start_game = '''  function startNewGame() {
    const newMatchIdentity = createMatchIdentity();
    setMatchId(newMatchIdentity.id);
    setMatchCreatedAt(newMatchIdentity.createdAt);

    let newSides: MatchSide[];

    if (competitionFormat === "individual") {
      const playerCount = Math.max(2, individualPlayerNames.length);
      const resolvedPlayerNames = Array.from(
        { length: playerCount },
        (_, index) =>
          individualPlayerNames[index]?.trim() || `Player ${index + 1}`,
      );

      newSides = resolvedPlayerNames.map((playerName, index) =>
        createTeamSide(
          `side-${index + 1}`,
          playerName,
          [playerName],
          startingScore,
        ),
      );
    } else {
      const resolvedTeamOneMemberNames = resolveMemberNames(
        teamOneMemberNames,
        1,
        sideOneSize,
      );
      const resolvedTeamTwoMemberNames = resolveMemberNames(
        teamTwoMemberNames,
        2,
        sideTwoSize,
      );

      const sideOneName = teamOneName.trim() || getDefaultTeamName(1);
      const sideTwoName = teamTwoName.trim() || getDefaultTeamName(2);

      newSides = [
        createTeamSide(
          "side-1",
          sideOneName,
          resolvedTeamOneMemberNames,
          startingScore,
        ),
        createTeamSide(
          "side-2",
          sideTwoName,
          resolvedTeamTwoMemberNames,
          startingScore,
        ),
      ];

      if (rotationMode === "dummy" && sideOneSize !== sideTwoSize) {
        const targetSize = Math.max(sideOneSize, sideTwoSize);
        newSides = newSides.map((side) =>
          addDummyMembersIfNeeded(side, targetSize),
        );
      }
    }

    const initialMemberIndexes = Object.fromEntries(
      newSides.map((side) => [side.id, 0]),
    );

    setSides(newSides);
    setCurrentSideIndex(0);
    setStartingSideIndex(0);
    setCurrentLegNumber(1);
    setStartingMemberIndexBySide(initialMemberIndexes);
    setScoreInput("");
    setTurnHistory([]);
    setCompletedLegs([]);
    setIsLegComplete(false);
    setIsMatchComplete(false);
    setPendingCheckoutTurn(null);
    setPendingDartsUsedTurn(null);
    setIsGameModeActive(true);
    setIsGameMenuOpen(false);
    setMessage(getTurnDisplayName(newSides[0]));
  }

'''
replace_section(
    "app/casual/page.tsx",
    "  function startNewGame() {\n",
    "  function handleStartNewGame() {\n",
    new_start_game,
)
replace_first(
    "app/casual/page.tsx",
    '    setStartingScore(501);\n    setFinishRule("double_out");\n',
    '    setStartingScore(501);\n    setCompetitionFormat("individual");\n    setIndividualPlayerNames(["", ""]);\n    setFinishRule("double_out");\n',
)
replace_first(
    "app/casual/page.tsx",
    '''  function getCurrentThrowerName(side: MatchSide): string {
    return side.members[side.currentMemberIndex]?.name ?? side.name;
  }

''',
    '''  function getCurrentThrowerName(side: MatchSide): string {
    return side.members[side.currentMemberIndex]?.name ?? side.name;
  }

  function getTurnDisplayName(side: MatchSide): string {
    const throwerName = getCurrentThrowerName(side);
    return competitionFormat === "individual"
      ? `${throwerName} to throw`
      : `${throwerName} (${side.name}) to throw`;
  }

''',
)
replace_first(
    "app/casual/page.tsx",
    '''    const nextPlayerName = sides[nextPlayerIndex].name;
    const nextThrowerName = getCurrentThrowerName(sides[nextPlayerIndex]);

    setMessage(
      `${resultWithThrower.message} ${nextThrowerName} (${nextPlayerName}) to throw.`,
    );
''',
    '''    const nextTurn = getTurnDisplayName(sides[nextPlayerIndex]);
    setMessage(`${resultWithThrower.message} ${nextTurn}.`);
''',
)
replace_first(
    "app/casual/page.tsx",
    '''    const nextSide = sides[nextSideIndex];
    const nextThrowerName = getCurrentThrowerName(nextSide);

    const dartSummary = getDartSummary(darts);
''',
    '''    const nextSide = sides[nextSideIndex];
    const nextTurn = getTurnDisplayName(nextSide);

    const dartSummary = getDartSummary(darts);
''',
)
replace_first(
    "app/casual/page.tsx",
    '''    setMessage(
      `${turnMessage} ${nextThrowerName} (${nextSide.name}) to throw.`,
    );
''',
    '    setMessage(`${turnMessage} ${nextTurn}.`);\n',
)
replace_first(
    "app/casual/page.tsx",
    '''    const nextPlayerIndex = getNextSideIndex();
    const nextThrowerName = getCurrentThrowerName(sides[nextPlayerIndex]);

    setCurrentSideIndex(nextPlayerIndex);
    setMessage(
      `${pendingCheckoutTurn.throwerName ?? pendingCheckoutTurn.playerName} busts! ${nextThrowerName} (${sides[nextPlayerIndex].name}) to throw.`,
    );
''',
    '''    const nextPlayerIndex = getNextSideIndex();
    const nextTurn = getTurnDisplayName(sides[nextPlayerIndex]);

    setCurrentSideIndex(nextPlayerIndex);
    setMessage(
      `${pendingCheckoutTurn.throwerName ?? pendingCheckoutTurn.playerName} busts! ${nextTurn}.`,
    );
''',
)
replace_first(
    "app/casual/page.tsx",
    '    const nextstartingSideIndex = startingSideIndex === 0 ? 1 : 0;\n',
    '    const nextstartingSideIndex =\n      sides.length === 0 ? 0 : (startingSideIndex + 1) % sides.length;\n',
)
replace_first(
    "app/casual/page.tsx",
    '''    const startingSide = resetSides[nextstartingSideIndex];
    const startingThrower = getCurrentThrowerName(startingSide);

    setMessage(`${startingThrower} (${startingSide.name}) to throw`);
''',
    '''    const startingSide = resetSides[nextstartingSideIndex];
    setMessage(getTurnDisplayName(startingSide));
''',
)
replace_first(
    "app/casual/page.tsx",
    '''  function getOpponentLegs(sideList: MatchSide[], winnerPlayerId: string) {
    const opponent = sideList.find((side) => side.id !== winnerPlayerId);
    return opponent?.legsWon ?? 0;
  }
''',
    '''  function getOpponentLegs(sideList: MatchSide[], winnerPlayerId: string) {
    return sideList.reduce((highestLegCount, side) => {
      if (side.id === winnerPlayerId) return highestLegCount;
      return Math.max(highestLegCount, side.legsWon);
    }, 0);
  }
''',
)
replace_first(
    "app/casual/page.tsx",
    '''  function getNextSideIndex() {
    return currentSideIndex === 0 ? 1 : 0;
  }
''',
    '''  function getNextSideIndex() {
    if (sides.length === 0) return 0;
    return (currentSideIndex + 1) % sides.length;
  }
''',
)
replace_first(
    "app/casual/page.tsx",
    '          startingScore,\n          finishRule,\n',
    '          startingScore,\n          competitionFormat,\n          individualPlayerCount: individualPlayerNames.length,\n          finishRule,\n',
)
replace_first(
    "app/casual/page.tsx",
    '''            startingScore={startingScore}
            finishRule={finishRule}
''',
    '''            startingScore={startingScore}
            competitionFormat={competitionFormat}
            individualPlayerNames={individualPlayerNames}
            finishRule={finishRule}
''',
)
replace_first(
    "app/casual/page.tsx",
    '''            setStartingScore={setStartingScore}
            setFinishRule={setFinishRule}
''',
    '''            setStartingScore={setStartingScore}
            setCompetitionFormat={setCompetitionFormat}
            setIndividualPlayerNames={setIndividualPlayerNames}
            setFinishRule={setFinishRule}
''',
)

# Completed casual matches may now contain more than two one-player sides.
replace_first("lib/sync/validation.ts", "const MAX_SIDES = 2;\n", "const MAX_SIDES = 128;\n")
replace_first(
    "lib/sync/validation.ts",
    '''function requireBoolean(value: unknown, field: string) {
''',
    '''function requireX01StartingScore(value: unknown, field: string) {
  const score = requireInteger(value, field, 101, 901);
  if (score % 100 !== 1) {
    throw new Error(`${field} must be an X01 score between 101 and 901.`);
  }
  return score;
}

function requireBoolean(value: unknown, field: string) {
''',
)
replace_first(
    "lib/sync/validation.ts",
    '      sideIndex: requireInteger(rawSide.sideIndex, "side.sideIndex", 0, 1),\n',
    '''      sideIndex: requireInteger(
        rawSide.sideIndex,
        "side.sideIndex",
        0,
        MAX_SIDES - 1,
      ),
''',
)
replace_first(
    "lib/sync/validation.ts",
    '''      startingScore: requireEnum(settings.startingScore, "settings.startingScore", [
        301,
        501,
        701,
      ] as const),
''',
    '''      startingScore: requireX01StartingScore(
        settings.startingScore,
        "settings.startingScore",
      ),
''',
)

# League play remains team-based. Only the X01 start rule becomes configurable.
replace_first(
    "lib/league/gameNightSettingsValidation.ts",
    'import { isSupportedBestOfLegs } from "@/lib/league/matchFormat";\n',
    'import { isSupportedBestOfLegs } from "@/lib/league/matchFormat";\nimport { isSupportedX01StartingScore } from "@/lib/scoring";\n',
)
replace_first(
    "lib/league/gameNightSettingsValidation.ts",
    '    [301, 501, 701].includes(settings.startingScore) &&\n',
    '    isSupportedX01StartingScore(settings.startingScore) &&\n',
)
replace_first(
    "components/GameNightRulesPanel.tsx",
    'import { X01_BEST_OF_OPTIONS } from "@/lib/league/matchFormat";\n',
    'import { X01_BEST_OF_OPTIONS } from "@/lib/league/matchFormat";\nimport { X01_STARTING_SCORES } from "@/lib/scoring";\n',
)
replace_first(
    "components/GameNightRulesPanel.tsx",
    '''                <option value={301}>301</option>
                <option value={501}>501</option>
                <option value={701}>701</option>
''',
    '''                {X01_STARTING_SCORES.map((score) => (
                  <option key={score} value={score}>{score}</option>
                ))}
''',
)

# Release metadata.
replace_first(
    "lib/appInfo.ts",
    'export const APP_VERSION = "0.5.0-alpha.17";\n',
    'export const APP_VERSION = "0.5.0-alpha.18";\n',
)
replace_all(
    "package.json",
    '"version": "0.5.0-alpha.17"',
    '"version": "0.5.0-alpha.18"',
)
replace_all(
    "package-lock.json",
    '"version": "0.5.0-alpha.17"',
    '"version": "0.5.0-alpha.18"',
)
replace_first(
    "CHANGELOG.md",
    '### Added\n',
    '''### Added
- Casual X01 now supports any number of individual players, with independent scores and circular turn order.
- X01 starting scores can now be selected from 101 through 901 in 100-point increments in both casual and league rule setup.
''',
)

# Basic source-level assertions before the repository contract suite runs.
assert 'useState<CompetitionFormat>("individual")' in read("app/casual/page.tsx")
assert 'return (currentSideIndex + 1) % sides.length;' in read("app/casual/page.tsx")
assert 'X01_STARTING_SCORES.map' in read("components/GameSetup.tsx")
assert 'isSupportedX01StartingScore(settings.startingScore)' in read("lib/league/gameNightSettingsValidation.ts")
assert 'const MAX_SIDES = 128;' in read("lib/sync/validation.ts")
print("Preview casual multiplayer/X01 patch applied successfully.")
