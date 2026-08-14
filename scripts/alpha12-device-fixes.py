from pathlib import Path

path = Path("lib/db/repositories/boardDevices.ts")
text = path.read_text()
old_import = '''import {
  getDefaultVenueForLeagueForUser,
  listPhysicalBoardsForVenueForUser,
'''
new_import = '''import {
  bootstrapEmptyVenueBoards,
  getDefaultVenueForLeagueForUser,
  listPhysicalBoardsForVenueForUser,
'''
if old_import not in text:
    raise SystemExit("board device venue import pattern was not found")
text = text.replace(old_import, new_import, 1)

old_lookup = '''  if (input.boardNumber !== undefined) {
    const [board] = await getDatabase()
      .select()
      .from(physicalBoards)
      .where(eq(physicalBoards.venueId, input.venueId))
      .orderBy(asc(physicalBoards.boardNumber));
    const match = board?.boardNumber === input.boardNumber
      ? board
      : (await getDatabase()
          .select()
          .from(physicalBoards)
          .where(eq(physicalBoards.venueId, input.venueId))
          .orderBy(asc(physicalBoards.boardNumber)))
          .find((candidate) => candidate.boardNumber === input.boardNumber);
    if (!match) throw new Error(`Board ${input.boardNumber} is not configured at this venue.`);
    return match;
  }
'''
new_lookup = '''  if (input.boardNumber !== undefined) {
    let boards = await getDatabase()
      .select()
      .from(physicalBoards)
      .where(eq(physicalBoards.venueId, input.venueId))
      .orderBy(asc(physicalBoards.boardNumber));
    let match = boards.find((candidate) => candidate.boardNumber === input.boardNumber);
    if (!match && input.boardNumber > 0) {
      // Compatibility for pre-alpha.12 clients: an auto-managed venue can grow
      // when a scorer is registered by board number. Explicitly managed venues
      // never invent a physical board and will still fail below.
      boards = await bootstrapEmptyVenueBoards(input.venueId, input.boardNumber);
      match = boards.find((candidate) => candidate.boardNumber === input.boardNumber);
    }
    if (!match) throw new Error(`Board ${input.boardNumber} is not configured at this venue.`);
    return match;
  }
'''
if old_lookup not in text:
    raise SystemExit("legacy board-number lookup pattern was not found")
path.write_text(text.replace(old_lookup, new_lookup, 1))
print("alpha.12 legacy device registration convenience fixed")
