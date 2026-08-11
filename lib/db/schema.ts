import {
  index,
  integer,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";

/**
 * Canonical persistence schema.
 *
 * Keep every table SQLite-compatible. Vercel/Turso, local libSQL/SQLite, and a
 * future Cloudflare D1 adapter must be able to represent the same logical
 * model without provider-specific column types or extensions.
 */

export const appMetadata = sqliteTable("app_metadata", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
  updatedAt: integer("updated_at").notNull(),
});

/**
 * Optional long-lived player identity.
 *
 * Match participants also store a display-name snapshot so historical results
 * remain readable if a player is renamed or a guest never gets an account.
 */
export const players = sqliteTable(
  "players",
  {
    id: text("id").primaryKey(),
    displayName: text("display_name").notNull(),
    createdAt: integer("created_at").notNull(),
    updatedAt: integer("updated_at").notNull(),
    archivedAt: integer("archived_at"),
  },
  (table) => [
    index("players_display_name_idx").on(table.displayName),
    index("players_archived_at_idx").on(table.archivedAt),
  ],
);

/**
 * A league is the long-lived organizational container for seasons.
 *
 * Authentication identity remains separate from dart-player identity. League
 * permissions are granted through league_memberships rather than by attaching
 * an auth user directly to a player row.
 */
export const leagues = sqliteTable(
  "leagues",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    status: text("status").notNull(),
    createdByUserId: text("created_by_user_id").notNull(),
    createdAt: integer("created_at").notNull(),
    updatedAt: integer("updated_at").notNull(),
    archivedAt: integer("archived_at"),
  },
  (table) => [
    index("leagues_name_idx").on(table.name),
    index("leagues_status_idx").on(table.status),
    index("leagues_created_by_user_id_idx").on(table.createdByUserId),
    index("leagues_archived_at_idx").on(table.archivedAt),
  ],
);

/**
 * Account-level access to a league.
 *
 * userId intentionally has no foreign key to Better Auth. Auth is a replaceable
 * boundary, while the league domain remains provider-neutral and portable.
 */
export const leagueMemberships = sqliteTable(
  "league_memberships",
  {
    id: text("id").primaryKey(),
    leagueId: text("league_id")
      .notNull()
      .references(() => leagues.id, { onDelete: "cascade" }),
    userId: text("user_id").notNull(),
    role: text("role").notNull(),
    status: text("status").notNull(),
    createdAt: integer("created_at").notNull(),
    updatedAt: integer("updated_at").notNull(),
  },
  (table) => [
    uniqueIndex("league_memberships_league_user_unique").on(
      table.leagueId,
      table.userId,
    ),
    index("league_memberships_league_id_idx").on(table.leagueId),
    index("league_memberships_user_id_idx").on(table.userId),
    index("league_memberships_status_idx").on(table.status),
  ],
);

/** A named competition period within a league. */
export const seasons = sqliteTable(
  "seasons",
  {
    id: text("id").primaryKey(),
    leagueId: text("league_id")
      .notNull()
      .references(() => leagues.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    status: text("status").notNull(),
    startsAt: integer("starts_at"),
    endsAt: integer("ends_at"),
    createdAt: integer("created_at").notNull(),
    updatedAt: integer("updated_at").notNull(),
  },
  (table) => [
    index("seasons_league_id_idx").on(table.leagueId),
    index("seasons_status_idx").on(table.status),
    index("seasons_starts_at_idx").on(table.startsAt),
  ],
);

/**
 * Provider-neutral match envelope shared by every future game type.
 *
 * createdByUserId stores the Better Auth user that owns the synchronized copy.
 * It is deliberately not a database foreign key: auth remains a replaceable
 * boundary and the application schema stays portable if auth providers change.
 */
export const matches = sqliteTable(
  "matches",
  {
    id: text("id").primaryKey(),
    gameType: text("game_type").notNull(),
    status: text("status").notNull(),
    winnerSideId: text("winner_side_id"),
    createdByUserId: text("created_by_user_id"),
    createdAt: integer("created_at").notNull(),
    startedAt: integer("started_at"),
    updatedAt: integer("updated_at").notNull(),
    completedAt: integer("completed_at"),
  },
  (table) => [
    index("matches_game_type_idx").on(table.gameType),
    index("matches_status_idx").on(table.status),
    index("matches_completed_at_idx").on(table.completedAt),
    index("matches_created_by_user_id_idx").on(table.createdByUserId),
  ],
);

/** A side is the scoring unit: one player, a doubles pair, or a larger team. */
export const matchSides = sqliteTable(
  "match_sides",
  {
    id: text("id").primaryKey(),
    matchId: text("match_id")
      .notNull()
      .references(() => matches.id, { onDelete: "cascade" }),
    sideIndex: integer("side_index").notNull(),
    name: text("name").notNull(),
  },
  (table) => [
    uniqueIndex("match_sides_match_position_unique").on(
      table.matchId,
      table.sideIndex,
    ),
    index("match_sides_match_id_idx").on(table.matchId),
  ],
);

/**
 * A participant is one throw-order slot on a side.
 *
 * playerId is nullable for guests/dummy players. displayName is deliberately a
 * snapshot so historical matches never depend on the current player profile.
 */
export const matchParticipants = sqliteTable(
  "match_participants",
  {
    id: text("id").primaryKey(),
    sideId: text("side_id")
      .notNull()
      .references(() => matchSides.id, { onDelete: "cascade" }),
    playerId: text("player_id").references(() => players.id, {
      onDelete: "set null",
    }),
    slotIndex: integer("slot_index").notNull(),
    displayName: text("display_name").notNull(),
    isDummy: integer("is_dummy", { mode: "boolean" }).notNull(),
  },
  (table) => [
    uniqueIndex("match_participants_side_slot_unique").on(
      table.sideId,
      table.slotIndex,
    ),
    index("match_participants_side_id_idx").on(table.sideId),
    index("match_participants_player_id_idx").on(table.playerId),
  ],
);

/** X01-only configuration, one row per X01 match. */
export const x01MatchSettings = sqliteTable("x01_match_settings", {
  matchId: text("match_id")
    .primaryKey()
    .references(() => matches.id, { onDelete: "cascade" }),
  startingScore: integer("starting_score").notNull(),
  finishRule: text("finish_rule").notNull(),
  bestOfLegs: integer("best_of_legs").notNull(),
  scoreEntryMode: text("score_entry_mode").notNull(),
  rotationMode: text("rotation_mode").notNull(),
  dummyScore: integer("dummy_score").notNull(),
});

/** Completed/in-progress X01 legs. */
export const x01Legs = sqliteTable(
  "x01_legs",
  {
    id: text("id").primaryKey(),
    matchId: text("match_id")
      .notNull()
      .references(() => matches.id, { onDelete: "cascade" }),
    legNumber: integer("leg_number").notNull(),
    startingSideId: text("starting_side_id")
      .notNull()
      .references(() => matchSides.id),
    winnerSideId: text("winner_side_id").references(() => matchSides.id),
    startedAt: integer("started_at"),
    completedAt: integer("completed_at"),
  },
  (table) => [
    uniqueIndex("x01_legs_match_number_unique").on(
      table.matchId,
      table.legNumber,
    ),
    index("x01_legs_match_id_idx").on(table.matchId),
  ],
);

/** One scoring turn within an X01 leg. */
export const x01Turns = sqliteTable(
  "x01_turns",
  {
    id: text("id").primaryKey(),
    legId: text("leg_id")
      .notNull()
      .references(() => x01Legs.id, { onDelete: "cascade" }),
    sideId: text("side_id")
      .notNull()
      .references(() => matchSides.id),
    participantId: text("participant_id").references(
      () => matchParticipants.id,
    ),
    turnNumber: integer("turn_number").notNull(),
    scoreEntered: integer("score_entered").notNull(),
    scoreBefore: integer("score_before").notNull(),
    scoreAfter: integer("score_after").notNull(),
    dartsThrown: integer("darts_thrown").notNull(),
    isBust: integer("is_bust", { mode: "boolean" }).notNull(),
    isCheckout: integer("is_checkout", { mode: "boolean" }).notNull(),
    finishRule: text("finish_rule").notNull(),
    recordedAt: integer("recorded_at"),
  },
  (table) => [
    uniqueIndex("x01_turns_leg_number_unique").on(
      table.legId,
      table.turnNumber,
    ),
    index("x01_turns_leg_id_idx").on(table.legId),
    index("x01_turns_side_id_idx").on(table.sideId),
    index("x01_turns_participant_id_idx").on(table.participantId),
  ],
);

/** Optional individual dart detail for dart-by-dart turns. */
export const x01Darts = sqliteTable(
  "x01_darts",
  {
    id: text("id").primaryKey(),
    turnId: text("turn_id")
      .notNull()
      .references(() => x01Turns.id, { onDelete: "cascade" }),
    dartIndex: integer("dart_index").notNull(),
    segment: text("segment").notNull(),
    multiplier: integer("multiplier").notNull(),
    score: integer("score").notNull(),
  },
  (table) => [
    uniqueIndex("x01_darts_turn_position_unique").on(
      table.turnId,
      table.dartIndex,
    ),
    index("x01_darts_turn_id_idx").on(table.turnId),
  ],
);

export type AppMetadataRow = typeof appMetadata.$inferSelect;
export type NewAppMetadataRow = typeof appMetadata.$inferInsert;
export type PlayerRow = typeof players.$inferSelect;
export type NewPlayerRow = typeof players.$inferInsert;
export type LeagueRow = typeof leagues.$inferSelect;
export type NewLeagueRow = typeof leagues.$inferInsert;
export type LeagueMembershipRow = typeof leagueMemberships.$inferSelect;
export type NewLeagueMembershipRow = typeof leagueMemberships.$inferInsert;
export type SeasonRow = typeof seasons.$inferSelect;
export type NewSeasonRow = typeof seasons.$inferInsert;
export type MatchRow = typeof matches.$inferSelect;
export type MatchSideRow = typeof matchSides.$inferSelect;
export type MatchParticipantRow = typeof matchParticipants.$inferSelect;
export type X01MatchSettingsRow = typeof x01MatchSettings.$inferSelect;
export type X01LegRow = typeof x01Legs.$inferSelect;
export type X01TurnRow = typeof x01Turns.$inferSelect;
export type X01DartRow = typeof x01Darts.$inferSelect;
