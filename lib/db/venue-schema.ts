import { index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

import { leagues } from "./schema";

/**
 * A real-world location that owns the physical dartboards used by one or more
 * leagues. Venues are intentionally independent from leagues so the same room
 * and boards can host different competitions at different times.
 */
export const venues = sqliteTable(
  "venues",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    status: text("status").notNull(),
    createdByUserId: text("created_by_user_id").notNull(),
    createdAt: integer("created_at").notNull(),
    updatedAt: integer("updated_at").notNull(),
  },
  (table) => [
    index("venues_name_idx").on(table.name),
    index("venues_status_idx").on(table.status),
  ],
);

/** Many-to-many league access to a venue. */
export const leagueVenues = sqliteTable(
  "league_venues",
  {
    id: text("id").primaryKey(),
    leagueId: text("league_id")
      .notNull()
      .references(() => leagues.id, { onDelete: "cascade" }),
    venueId: text("venue_id")
      .notNull()
      .references(() => venues.id, { onDelete: "cascade" }),
    createdAt: integer("created_at").notNull(),
  },
  (table) => [
    uniqueIndex("league_venues_league_venue_unique").on(table.leagueId, table.venueId),
    index("league_venues_league_idx").on(table.leagueId),
    index("league_venues_venue_idx").on(table.venueId),
  ],
);

/** A permanent dartboard/oche resource at a venue. */
export const physicalBoards = sqliteTable(
  "physical_boards",
  {
    id: text("id").primaryKey(),
    venueId: text("venue_id")
      .notNull()
      .references(() => venues.id, { onDelete: "cascade" }),
    boardNumber: integer("board_number").notNull(),
    name: text("name").notNull(),
    status: text("status").notNull(),
    createdAt: integer("created_at").notNull(),
    updatedAt: integer("updated_at").notNull(),
  },
  (table) => [
    uniqueIndex("physical_boards_venue_number_unique").on(table.venueId, table.boardNumber),
    index("physical_boards_venue_idx").on(table.venueId),
    index("physical_boards_status_idx").on(table.status),
  ],
);

export type VenueRow = typeof venues.$inferSelect;
export type LeagueVenueRow = typeof leagueVenues.$inferSelect;
export type PhysicalBoardRow = typeof physicalBoards.$inferSelect;
