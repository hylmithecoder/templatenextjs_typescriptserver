import type { BunSqlClient } from "../bun-env";
import { closeSql, ensureDatabaseExists, getSql } from "./postgre";

export async function migrateSchema(sql: BunSqlClient = getSql()): Promise<void> {
  await sql`
    CREATE TABLE IF NOT EXISTS app_meta (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `;
}

if (import.meta.main) {
  void (async () => {
    await ensureDatabaseExists();
    await migrateSchema();
    await closeSql();
    console.log("[db:setup] Schema migrated.");
  })();
}
