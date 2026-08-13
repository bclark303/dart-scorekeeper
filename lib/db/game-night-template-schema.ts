import { index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

import { leagues } from "./schema";

/** Reusable league-owned rule presets; each Game Night copies its own rule snapshot. */
export const gameNightTemplates = sqliteTable(
  "game_night_templates",
  {
    id: text("id").primaryKey(),
    leagueId: text("league_id").notNull().references(() => leagues.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    settingsJson: text("settings_json").notNull(),
    isDefault: integer("is_default", { mode: "boolean" }).notNull().default(false),
    createdByUserId: text("created_by_user_id").notNull(),
    createdAt: integer("created_at").notNull(),
    updatedAt: integer("updated_at").notNull(),
  },
  (table) => [
    uniqueIndex("game_night_templates_league_name_unique").on(table.leagueId, table.name),
    index("game_night_templates_league_id_idx").on(table.leagueId),
    index("game_night_templates_default_idx").on(table.leagueId, table.isDefault),
  ],
);

export type GameNightTemplateRow = typeof gameNightTemplates.$inferSelect;
export type NewGameNightTemplateRow = typeof gameNightTemplates.$inferInsert;
