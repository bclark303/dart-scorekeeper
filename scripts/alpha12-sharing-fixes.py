from pathlib import Path


def replace(path: str, old: str, new: str):
    p = Path(path)
    text = p.read_text()
    if old not in text:
        raise SystemExit(f"pattern not found in {path}: {old[:120]!r}")
    p.write_text(text.replace(old, new, 1))


# Venue repository: let an administrator discover venues they already manage
# through another league, and explicitly share one with the selected league.
path = Path("lib/db/repositories/venueHardware.ts")
text = path.read_text()
marker = '''export async function getDefaultVenueForLeagueForUser(leagueId: string, userId: string) {
'''
addition = '''export async function listAdminVenuesForUser(userId: string): Promise<VenueSummary[]> {
  const rows = await getDatabase()
    .select({ venue: venues })
    .from(leagueVenues)
    .innerJoin(venues, eq(leagueVenues.venueId, venues.id))
    .innerJoin(
      leagueMemberships,
      and(
        eq(leagueMemberships.leagueId, leagueVenues.leagueId),
        eq(leagueMemberships.userId, userId),
        eq(leagueMemberships.status, "active"),
        inArray(leagueMemberships.role, ["owner", "admin"]),
      ),
    )
    .orderBy(asc(venues.name));
  const deduped = new Map(rows.map(({ venue }) => [venue.id, summarizeVenue(venue)]));
  return [...deduped.values()];
}

export async function linkVenueToLeagueForUser(input: {
  leagueId: string;
  venueId: string;
  userId: string;
  now?: number;
}) {
  await requireLeagueAdminForVenueAccess(input.leagueId, input.userId);
  await requireVenueAdminForUser(input.venueId, input.userId);
  const [venue] = await getDatabase()
    .select()
    .from(venues)
    .where(eq(venues.id, input.venueId))
    .limit(1);
  if (!venue) throw new Error("Venue was not found.");
  await getDatabase()
    .insert(leagueVenues)
    .values({
      id: crypto.randomUUID(),
      leagueId: input.leagueId,
      venueId: input.venueId,
      createdAt: input.now ?? Date.now(),
    })
    .onConflictDoNothing({ target: [leagueVenues.leagueId, leagueVenues.venueId] });
  return summarizeVenue(venue);
}

'''
if marker not in text:
    raise SystemExit("venue sharing insertion marker not found")
path.write_text(text.replace(marker, addition + marker, 1))

# Hardware read returns both linked venues and other administrable venues.
path = Path("lib/db/repositories/boardDevices.ts")
text = path.read_text()
text = text.replace(
    '''  listPhysicalBoardsForVenueForUser,
  listVenuesForLeagueForUser,
''',
    '''  listAdminVenuesForUser,
  listPhysicalBoardsForVenueForUser,
  listVenuesForLeagueForUser,
''',
    1,
)
old = '''  const linkedVenues = await listVenuesForLeagueForUser(input.leagueId, input.userId);
  const venue = input.venueId
'''
new = '''  const [linkedVenues, adminVenues] = await Promise.all([
    listVenuesForLeagueForUser(input.leagueId, input.userId),
    listAdminVenuesForUser(input.userId),
  ]);
  const linkedIds = new Set(linkedVenues.map((item) => item.id));
  const availableVenues = adminVenues.filter((item) => !linkedIds.has(item.id));
  const venue = input.venueId
'''
if old not in text:
    raise SystemExit("hardware linked venue pattern not found")
text = text.replace(old, new, 1)
old = '''    venues: linkedVenues,
    venue,
'''
new = '''    venues: linkedVenues,
    availableVenues,
    venue,
'''
if old not in text:
    raise SystemExit("hardware response venue pattern not found")
path.write_text(text.replace(old, new, 1))

# Public exports.
path = Path("lib/db/repositories/index.ts")
text = path.read_text()
old = '''  createPhysicalBoardForUser,
  listPhysicalBoardsForVenueForUser,
  listVenuesForLeagueForUser,
  updatePhysicalBoardForUser,
} from "./venueHardware";'''
new = '''  createPhysicalBoardForUser,
  linkVenueToLeagueForUser,
  listAdminVenuesForUser,
  listPhysicalBoardsForVenueForUser,
  listVenuesForLeagueForUser,
  updatePhysicalBoardForUser,
} from "./venueHardware";'''
if old not in text:
    raise SystemExit("repository venue export pattern not found")
path.write_text(text.replace(old, new, 1))

path = Path("lib/db/index.ts")
text = path.read_text()
text = text.replace(
    '''  listLeaguesForUser,
  listPhysicalBoardsForVenueForUser,
''',
    '''  linkVenueToLeagueForUser,
  listAdminVenuesForUser,
  listLeaguesForUser,
  listPhysicalBoardsForVenueForUser,
''',
    1,
)
path.write_text(text)

# Hardware API can link an existing venue to the selected league.
path = Path("app/api/leagues/board-devices/route.ts")
text = path.read_text()
text = text.replace(
    '''  LeaguePermissionError,
  registerBoardDeviceForUser,
''',
    '''  LeaguePermissionError,
  linkVenueToLeagueForUser,
  registerBoardDeviceForUser,
''',
    1,
)
old_union = '''    | {
        action: "board";
        leagueId?: string;
        venueId?: string;
        boardNumber?: number;
        name?: string;
      };
'''
new_union = '''    | {
        action: "board";
        leagueId?: string;
        venueId?: string;
        boardNumber?: number;
        name?: string;
      }
    | {
        action: "linkVenue";
        leagueId?: string;
        venueId?: string;
      };
'''
if old_union not in text:
    raise SystemExit("hardware POST union pattern not found")
text = text.replace(old_union, new_union, 1)
old_required = '''  if (!input.leagueId || !input.venueId) {
    return noStoreJson({ error: "League and venue are required." }, { status: 400 });
  }

  try {
    if (input.action === "board") {
'''
new_required = '''  if (!input.leagueId || !input.venueId) {
    return noStoreJson({ error: "League and venue are required." }, { status: 400 });
  }

  try {
    if (input.action === "linkVenue") {
      const venue = await linkVenueToLeagueForUser({
        leagueId: input.leagueId,
        venueId: input.venueId,
        userId: authState.user.id,
      });
      return noStoreJson({ venue }, { status: 201 });
    }
    if (input.action === "board") {
'''
if old_required not in text:
    raise SystemExit("hardware POST action marker not found")
path.write_text(text.replace(old_required, new_required, 1))

print("alpha.12 shared venue administration applied")
