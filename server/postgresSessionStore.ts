import { Store, type SessionData } from "express-session";
import type pg from "pg";

export class PostgresSessionStore extends Store {
  constructor(private readonly pool: pg.Pool) { super(); }

  override get(sessionId: string, callback: (error: unknown, session?: SessionData | null) => void): void {
    this.pool.query("SELECT session_data FROM user_sessions WHERE session_id=$1 AND expires_at > now()", [sessionId])
      .then(result => callback(null, result.rows[0]?.session_data ?? null)).catch(callback);
  }
  override set(sessionId: string, sessionData: SessionData, callback?: (error?: unknown) => void): void {
    const expiresAt = sessionData.cookie.expires ?? new Date(Date.now() + 7 * 86_400_000);
    this.pool.query(`INSERT INTO user_sessions(session_id,session_data,expires_at) VALUES($1,$2,$3)
      ON CONFLICT(session_id) DO UPDATE SET session_data=EXCLUDED.session_data, expires_at=EXCLUDED.expires_at`,
    [sessionId, sessionData, expiresAt]).then(() => callback?.()).catch(error => callback?.(error));
  }
  override destroy(sessionId: string, callback?: (error?: unknown) => void): void {
    this.pool.query("DELETE FROM user_sessions WHERE session_id=$1", [sessionId])
      .then(() => callback?.()).catch(error => callback?.(error));
  }
  override touch(sessionId: string, sessionData: SessionData, callback?: () => void): void {
    this.set(sessionId, sessionData, callback);
  }
}
