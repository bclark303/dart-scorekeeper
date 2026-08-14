from pathlib import Path

path = Path("lib/db/repositories/gameNights.ts")
text = path.read_text()
old = '''      venueId: gameNights.venueId,
      venueName: venues.name,
      name: gameNights.name,
      scheduledAt: gameNights.scheduledAt,
      status: gameNights.status,
      createdAt: gameNights.createdAt,
      updatedAt: gameNights.updatedAt,
    })
    .from(gameNights)
    .innerJoin(seasons, eq(gameNights.seasonId, seasons.id))
    .where(eq(gameNights.id, gameNightId))
'''
new = '''      venueId: gameNights.venueId,
      venueName: venues.name,
      name: gameNights.name,
      scheduledAt: gameNights.scheduledAt,
      status: gameNights.status,
      createdAt: gameNights.createdAt,
      updatedAt: gameNights.updatedAt,
    })
    .from(gameNights)
    .innerJoin(seasons, eq(gameNights.seasonId, seasons.id))
    .leftJoin(venues, eq(gameNights.venueId, venues.id))
    .where(eq(gameNights.id, gameNightId))
'''
if old not in text:
    raise SystemExit("Game Night venue read query pattern was not found")
path.write_text(text.replace(old, new, 1))
print("alpha.12 venue read query fixed")
