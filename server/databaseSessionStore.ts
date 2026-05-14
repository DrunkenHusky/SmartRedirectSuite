import { Store, type SessionData } from 'express-session';
import fs from 'fs/promises';
import path from 'path';
import { Op } from 'sequelize';
import { initDb, AdminSessionModel } from './db';

interface SessionStoreOptions {
  cleanupIntervalMs?: number;
  legacySessionsDir?: string;
}

function normalizeExpiry(value: unknown): Date | null {
  if (!value) {
    return null;
  }

  const expiresAt = value instanceof Date ? value : new Date(String(value));
  return Number.isNaN(expiresAt.getTime()) ? null : expiresAt;
}

function getSessionExpiry(session: SessionData): Date | null {
  return normalizeExpiry(session.cookie?.expires);
}

function isExpired(expiresAt: Date | null): boolean {
  return Boolean(expiresAt && expiresAt.getTime() <= Date.now());
}

function isValidSessionId(sessionId: string): boolean {
  return typeof sessionId === 'string'
    && sessionId.length > 0
    && sessionId.length <= 255
    && !/[\u0000-\u001f\u007f]/.test(sessionId);
}

export class DatabaseSessionStore extends Store {
  private readonly cleanupIntervalMs: number;
  private readonly legacySessionsDir: string;
  private readonly readyPromise: Promise<void>;
  private cleanupTimer: NodeJS.Timeout | null = null;

  constructor(options: SessionStoreOptions = {}) {
    super();
    this.cleanupIntervalMs = options.cleanupIntervalMs ?? 60 * 60 * 1000;
    this.legacySessionsDir = options.legacySessionsDir ?? path.join(process.cwd(), 'data', 'sessions');
    this.readyPromise = this.initialize();
  }

  private async initialize(): Promise<void> {
    await initDb();
    await this.pruneExpiredSessions();
    this.startCleanupTimer();
  }

  private async ensureReady(): Promise<void> {
    await this.readyPromise;
  }

  private validateSessionId(sessionId: string): void {
    if (!isValidSessionId(sessionId)) {
      throw new Error('Invalid session ID');
    }
  }

  override get(sessionId: string, callback: (err: any, session?: SessionData | null) => void): void {
    (async () => {
      this.validateSessionId(sessionId);
      await this.ensureReady();

      const row = await AdminSessionModel.findByPk(sessionId);
      if (!row) {
        callback(null, null);
        return;
      }

      const expiresAt = normalizeExpiry(row.getDataValue('expiresAt'));
      if (isExpired(expiresAt)) {
        await row.destroy();
        callback(null, null);
        return;
      }

      callback(null, row.getDataValue('data') as SessionData);
    })().catch(error => callback(error));
  }

  override set(sessionId: string, session: SessionData, callback?: (err?: any) => void): void {
    (async () => {
      this.validateSessionId(sessionId);
      await this.ensureReady();

      const expiresAt = getSessionExpiry(session);
      await AdminSessionModel.upsert({
        id: sessionId,
        data: session,
        expiresAt: expiresAt?.toISOString() ?? null,
      } as any);
      callback?.();
    })().catch(error => callback?.(error));
  }

  override destroy(sessionId: string, callback?: (err?: any) => void): void {
    (async () => {
      this.validateSessionId(sessionId);
      await this.ensureReady();
      await AdminSessionModel.destroy({ where: { id: sessionId } });
      callback?.();
    })().catch(error => callback?.(error));
  }

  override touch(sessionId: string, session: SessionData, callback?: (err?: any) => void): void {
    this.set(sessionId, session, callback);
  }

  override all(callback: (err: any, obj?: { [sid: string]: SessionData } | SessionData[] | null) => void): void {
    (async () => {
      await this.ensureReady();
      await this.pruneExpiredSessions();
      const rows = await AdminSessionModel.findAll();
      callback(null, rows.map(row => row.getDataValue('data') as SessionData));
    })().catch(error => callback(error));
  }

  override length(callback: (err: any, length?: number) => void): void {
    (async () => {
      await this.ensureReady();
      await this.pruneExpiredSessions();
      const count = await AdminSessionModel.count();
      callback(null, count);
    })().catch(error => callback(error));
  }

  override clear(callback?: (err?: any) => void): void {
    (async () => {
      await this.ensureReady();
      await AdminSessionModel.destroy({ where: {} });
      await this.clearLegacySessionFiles();
      callback?.();
    })().catch(error => callback?.(error));
  }

  async close(): Promise<void> {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }
  }

  private startCleanupTimer(): void {
    if (this.cleanupTimer || this.cleanupIntervalMs <= 0) {
      return;
    }

    this.cleanupTimer = setInterval(() => {
      this.pruneExpiredSessions().catch(error => {
        console.warn('Session cleanup error:', error);
      });
    }, this.cleanupIntervalMs);
    this.cleanupTimer.unref?.();
  }

  private async pruneExpiredSessions(): Promise<void> {
    await AdminSessionModel.destroy({
      where: {
        expiresAt: {
          [Op.lt]: new Date().toISOString(),
        },
      },
    });
  }

  private async clearLegacySessionFiles(): Promise<void> {
    let files: string[];
    try {
      files = await fs.readdir(this.legacySessionsDir);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        throw error;
      }
      return;
    }

    await Promise.all(files
      .filter(file => file.endsWith('.json'))
      .map(file => fs.rm(path.join(this.legacySessionsDir, file), { force: true })));
  }
}
