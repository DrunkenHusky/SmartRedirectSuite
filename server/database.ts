import pg from "pg";
import type { ApplicationConfiguration } from "./config";

export function createDatabasePool(configuration: ApplicationConfiguration): pg.Pool {
  return new pg.Pool({
    connectionString: configuration.DATABASE_URL,
    ssl: configuration.DATABASE_SSL ? { rejectUnauthorized: true } : undefined,
    max: 20,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 5_000,
  });
}

export async function migrateDatabase(pool: pg.Pool): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS application_documents (
      document_key text PRIMARY KEY,
      value jsonb NOT NULL,
      updated_at timestamptz NOT NULL DEFAULT now()
    );
    CREATE TABLE IF NOT EXISTS user_sessions (
      session_id text PRIMARY KEY,
      session_data jsonb NOT NULL,
      expires_at timestamptz NOT NULL
    );
    CREATE INDEX IF NOT EXISTS user_sessions_expires_at_idx ON user_sessions (expires_at);
  `);
}
