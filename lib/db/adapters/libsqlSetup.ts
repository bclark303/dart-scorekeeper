import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { migrate } from "drizzle-orm/libsql/migrator";

export type LibSqlSetupConnection = {
  url: string;
  authToken?: string;
};

export async function testLibSqlSetupConnection(
  connection: LibSqlSetupConnection,
) {
  const client = createClient({
    url: connection.url,
    authToken: connection.authToken,
  });

  try {
    await client.execute("select 1 as ok");
  } finally {
    client.close();
  }
}

export async function migrateLibSqlSetupConnection(
  connection: LibSqlSetupConnection,
) {
  const client = createClient({
    url: connection.url,
    authToken: connection.authToken,
  });
  const db = drizzle(client);

  try {
    await migrate(db, { migrationsFolder: "./drizzle" });
  } finally {
    client.close();
  }
}
