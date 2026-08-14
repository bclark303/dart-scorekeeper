from pathlib import Path

path = Path("scripts/dummy-scoring-integration-contract-test.ts")
text = path.read_text()
old = '''  assert.equal(
    match.turns[0].scoreEntered,
    0,
    "A dummy starting a new leg must not inherit a partner turn from the previous leg.",
  );

  // Fixed mode: any positive dummyScore is the fixed per-turn value.
'''
new = '''  assert.equal(
    match.turns[0].scoreEntered,
    0,
    "A dummy starting a new leg must not inherit a partner turn from the previous leg.",
  );

  // This contract runs two independent live-night scenarios against one league.
  // With persistent physical boards, close the first scenario before the next
  // one starts so the test does not model an impossible simultaneous claim on
  // the same real board.
  await setGameNightStatusForUser(half.gameNightId, ownerUserId, "cancelled");

  // Fixed mode: any positive dummyScore is the fixed per-turn value.
'''
if old not in text:
    raise SystemExit("dummy scoring isolation pattern was not found")
path.write_text(text.replace(old, new, 1))
print("alpha.12 legacy physical-board test isolation fixed")
