import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

/**
 * Small bootstrap table used to prove the portable persistence path before we
 * commit to the larger league/tournament schema.
 *
 * Keep this schema SQLite-compatible. Turso/libSQL, local SQLite, and a future
 * Cloudflare D1 adapter should all be able to represent these tables without
 * provider-specific column types.
 */
export const appMetadata = sqliteTable("app_metadata", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
  updatedAt: integer("updated_at").notNull(),
});

export type AppMetadataRow = typeof appMetadata.$inferSelect;
export type NewAppMetadataRow = typeof appMetadata.$inferInsert;
