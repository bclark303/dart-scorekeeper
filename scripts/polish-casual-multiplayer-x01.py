from pathlib import Path

root = Path(__file__).resolve().parents[1]


def patch(path: str, old: str, new: str):
    p = root / path
    s = p.read_text(encoding="utf-8")
    if old not in s:
        raise RuntimeError(f"Pattern missing in {path}: {old[:80]!r}")
    p.write_text(s.replace(old, new, 1), encoding="utf-8")


patch(
    "app/page.tsx",
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
patch(
    "app/page.tsx",
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
patch(
    "app/page.tsx",
    '''    const nextSide = sides[nextSideIndex];
    const nextThrowerName = getCurrentThrowerName(nextSide);

    const dartSummary = getDartSummary(darts);
''',
    '''    const nextSide = sides[nextSideIndex];
    const nextTurn = getTurnDisplayName(nextSide);

    const dartSummary = getDartSummary(darts);
''',
)
patch(
    "app/page.tsx",
    '''    setMessage(
      `${turnMessage} ${nextThrowerName} (${nextSide.name}) to throw.`,
    );
''',
    '    setMessage(`${turnMessage} ${nextTurn}.`);\n',
)
patch(
    "app/page.tsx",
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
patch(
    "package-lock.json",
    '"version": "0.4.0-alpha.1"',
    '"version": "0.4.0-alpha.2"',
)
patch(
    "package-lock.json",
    '"version": "0.4.0-alpha.1"',
    '"version": "0.4.0-alpha.2"',
)

print("Production multiplayer display polish applied.")
