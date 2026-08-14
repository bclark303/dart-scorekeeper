from pathlib import Path

path = Path("lib/db/repositories/gameNights.ts")
text = path.read_text()
old = '''  const occupied = await activePhysicalBoardIdsUsedByOtherGameNights(gameNightId);
  const existing = await getDatabase()
    .select({ physicalBoardId: gameNightBoards.physicalBoardId })
    .from(gameNightBoards)
    .where(eq(gameNightBoards.gameNightId, gameNightId));
  const existingIds = existing
    .map((row) => row.physicalBoardId)
    .filter((id): id is string => Boolean(id));
  const available = activeBoards.filter((board) => !occupied.has(board.id));
  const chosenIds: string[] = [];
  for (const id of existingIds) {
    if (available.some((board) => board.id === id) && !chosenIds.includes(id)) chosenIds.push(id);
    if (chosenIds.length === boardCount) break;
  }
  for (const board of available) {
    if (!chosenIds.includes(board.id)) chosenIds.push(board.id);
    if (chosenIds.length === boardCount) break;
  }
  if (chosenIds.length < boardCount) {
    throw new Error("Not enough physical boards are currently available at this venue.");
  }
'''
new = '''  // Pre-play board selection may overlap another active or scheduled night.
  // The authoritative exclusivity check runs when this Game Night starts, so
  // administrators can prepare future nights without inventing extra hardware.
  const existing = await getDatabase()
    .select({ physicalBoardId: gameNightBoards.physicalBoardId })
    .from(gameNightBoards)
    .where(eq(gameNightBoards.gameNightId, gameNightId));
  const existingIds = existing
    .map((row) => row.physicalBoardId)
    .filter((id): id is string => Boolean(id));
  const chosenIds: string[] = [];
  for (const id of existingIds) {
    if (activeBoards.some((board) => board.id === id) && !chosenIds.includes(id)) chosenIds.push(id);
    if (chosenIds.length === boardCount) break;
  }
  for (const board of activeBoards) {
    if (!chosenIds.includes(board.id)) chosenIds.push(board.id);
    if (chosenIds.length === boardCount) break;
  }
'''
if old not in text:
    raise SystemExit("pre-play board allocation pattern was not found")
path.write_text(text.replace(old, new, 1))
print("alpha.12 pre-play board overlap behavior fixed")
