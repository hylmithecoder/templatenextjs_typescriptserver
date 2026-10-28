import type { BunSqlClient } from "../bun-env";

export interface DatabaseConfig {
  host: string;
  port: number;
  user: string;
  password: string;
  database: string;
}

export function getDatabaseConfig(dbNameOverride?: string): DatabaseConfig {
  return {
    host: process.env.DB_HOST || "127.0.0.1",
    port: Number(process.env.DB_PORT || 5432),
    user: process.env.DB_USER || "your_user",
    password: process.env.DB_PASSWORD || "your_password",
    database: dbNameOverride || process.env.DB_NAME || "app_template",
  };
}

export function buildConnectionUrl(config: DatabaseConfig): string {
  const user = encodeURIComponent(config.user);
  const pass = encodeURIComponent(config.password);
  return `postgresql://${user}:${pass}@${config.host}:${config.port}/${config.database}`;
}

export function getAdminConnectionUrl(): string {
  return buildConnectionUrl(getDatabaseConfig("postgres"));
}

export function getDatabaseUrl(dbNameOverride?: string): string {
  if (!dbNameOverride && process.env.DATABASE_URL) {
    return process.env.DATABASE_URL;
  }
  return buildConnectionUrl(getDatabaseConfig(dbNameOverride));
}

export async function ensureDatabaseExists(
  dbNameOverride?: string,
): Promise<{ database: string; created: boolean }> {
  const config = getDatabaseConfig(dbNameOverride);
  const targetDb = config.database;

  if (!/^[a-zA-Z0-9_]+$/.test(targetDb)) {
    throw new Error(`Invalid database identifier: ${targetDb}`);
  }

  const adminSql = new Bun.SQL(getAdminConnectionUrl());
  try {
    const existing = await adminSql<{ exists: number }>`
      SELECT 1 AS exists
      FROM pg_database
      WHERE datname = ${targetDb}
    `;

    if (existing.length === 0) {
      await adminSql.unsafe(`CREATE DATABASE "${targetDb}"`);
      return { database: targetDb, created: true };
    }
    return { database: targetDb, created: false };
  } finally {
    await adminSql.close();
  }
}

let sharedSql: BunSqlClient | null = null;

export function createSqlClient(dbNameOverride?: string): BunSqlClient {
  return new Bun.SQL(getDatabaseUrl(dbNameOverride));
}

export function getSql(): BunSqlClient {
  if (!sharedSql) {
    sharedSql = createSqlClient();
  }
  return sharedSql;
}

export async function closeSql(): Promise<void> {
  if (sharedSql) {
    const client = sharedSql;
    sharedSql = null;
    await client.close();
  }
}
