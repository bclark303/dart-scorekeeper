import { index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

import {
  gameNightBoardPairings,
  gameNightBoards,
  gameNightTeamMembers,
  gameNightTeams,
  gameNights,
} from "./game-night-schema";
import { leaguePlayers } from "./league-schema";

/**
 * One centrally managed X01 match assigned to a physical board pairing.
 *
 * The session stores assignment/configuration and lifecycle only. Current
 * scores, throw order, and leg totals are derived from the append-only turn
 * history so clients can safely retry after a network interruption.
 */
export const leagueMatchSessions = sqliteTable(
  "league_match_sessions",
  {
    id: text("id").primaryKey(),
    pairingId: text("pairing_id")
      .notNull()
      .references(() => gameNightBoardPairings.id, { onDelete: "cascade" }),
    gameNightId: text("game_night_id")
      .notNull()
      .references(() => gameNights.id, { onDelete: "cascade" }),
    boardId: text("board_id")
      .notNull()
      .references(() => gameNightBoards.id, { onDelete: "cascade" }),
    teamAId: text("team_a_id")
      .notNull()
      .references(() => gameNightTeams.id, { onDelete: "cascade" }),
    teamBId: text("team_b_id")
      .notNull()
      .references(() => gameNightTeams.id, { onDelete: "cascade" }),
    status: text("status").notNull(),
    startingScore: integer("starting_score").notNull(),
    finishRule: text("finish_rule").notNull(),
    legsPerMatch: integer("legs_per_match").notNull(),
    dummyScore: integer("dummy_score").notNull().default(0),
    winnerTeamId: text("winner_team_id").references(() => gameNightTeams.id, {
      onDelete: "set null",
    }),
    startedAt: integer("started_at"),
    completedAt: integer("completed_at"),
    createdAt: integer("created_at").notNull(),
    updatedAt: integer("updated_at").notNull(),
  },
  (table) => [
    uniqueIndex("league_match_sessions_pairing_unique").on(table.pairingId),
    index("league_match_sessions_game_night_idx").on(table.gameNightId),
    index("league_match_sessions_board_idx").on(table.boardId),
    index("league_match_sessions_status_idx").on(table.status),
  ],
);

/**
 * An individual scored turn for a league match.
 *
 * The browser/device supplies the primary key. Re-sending the same turn ID is
 * therefore idempotent, which is the basis for a future offline board queue.
 * Undo marks a turn void rather than deleting it so the audit trail remains.
 */
export const leagueMatchTurns = sqliteTable(
  "league_match_turns",
  {
    id: text("id").primaryKey(),
    matchSessionId: text("match_session_id")
      .notNull()
      .references(() => leagueMatchSessions.id, { onDelete: "cascade" }),
    turnIndex: integer("turn_index").notNull(),
    legNumber: integer("leg_number").notNull(),
    teamId: text("team_id")
      .notNull()
      .references(() => gameNightTeams.id, { onDelete: "cascade" }),
    teamMemberId: text("team_member_id").references(() => gameNightTeamMembers.id, {
      onDelete: "set null",
    }),
    leaguePlayerId: text("league_player_id").references(() => leaguePlayers.id, {
      onDelete: "set null",
    }),
    displayName: text("display_name").notNull(),
    isDummy: integer("is_dummy", { mode: "boolean" }).notNull(),
    scoreEntered: integer("score_entered").notNull(),
    scoreBefore: integer("score_before").notNull(),
    scoreAfter: integer("score_after").notNull(),
    dartsThrown: integer("darts_thrown").notNull(),
    isBust: integer("is_bust", { mode: "boolean" }).notNull(),
    isCheckout: integer("is_checkout", { mode: "boolean" }).notNull(),
    checkoutConfirmed: integer("checkout_confirmed", { mode: "boolean" }).notNull(),
    voidedAt: integer("voided_at"),
    createdAt: integer("created_at").notNull(),
  },
  (table) => [
    uniqueIndex("league_match_turns_session_index_unique").on(
      table.matchSessionId,
      table.turnIndex,
    ),
    index("league_match_turns_session_idx").on(table.matchSessionId),
    index("league_match_turns_player_idx").on(table.leaguePlayerId),
    index("league_match_turns_team_idx").on(table.teamId),
  ],
);

/** Exact darts recorded for a graphical league turn. */
export const leagueMatchDarts = sqliteTable(
  "league_match_darts",
  {
    id: text("id").primaryKey(),
    turnId: text("turn_id")
      .notNull()
      .references(() => leagueMatchTurns.id, { onDelete: "cascade" }),
    dartIndex: integer("dart_index").notNull(),
    segment: text("segment").notNull(),
    multiplier: integer("multiplier").notNull(),
    score: integer("score").notNull(),
    createdAt: integer("created_at").notNull(),
  },
  (table) => [
    uniqueIndex("league_match_darts_turn_index_unique").on(table.turnId, table.dartIndex),
    index("league_match_darts_turn_idx").on(table.turnId),
  ],
);

export type LeagueMatchSessionRow = typeof leagueMatchSessions.$inferSelect;
export type LeagueMatchTurnRow = typeof leagueMatchTurns.$inferSelect;
export type LeagueMatchDartRow = typeof leagueMatchDarts.$inferSelect;
