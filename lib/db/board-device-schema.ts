import { index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

import { leagues } from "./schema";

/**
 * A persistent scorer device registered to one league and physical board slot.
 *
 * The plaintext device key is never stored. Only a SHA-256 hash is persisted;
 * administrators see the usable key once when registering or rotating it.
 */
export const leagueBoardDevices = sqliteTable(
  "league_board_devices",
  {
    id: text("id").primaryKey(),
    leagueId: text("league_id")
      .notNull()
      .references(() => leagues.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    boardNumber: integer("board_number").notNull(),
    status: text("status").notNull(),
    credentialHash: text("credential_hash").notNull(),
    createdByUserId: text("created_by_user_id").notNull(),
    lastSeenAt: integer("last_seen_at"),
    createdAt: integer("created_at").notNull(),
    updatedAt: integer("updated_at").notNull(),
  },
  (table) => [
    uniqueIndex("league_board_devices_league_board_unique").on(
      table.leagueId,
      table.boardNumber,
    ),
    index("league_board_devices_league_idx").on(table.leagueId),
    index("league_board_devices_status_idx").on(table.status),
  ],
);

export type LeagueBoardDeviceRow = typeof leagueBoardDevices.$inferSelect;
