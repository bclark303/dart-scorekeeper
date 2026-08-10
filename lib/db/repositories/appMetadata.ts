import { eq, sql } from "drizzle-orm";
import { getDatabase } from "../client";
import { appMetadata, type AppMetadataRow } from "../schema";

/** Verify that the configured database is reachable without leaking details. */
export async function pingDatabase() {
  await getDatabase().run(sql`select 1 as ok`);
}

export async function getAppMetadata(
  key: string,
): Promise<AppMetadataRow | null> {
  const [record] = await getDatabase()
    .select()
    .from(appMetadata)
    .where(eq(appMetadata.key, key))
    .limit(1);

  return record ?? null;
}

export async function setAppMetadata(key: string, value: string) {
  const updatedAt = Date.now();

  await getDatabase()
    .insert(appMetadata)
    .values({ key, value, updatedAt })
    .onConflictDoUpdate({
      target: appMetadata.key,
      set: { value, updatedAt },
    });

  return { key, value, updatedAt };
}
