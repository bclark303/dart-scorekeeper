import { index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

import { physicalBoards, venues } from "./venue-schema";

/**
 * A persistent scoring device installed at a venue.
 *
 * Devices do not belong to leagues and do not represent a dartboard. A device
 * may be assigned to one physical board at a time, or left unassigned as a
 * spare. Reassigning the device never changes a fixture or match identity.
 *
 * The legacy SQL table name is retained for this migration so existing paired
 * credentials can be moved in place without Drizzle interpreting this as an
 * unrelated table rename. The domain model contains no league ownership.
 */
export const boardDevices = sqliteTable(
  "league_board_devices",
  {
    id: text("id").primaryKey(),
    venueId: text("venue_id")
      .notNull()
      .references(() => venues.id, { onDelete: "cascade" }),
    physicalBoardId: text("physical_board_id").references(() => physicalBoards.id, {
      onDelete: "set null",
    }),
    name: text("name").notNull(),
    status: text("status").notNull(),
    credentialHash: text("credential_hash").notNull(),
    createdByUserId: text("created_by_user_id").notNull(),
    lastSeenAt: integer("last_seen_at"),
    createdAt: integer("created_at").notNull(),
    updatedAt: integer("updated_at").notNull(),
  },
  (table) => [
    uniqueIndex("board_devices_physical_board_unique").on(table.physicalBoardId),
    index("board_devices_venue_idx").on(table.venueId),
    index("board_devices_status_idx").on(table.status),
  ],
);

export type BoardDeviceRow = typeof boardDevices.$inferSelect;
