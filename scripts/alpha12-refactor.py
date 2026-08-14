from pathlib import Path


def replace(path: str, old: str, new: str):
    p = Path(path)
    text = p.read_text()
    if old not in text:
        raise SystemExit(f"pattern not found in {path}: {old[:100]!r}")
    p.write_text(text.replace(old, new, 1))


# Drizzle must see the persistent venue tables before hardware/game-night FKs.
replace(
    "drizzle.config.ts",
    '    "./lib/db/game-night-schema.ts",\n',
    '    "./lib/db/venue-schema.ts",\n    "./lib/db/game-night-schema.ts",\n',
)

# Every newly-created league gets a default venue link. Venues can later be
# shared by linking another league; this is convenience, not ownership.
replace(
    "lib/db/repositories/leagues.ts",
    'import { leagueMemberships, leagues, seasons } from "../schema";\n',
    'import { leagueMemberships, leagues, seasons } from "../schema";\nimport { leagueVenues, venues } from "../venue-schema";\n',
)
replace(
    "lib/db/repositories/leagues.ts",
    '  const firstSeasonName = input.firstSeason?.name.trim();\n\n  return getDatabase().transaction(async (tx) => {',
    '  const firstSeasonName = input.firstSeason?.name.trim();\n  const venueId = crypto.randomUUID();\n\n  return getDatabase().transaction(async (tx) => {',
)
needle = '''    await tx.insert(leagueMemberships).values({
      id: input.membershipId,
      leagueId: input.id,
      userId: input.userId,
      role: "owner",
      status: "active",
      createdAt: now,
      updatedAt: now,
    });

'''
replace(
    "lib/db/repositories/leagues.ts",
    needle,
    needle + '''    await tx.insert(venues).values({
      id: venueId,
      name: `${name} Venue`,
      status: "active",
      createdByUserId: input.userId,
      createdAt: now,
      updatedAt: now,
    });
    await tx.insert(leagueVenues).values({
      id: crypto.randomUUID(),
      leagueId: input.id,
      venueId,
      createdAt: now,
    });

''',
)

# Game-night repository: venue context + persistent board allocation.
replace(
    "lib/db/repositories/gameNights.ts",
    'import { leagueMemberships, players, seasons } from "../schema";\n',
    'import { leagueMemberships, players, seasons } from "../schema";\nimport { physicalBoards, venues } from "../venue-schema";\n',
)
replace(
    "lib/db/repositories/gameNights.ts",
    'import { LeaguePermissionError } from "./leagues";\n',
    '''import { LeaguePermissionError } from "./leagues";
import {
  activePhysicalBoardIdsUsedByOtherGameNights,
  bootstrapEmptyVenueBoards,
  ensureDefaultVenueForLeagueForUser,
  listPhysicalBoardsForVenue,
  requireVenueLinkedToLeague,
} from "./venueHardware";
''',
)
replace(
    "lib/db/repositories/gameNights.ts",
    '''      seasonId: gameNights.seasonId,
    })''',
    '''      seasonId: gameNights.seasonId,
      venueId: gameNights.venueId,
      status: gameNights.status,
    })''',
)
old_reset = '''async function resetBoards(gameNightId: string, boardCount: number, now: number) {
  await getDatabase().delete(gameNightBoardPairings).where(eq(gameNightBoardPairings.gameNightId, gameNightId));
  await getDatabase().delete(gameNightBoards).where(eq(gameNightBoards.gameNightId, gameNightId));
  if (boardCount > 0) {
    await getDatabase().insert(gameNightBoards).values(
      Array.from({ length: boardCount }, (_, index) => ({
        id: crypto.randomUUID(),
        gameNightId,
        boardNumber: index + 1,
        name: `Board ${index + 1}`,
        createdAt: now,
      })),
    );
  }
}
'''
new_reset = '''async function replaceBoardAllocations(
  gameNightId: string,
  physicalBoardIds: string[],
  now: number,
) {
  const [night] = await getDatabase()
    .select({ venueId: gameNights.venueId })
    .from(gameNights)
    .where(eq(gameNights.id, gameNightId))
    .limit(1);
  if (!night?.venueId) throw new Error("Choose a venue before assigning boards.");

  const venueBoards = await listPhysicalBoardsForVenue(night.venueId);
  const byId = new Map(venueBoards.map((board) => [board.id, board]));
  const chosen = physicalBoardIds.map((id) => byId.get(id));
  if (chosen.some((board) => !board)) {
    throw new Error("A selected board does not belong to this Game Night venue.");
  }
  if (new Set(physicalBoardIds).size !== physicalBoardIds.length) {
    throw new Error("Each physical board can be selected only once.");
  }
  if (chosen.some((board) => board?.status !== "active")) {
    throw new Error("Out-of-service boards cannot be assigned to a Game Night.");
  }

  await getDatabase().delete(gameNightBoardPairings).where(eq(gameNightBoardPairings.gameNightId, gameNightId));
  await getDatabase().delete(gameNightBoards).where(eq(gameNightBoards.gameNightId, gameNightId));
  if (chosen.length) {
    await getDatabase().insert(gameNightBoards).values(
      chosen.map((board) => ({
        id: crypto.randomUUID(),
        gameNightId,
        physicalBoardId: board!.id,
        boardNumber: board!.boardNumber,
        name: board!.name,
        createdAt: now,
      })),
    );
  }
}

async function resetBoards(gameNightId: string, boardCount: number, now: number) {
  const [night] = await getDatabase()
    .select({ venueId: gameNights.venueId })
    .from(gameNights)
    .where(eq(gameNights.id, gameNightId))
    .limit(1);
  if (!night?.venueId) throw new Error("Choose a venue before assigning boards.");

  let venueBoards = await listPhysicalBoardsForVenue(night.venueId);
  if (!venueBoards.length) {
    venueBoards = await bootstrapEmptyVenueBoards(night.venueId, boardCount, now);
  }
  const activeBoards = venueBoards.filter((board) => board.status === "active");
  if (activeBoards.length < boardCount) {
    throw new Error(
      `This venue has ${activeBoards.length} active ${activeBoards.length === 1 ? "board" : "boards"}, but this Game Night needs ${boardCount}. Add or restore physical boards in Venue Hardware.`,
    );
  }

  const occupied = await activePhysicalBoardIdsUsedByOtherGameNights(gameNightId);
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
  await replaceBoardAllocations(gameNightId, chosenIds, now);
}
'''
replace("lib/db/repositories/gameNights.ts", old_reset, new_reset)

# Read model includes venue and permanent board IDs.
replace(
    "lib/db/repositories/gameNights.ts",
    '''      seasonName: seasons.name,
      name: gameNights.name,''',
    '''      seasonName: seasons.name,
      venueId: gameNights.venueId,
      venueName: venues.name,
      name: gameNights.name,''',
)
replace(
    "lib/db/repositories/gameNights.ts",
    '''    .from(gameNights)
    .innerJoin(seasons, eq(gameNights.seasonId, seasons.id))
    .where(eq(gameNights.id, gameNightId))''',
    '''    .from(gameNights)
    .innerJoin(seasons, eq(gameNights.seasonId, seasons.id))
    .leftJoin(venues, eq(gameNights.venueId, venues.id))
    .where(eq(gameNights.id, gameNightId))''',
)
replace(
    "lib/db/repositories/gameNights.ts",
    '''    boards: boardRows.map((board) => ({
      id: board.id,
      boardNumber: board.boardNumber,
      name: board.name,
    })),''',
    '''    boards: boardRows.map((board) => ({
      id: board.id,
      physicalBoardId: board.physicalBoardId,
      boardNumber: board.boardNumber,
      name: board.name,
    })),''',
)

# New nights select the league's default venue before board slots are created.
replace(
    "lib/db/repositories/gameNights.ts",
    '''  const now = input.now ?? Date.now();
  await getDatabase().transaction(async (tx) => {''',
    '''  const now = input.now ?? Date.now();
  const venue = await ensureDefaultVenueForLeagueForUser({
    leagueId: input.leagueId,
    userId: input.userId,
    now,
  });
  await getDatabase().transaction(async (tx) => {''',
)
replace(
    "lib/db/repositories/gameNights.ts",
    '''      id: input.id,
      seasonId: input.seasonId,
      name: input.name.trim(),''',
    '''      id: input.id,
      seasonId: input.seasonId,
      venueId: venue.id,
      name: input.name.trim(),''',
)

# Add explicit venue and board-selection mutations before the lifecycle setter.
marker = '''export async function setGameNightStatusForUser(
'''
addition = '''export async function setGameNightVenueForUser(
  gameNightId: string,
  venueId: string,
  userId: string,
): Promise<GameNightSummary> {
  const context = await getGameNightContext(gameNightId);
  await requireLeagueAdmin(context.leagueId, userId);
  if (["active", "completed", "cancelled"].includes(context.status)) {
    throw new Error("The Game Night venue is locked once play starts or closes.");
  }
  await requireVenueLinkedToLeague(context.leagueId, venueId);
  const [settingsRow] = await getDatabase()
    .select()
    .from(gameNightSettings)
    .where(eq(gameNightSettings.gameNightId, gameNightId))
    .limit(1);
  if (!settingsRow) throw new Error("Game-night settings were not found.");
  await getDatabase()
    .update(gameNights)
    .set({ venueId, status: "checkin", updatedAt: Date.now() })
    .where(eq(gameNights.id, gameNightId));
  await resetBoards(gameNightId, settingsRow.boardCount, Date.now());
  return getGameNightForUser(gameNightId, userId);
}

export async function assignGameNightPhysicalBoardsForUser(
  gameNightId: string,
  physicalBoardIds: string[],
  userId: string,
): Promise<GameNightSummary> {
  const context = await getGameNightContext(gameNightId);
  await requireLeagueAdmin(context.leagueId, userId);
  if (["active", "completed", "cancelled"].includes(context.status)) {
    throw new Error("Physical board assignments are locked once play starts or closes.");
  }
  const [settingsRow] = await getDatabase()
    .select()
    .from(gameNightSettings)
    .where(eq(gameNightSettings.gameNightId, gameNightId))
    .limit(1);
  if (!settingsRow) throw new Error("Game-night settings were not found.");
  if (physicalBoardIds.length !== settingsRow.boardCount) {
    throw new Error(`Select exactly ${settingsRow.boardCount} physical ${settingsRow.boardCount === 1 ? "board" : "boards"}.`);
  }
  await replaceBoardAllocations(gameNightId, physicalBoardIds, Date.now());
  await getDatabase()
    .update(gameNights)
    .set({ status: "checkin", updatedAt: Date.now() })
    .where(eq(gameNights.id, gameNightId));
  return getGameNightForUser(gameNightId, userId);
}

'''
replace("lib/db/repositories/gameNights.ts", marker, addition + marker)

# Starting play reserves the physical boards against other active nights.
replace(
    "lib/db/repositories/gameNightLifecycle.ts",
    'import { setGameNightStatusForUser as setRawGameNightStatusForUser } from "./gameNights";\n',
    'import { setGameNightStatusForUser as setRawGameNightStatusForUser } from "./gameNights";\nimport { assertGameNightPhysicalBoardsAvailable } from "./venueHardware";\n',
)
replace(
    "lib/db/repositories/gameNightLifecycle.ts",
    '''    await setRawGameNightStatusForUser(gameNightId, userId, "active");''',
    '''    await assertGameNightPhysicalBoardsAvailable(gameNightId);
    await setRawGameNightStatusForUser(gameNightId, userId, "active");''',
)

# Public repository exports.
replace(
    "lib/db/repositories/index.ts",
    '''  updateGameNightSettingsForUser,
} from "./gameNightSetupLifecycle";''',
    '''  updateGameNightSettingsForUser,
} from "./gameNightSetupLifecycle";
export {
  assignGameNightPhysicalBoardsForUser,
  setGameNightVenueForUser,
} from "./gameNights";''',
)
replace(
    "lib/db/repositories/index.ts",
    '''  updateBoardDeviceForUser,
} from "./boardDevices";''',
    '''  getVenueHardwareForUser,
  updateBoardDeviceForUser,
} from "./boardDevices";
export {
  createPhysicalBoardForUser,
  listPhysicalBoardsForVenueForUser,
  listVenuesForLeagueForUser,
  updatePhysicalBoardForUser,
} from "./venueHardware";''',
)
replace(
    "lib/db/index.ts",
    '''  addExistingPlayerToLeagueForUser,
''',
    '''  addExistingPlayerToLeagueForUser,
  assignGameNightPhysicalBoardsForUser,
''',
)
replace(
    "lib/db/index.ts",
    '''  getGameNightTemplateForUser,
''',
    '''  getGameNightTemplateForUser,
  getVenueHardwareForUser,
''',
)
replace(
    "lib/db/index.ts",
    '''  listLeaguesForUser,
''',
    '''  listLeaguesForUser,
  listPhysicalBoardsForVenueForUser,
  listVenuesForLeagueForUser,
''',
)
replace(
    "lib/db/index.ts",
    '''  createSeasonForUser,
''',
    '''  createSeasonForUser,
  createPhysicalBoardForUser,
''',
)
replace(
    "lib/db/index.ts",
    '''  setGameNightStatusForUser,
''',
    '''  setGameNightStatusForUser,
  setGameNightVenueForUser,
''',
)
replace(
    "lib/db/index.ts",
    '''  updateBoardDeviceForUser,
''',
    '''  updateBoardDeviceForUser,
  updatePhysicalBoardForUser,
''',
)

# Game-night route accepts venue/physical-board structural changes.
replace(
    "app/api/leagues/game-nights/route.ts",
    '''  assignGameNightPlayerToTeamForUser,
''',
    '''  assignGameNightPhysicalBoardsForUser,
  assignGameNightPlayerToTeamForUser,
''',
)
replace(
    "app/api/leagues/game-nights/route.ts",
    '''  setGameNightStatusForUser,
''',
    '''  setGameNightStatusForUser,
  setGameNightVenueForUser,
''',
)
replace(
    "app/api/leagues/game-nights/route.ts",
    '''  | { action: "populateBoards"; gameNightId: string }
''',
    '''  | { action: "populateBoards"; gameNightId: string }
  | { action: "venue"; gameNightId: string; venueId: string }
  | { action: "assignPhysicalBoards"; gameNightId: string; physicalBoardIds: string[] }
''',
)
case_marker = '''    if (input.action === "populateBoards") {
'''
case_add = '''    if (input.action === "venue") {
      if (!input.venueId) return noStoreJson({ error: "venueId is required." }, { status: 400 });
      return noStoreJson(
        await gameNightPayload(
          setGameNightVenueForUser(input.gameNightId, input.venueId, authState.user.id),
        ),
      );
    }
    if (input.action === "assignPhysicalBoards") {
      if (!Array.isArray(input.physicalBoardIds) || input.physicalBoardIds.some((id) => typeof id !== "string")) {
        return noStoreJson({ error: "physicalBoardIds must be an array of board IDs." }, { status: 400 });
      }
      return noStoreJson(
        await gameNightPayload(
          assignGameNightPhysicalBoardsForUser(
            input.gameNightId,
            input.physicalBoardIds,
            authState.user.id,
          ),
        ),
      );
    }
'''
replace("app/api/leagues/game-nights/route.ts", case_marker, case_add + case_marker)

print("alpha.12 structural refactor applied")
