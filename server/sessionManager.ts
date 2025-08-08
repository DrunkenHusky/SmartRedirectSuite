import { db } from './db';
import { adminSessions, type AdminSession } from '@shared/schema';
import { eq, and, gt } from 'drizzle-orm';
import { nanoid } from 'nanoid';

export class SessionManager {
  private static SESSION_DURATION = 7 * 24 * 60 * 60 * 1000; // 7 days

  static async createSession(sessionData: any): Promise<string> {
    const sessionId = nanoid();
    const expiresAt = new Date(Date.now() + this.SESSION_DURATION);
    
    await db.insert(adminSessions).values({
      id: sessionId,
      sessionData,
      expiresAt,
    });

    return sessionId;
  }

  static async getSession(sessionId: string): Promise<AdminSession | null> {
    const [session] = await db
      .select()
      .from(adminSessions)
      .where(
        and(
          eq(adminSessions.id, sessionId),
          gt(adminSessions.expiresAt, new Date())
        )
      );

    if (session) {
      // Update last accessed time
      await db
        .update(adminSessions)
        .set({ lastAccessedAt: new Date() })
        .where(eq(adminSessions.id, sessionId));
    }

    return session || null;
  }

  static async deleteSession(sessionId: string): Promise<void> {
    await db.delete(adminSessions).where(eq(adminSessions.id, sessionId));
  }

  static async cleanupExpiredSessions(): Promise<void> {
    const now = new Date();
    await db.delete(adminSessions).where(gt(adminSessions.expiresAt, now));
  }

  static async extendSession(sessionId: string): Promise<void> {
    const newExpiresAt = new Date(Date.now() + this.SESSION_DURATION);
    await db
      .update(adminSessions)
      .set({ 
        expiresAt: newExpiresAt,
        lastAccessedAt: new Date()
      })
      .where(eq(adminSessions.id, sessionId));
  }
}
