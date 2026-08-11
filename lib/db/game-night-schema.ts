import { index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

import { leaguePlayers } from "./league-schema";
import { seasons } from "./schema";

/** A scheduled league event inside one season. */
export const gameNights = sqliteTable(
  "game_nights",
  {
    id: text("id").primaryKey(),
    seasonId: text("season_id")
      .notNull()
      .references(() => seasons.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    scheduledAt: integer("scheduled_at").notNull(),
    status: text("status").notNull(),
    createdByUserId: text("created_by_user_id").notNull(),
    createdAt: integer("created_at").notNull(),
    updatedAt: integer("updated_at").notNull(),
  },
  (table) => [
    index("game_nights_season_id_idx").on(table.seasonId),
    index("game_nights_scheduled_at_idx").on(table.scheduledAt),
    index("game_nights_status_idx").on(table.status),
  ],
);

/** Team-building, board, and X01 defaults captured for one game night. */
export const gameNightSettings = sqliteTable("game_night_settings", {
  gameNightId: text("game_night_id")
    .primaryKey()
    .references(() => gameNights.id, { onDelete: "cascade" }),
  teamCreationMode: text("team_creation_mode").notNull(),
  minTeamPlayers: integer("min_team_players").notNull(),
  maxTeamPlayers: integer("max_team_players").notNull(),
  dummyPlayerMode: text("dummy_player_mode").notNull(),
  boardCount: integer("board_count").notNull(),
  boardRotationType: text("board_rotation_type").notNull(),
  legsPerMatch: integer("legs_per_match").notNull(),
  startingScore: integer("starting_score").notNull(),
  finishRule: text("finish_rule").notNull(),
  updatedAt: integer("updated_at").notNull(),
});

/** Check-in and dues state for a season-rostered player on one game night. */
export const gameNightAttendance = sqliteTable(
  "game_night_attendance",
  {
    id: text("id").primaryKey(),
    gameNightId: text("game_night_id")
      .notNull()
      .references(() => gameNights.id, { onDelete: "cascade" }),
    leaguePlayerId: text("league_player_id")
      .notNull()
      .references(() => leaguePlayers.id, { onDelete: "cascade" }),
    status: text("status").notNull(),
    duesStatus: text("dues_status").notNull(),
    checkedInAt: integer("checked_in_at"),
    duesUpdatedAt: integer("dues_updated_at"),
    updatedAt: integer("updated_at").notNull(),
  },
  (table) => [
    uniqueIndex("game_night_attendance_night_player_unique").on(
      table.gameNightId,
      table.leaguePlayerId,
    ),
    index("game_night_attendance_game_night_id_idx").on(table.gameNightId),
    index("game_night_attendance_league_player_id_idx").on(table.leaguePlayerId),
    index("game_night_attendance_status_idx").on(table.status),
    index("game_night_attendance_dues_status_idx").on(table.duesStatus),
  ],
);

/** A team assembled for one game night. */
export const gameNightTeams = sqliteTable(
  "game_night_teams",
  {
    id: text("id").primaryKey(),
    gameNightId: text("game_night_id")
      .notNull()
      .references(() => gameNights.id, { onDelete: "cascade" }),
    teamIndex: integer("team_index").notNull(),
    name: text("name").notNull(),
    source: text("source").notNull(),
    createdAt: integer("created_at").notNull(),
    updatedAt: integer("updated_at").notNull(),
  },
  (table) => [
    uniqueIndex("game_night_teams_night_index_unique").on(
      table.gameNightId,
      table.teamIndex,
    ),
    index("game_night_teams_game_night_id_idx").on(table.gameNightId),
  ],
);

/** Player/dummy slots on a game-night team. */
export const gameNightTeamMembers = sqliteTable(
  "game_night_team_members",
  {
    id: text("id").primaryKey(),
    teamId: text("team_id")
      .notNull()
      .references(() => gameNightTeams.id, { onDelete: "cascade" }),
    leaguePlayerId: text("league_player_id").references(() => leaguePlayers.id, {
      onDelete: "set null",
    }),
    slotIndex: integer("slot_index").notNull(),
    displayName: text("display_name").notNull(),
    isDummy: integer("is_dummy", { mode: "boolean" }).notNull(),
  },
  (table) => [
    uniqueIndex("game_night_team_members_team_slot_unique").on(
      table.teamId,
      table.slotIndex,
    ),
    index("game_night_team_members_team_id_idx").on(table.teamId),
    index("game_night_team_members_league_player_id_idx").on(table.leaguePlayerId),
  ],
);

/** Physical board made available to one game night. */
export const gameNightBoards = sqliteTable(
  "game_night_boards",
  {
    id: text("id").primaryKey(),
    gameNightId: text("game_night_id")
      .notNull()
      .references(() => gameNights.id, { onDelete: "cascade" }),
    boardNumber: integer("board_number").notNull(),
    name: text("name").notNull(),
    createdAt: integer("created_at").notNull(),
  },
  (table) => [
    uniqueIndex("game_night_boards_night_number_unique").on(
      table.gameNightId,
      table.boardNumber,
    ),
    index("game_night_boards_game_night_id_idx").on(table.gameNightId),
  ],
);

/** Initial/future round pairing of two teams on a physical board. */
export const gameNightBoardPairings = sqliteTable(
  "game_night_board_pairings",
  {
    id: text("id").primaryKey(),
    gameNightId: text("game_night_id")
      .notNull()
      .references(() => gameNights.id, { onDelete: "cascade" }),
    boardId: text("board_id")
      .notNull()
      .references(() => gameNightBoards.id, { onDelete: "cascade" }),
    roundNumber: integer("round_number").notNull(),
    teamAId: text("team_a_id")
      .notNull()
      .references(() => gameNightTeams.id, { onDelete: "cascade" }),
    teamBId: text("team_b_id")
      .notNull()
      .references(() => gameNightTeams.id, { onDelete: "cascade" }),
    status: text("status").notNull(),
    createdAt: integer("created_at").notNull(),
    updatedAt: integer("updated_at").notNull(),
  },
  (table) => [
    uniqueIndex("game_night_pairings_round_board_unique").on(
      table.gameNightId,
      table.roundNumber,
      table.boardId,
    ),
    index("game_night_pairings_game_night_id_idx").on(table.gameNightId),
    index("game_night_pairings_board_id_idx").on(table.boardId),
    index("game_night_pairings_team_a_id_idx").on(table.teamAId),
    index("game_night_pairings_team_b_id_idx").on(table.teamBId),
  ],
);

export type GameNightRow = typeof gameNights.$inferSelect;
export type GameNightSettingsRow = typeof gameNightSettings.$inferSelect;
export type GameNightAttendanceRow = typeof gameNightAttendance.$inferSelect;
export type GameNightTeamRow = typeof gameNightTeams.$inferSelect;
export type GameNightTeamMemberRow = typeof gameNightTeamMembers.$inferSelect;
export type GameNightBoardRow = typeof gameNightBoards.$inferSelect;
export type GameNightBoardPairingRow = typeof gameNightBoardPairings.$inferSelect;
