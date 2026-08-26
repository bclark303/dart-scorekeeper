import { index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

import { leagues, players, seasons } from "./schema";

/**
 * A persistent dart-player profile attached to a league.
 *
 * The underlying player row can survive across seasons and remains independent
 * from Better Auth account identity. This association only says that the player
 * belongs to the league's player pool.
 */
export const leaguePlayers = sqliteTable(
  "league_players",
  {
    id: text("id").primaryKey(),
    leagueId: text("league_id")
      .notNull()
      .references(() => leagues.id, { onDelete: "cascade" }),
    playerId: text("player_id")
      .notNull()
      .references(() => players.id, { onDelete: "cascade" }),
    status: text("status").notNull(),
    createdAt: integer("created_at").notNull(),
    updatedAt: integer("updated_at").notNull(),
  },
  (table) => [
    uniqueIndex("league_players_league_player_unique").on(
      table.leagueId,
      table.playerId,
    ),
    index("league_players_league_id_idx").on(table.leagueId),
    index("league_players_player_id_idx").on(table.playerId),
    index("league_players_status_idx").on(table.status),
  ],
);

/**
 * A player's participation in one season.
 *
 * Entries are retained when a player is removed from a roster by switching to
 * `withdrawn` instead of deleting the row. That gives future standings/audit
 * work a durable record of participation changes.
 */
export const seasonRosterEntries = sqliteTable(
  "season_roster_entries",
  {
    id: text("id").primaryKey(),
    seasonId: text("season_id")
      .notNull()
      .references(() => seasons.id, { onDelete: "cascade" }),
    leaguePlayerId: text("league_player_id")
      .notNull()
      .references(() => leaguePlayers.id, { onDelete: "cascade" }),
    status: text("status").notNull(),
    createdAt: integer("created_at").notNull(),
    updatedAt: integer("updated_at").notNull(),
  },
  (table) => [
    uniqueIndex("season_roster_entries_season_player_unique").on(
      table.seasonId,
      table.leaguePlayerId,
    ),
    index("season_roster_entries_season_id_idx").on(table.seasonId),
    index("season_roster_entries_league_player_id_idx").on(table.leaguePlayerId),
    index("season_roster_entries_status_idx").on(table.status),
  ],
);

export type LeaguePlayerRow = typeof leaguePlayers.$inferSelect;
export type NewLeaguePlayerRow = typeof leaguePlayers.$inferInsert;
export type SeasonRosterEntryRow = typeof seasonRosterEntries.$inferSelect;
export type NewSeasonRosterEntryRow = typeof seasonRosterEntries.$inferInsert;
