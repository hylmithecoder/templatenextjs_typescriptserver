import type { BunSqlClient } from "../bun-env";
import { closeSql, getSql } from "./postgre";
import { migrateSchema } from "./scheme";

export async function seedDatabase(sql: BunSqlClient = getSql()): Promise<void> {
  await migrateSchema(sql);
  await sql`
    INSERT INTO app_meta (key, value)
    VALUES ('seeded', 'true')
    ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now()
  `;
}

if (import.meta.main) {
  void (async () => {
    await seedDatabase();
    await closeSql();
    console.log("[db:seed] Database seeded.");
  })();
}
