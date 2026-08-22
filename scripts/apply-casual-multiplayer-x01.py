from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def read(path: str) -> str:
    return (ROOT / path).read_text(encoding="utf-8")


def write(path: str, content: str) -> None:
    (ROOT / path).write_text(content, encoding="utf-8")


def replace_once(path: str, old: str, new: str) -> None:
    text = read(path)
    count = text.count(old)
    if count != 1:
        raise RuntimeError(f"Expected one match in {path}, found {count}: {old[:80]!r}")
    write(path, text.replace(old, new, 1))


def replace_section(path: str, start: str, end: str, replacement: str) -> None:
    text = read(path)
    start_index = text.find(start)
    if start_index < 0:
        raise RuntimeError(f"Start marker not found in {path}: {start!r}")
    end_index = text.find(end, start_index)
    if end_index < 0:
        raise RuntimeError(f"End marker not found in {path}: {end!r}")
    write(path, text[:start_index] + replacement + text[end_index:])


# Generic X01 starting-score model.
replace_once(
    "lib/scoring.ts",
    'export type StartingScore = 301 | 501 | 701;\n',
    'export type StartingScore = number;\n\nexport const X01_STARTING_SCORES = [\n    101,\n    201,\n    301,\n    401,\n    501,\n    601,\n    701,\n    801,\n    901,\n] as const;\n\nexport function isSupportedX01StartingScore(score: number): boolean {\n    return (\n        Number.isInteger(score) &&\n        score >= 101 &&\n        score <= 901 &&\n        score % 100 === 1\n    );\n}\n',
)

# Saved-state model: casual individual play is independent from team sizing.
replace_once(
    "lib/types.ts",
    'export type MatchType = "singles" | "doubles";\n',
    'export type MatchType = "singles" | "doubles";\n\n/** How competitors are organized for a casual match. */\nexport type CompetitionFormat = "individual" | "team";\n',
)
replace_once(
    "lib/types.ts",
    '  // Current team/side setup.\n  sideOneSize: TeamSize;\n',
    '  // Current casual competition setup.\n  competitionFormat?: CompetitionFormat;\n  individualPlayerNames?: string[];\n\n  // Current team/side setup.\n  sideOneSize: TeamSize;\n',
)

# Rebuild the setup component around an Individuals / Teams choice. Team sizes
# retain the existing five-player cap; individual casual play has no UI cap.
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
  TeamSize,
  ScoreEntryMode,
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
''',
)

# Main scorer state and saved-match compatibility.
replace_once(
    "app/page.tsx",
    '  BestOfLegs,\n  CompletedLeg,\n',
    '  BestOfLegs,\n  CompetitionFormat,\n  CompletedLeg,\n',
)
replace_once(
    "app/page.tsx",
    '  const [startingScore, setStartingScore] = useState<StartingScore>(501);\n  const [finishRule, setFinishRule] = useState<FinishRule>("double_out");\n',
    '  const [startingScore, setStartingScore] = useState<StartingScore>(501);\n  const [competitionFormat, setCompetitionFormat] =\n    useState<CompetitionFormat>("individual");\n  const [individualPlayerNames, setIndividualPlayerNames] = useState<string[]>([\n    "",\n    "",\n  ]);\n  const [finishRule, setFinishRule] = useState<FinishRule>("double_out");\n',
)
replace_once(
    "app/page.tsx",
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
replace_once(
    "app/page.tsx",
    '''      setSides(
        normalizeSavedSides(parsedMatch.sides ?? parsedMatch.players ?? []),
      );
''',
    '      setSides(loadedSides);\n',
)
replace_once(
    "app/page.tsx",
    '      startingScore,\n      finishRule,\n',
    '      startingScore,\n      competitionFormat,\n      individualPlayerNames,\n      finishRule,\n',
)
replace_once(
    "app/page.tsx",
    '    startingScore,\n    finishRule,\n',
    '    startingScore,\n    competitionFormat,\n    individualPlayerNames,\n    finishRule,\n',
)
replace_once(
    "app/page.tsx",
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

    const firstSide = newSides[0];
    const firstThrower = getCurrentThrowerName(firstSide);
    setMessage(
      competitionFormat === "individual"
        ? `${firstThrower} to throw`
        : `${firstThrower} (${firstSide.name}) to throw`,
    );
  }

'''
replace_section(
    "app/page.tsx",
    "  function startNewGame() {\n",
    "  function handleStartNewGame() {\n",
    new_start_game,
)
replace_once(
    "app/page.tsx",
    '    setStartingScore(501);\n    setFinishRule("double_out");\n',
    '    setStartingScore(501);\n    setCompetitionFormat("individual");\n    setIndividualPlayerNames(["", ""]);\n    setFinishRule("double_out");\n',
)
replace_once(
    "app/page.tsx",
    '''  function getNextSideIndex() {
    return currentSideIndex === 0 ? 1 : 0;
  }
''',
    '''  function getNextSideIndex() {
    if (sides.length === 0) {
      return 0;
    }

    return (currentSideIndex + 1) % sides.length;
  }
''',
)
replace_once(
    "app/page.tsx",
    '    const nextstartingSideIndex = startingSideIndex === 0 ? 1 : 0;\n',
    '    const nextstartingSideIndex =\n      sides.length === 0 ? 0 : (startingSideIndex + 1) % sides.length;\n',
)
replace_once(
    "app/page.tsx",
    '''    const startingSide = resetSides[nextstartingSideIndex];
    const startingThrower = getCurrentThrowerName(startingSide);

    setMessage(`${startingThrower} (${startingSide.name}) to throw`);
''',
    '''    const startingSide = resetSides[nextstartingSideIndex];
    const startingThrower = getCurrentThrowerName(startingSide);

    setMessage(
      competitionFormat === "individual"
        ? `${startingThrower} to throw`
        : `${startingThrower} (${startingSide.name}) to throw`,
    );
''',
)
replace_once(
    "app/page.tsx",
    '''  function getOpponentLegs(sideList: MatchSide[], winnerPlayerId: string) {
    const opponent = sideList.find((side) => side.id !== winnerPlayerId);
    return opponent?.legsWon ?? 0;
  }
''',
    '''  function getOpponentLegs(sideList: MatchSide[], winnerPlayerId: string) {
    return sideList.reduce((highestLegCount, side) => {
      if (side.id === winnerPlayerId) {
        return highestLegCount;
      }

      return Math.max(highestLegCount, side.legsWon);
    }, 0);
  }
''',
)
replace_once(
    "app/page.tsx",
    '          startingScore,\n          finishRule,\n',
    '          startingScore,\n          competitionFormat,\n          individualPlayerCount: individualPlayerNames.length,\n          finishRule,\n',
)
replace_once(
    "app/page.tsx",
    '                    X01 scorer for singles, doubles, and team play\n',
    '                    X01 scorer for individual and team play\n',
)
replace_once(
    "app/page.tsx",
    '''            startingScore={startingScore}
            finishRule={finishRule}
''',
    '''            startingScore={startingScore}
            competitionFormat={competitionFormat}
            individualPlayerNames={individualPlayerNames}
            finishRule={finishRule}
''',
)
replace_once(
    "app/page.tsx",
    '''            setStartingScore={setStartingScore}
            setFinishRule={setFinishRule}
''',
    '''            setStartingScore={setStartingScore}
            setCompetitionFormat={setCompetitionFormat}
            setIndividualPlayerNames={setIndividualPlayerNames}
            setFinishRule={setFinishRule}
''',
)

# Sync validation allows multi-side individual matches while retaining a high
# request-shape safety ceiling that is not exposed as a gameplay limit.
replace_once("lib/sync/validation.ts", "const MAX_SIDES = 2;\n", "const MAX_SIDES = 128;\n")
replace_once(
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
replace_once(
    "lib/sync/validation.ts",
    '      sideIndex: requireInteger(rawSide.sideIndex, "side.sideIndex", 0, 1),\n',
    '      sideIndex: requireInteger(\n        rawSide.sideIndex,\n        "side.sideIndex",\n        0,\n        MAX_SIDES - 1,\n      ),\n',
)
replace_once(
    "lib/sync/validation.ts",
    '''      startingScore: requireEnum(settings.startingScore, "settings.startingScore", [
        301,
        501,
        701,
      ] as const),
''',
    '      startingScore: requireX01StartingScore(\n        settings.startingScore,\n        "settings.startingScore",\n      ),\n',
)

# Release metadata.
replace_once(
    "lib/appInfo.ts",
    'export const APP_VERSION = "0.4.0-alpha.1";\n',
    'export const APP_VERSION = "0.4.0-alpha.2";\n',
)
replace_once(
    "package.json",
    '  "version": "0.4.0-alpha.1",\n',
    '  "version": "0.4.0-alpha.2",\n',
)
replace_once(
    "CHANGELOG.md",
    '### Added\n',
    '### Added\n- Casual X01 now supports any number of individual players, with turn order rotating across every participant.\n- X01 starting scores can now be selected from 101 through 901 in 100-point increments.\n',
)
replace_once(
    "CHANGELOG.md",
    '- Updated development version to v0.4.0-alpha.1.\n',
    '- Updated development version to v0.4.0-alpha.2.\n',
)

# Sanity-check the important outcomes before CI runs.
assert 'useState<CompetitionFormat>("individual")' in read("app/page.tsx")
assert 'return (currentSideIndex + 1) % sides.length;' in read("app/page.tsx")
assert 'X01_STARTING_SCORES.map' in read("components/GameSetup.tsx")
assert 'const MAX_SIDES = 128;' in read("lib/sync/validation.ts")
print("Casual multiplayer/X01 patch applied successfully.")
