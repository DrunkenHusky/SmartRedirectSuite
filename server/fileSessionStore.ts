import { Store, SessionData } from 'express-session';
import fs from 'fs/promises';
import path from 'path';
import { randomUUID } from 'crypto';

interface StoredSession {
  data: SessionData;
  expires?: Date;
}

export class FileSessionStore extends Store {
  private sessionsDir: string;
  private dirReady = false;
  private ensureDirPromise: Promise<void> | null = null;
  private pendingWrites = new Map<
    string,
    { session: StoredSession; callbacks: ((err?: any) => void)[] }
  >();
  private writeTimer: NodeJS.Timeout | null = null;
  private flushInProgress = false;

  constructor(options: { dir?: string } = {}) {
    super();
    this.sessionsDir = options.dir || path.join(process.cwd(), 'data', 'sessions');
    this.ensureSessionsDir();
  }

  private async ensureSessionsDir(): Promise<void> {
    if (this.dirReady) return;
    if (!this.ensureDirPromise) {
      this.ensureDirPromise = fs
        .mkdir(this.sessionsDir, { recursive: true })
        .then(() => {
          this.dirReady = true;
        })
        .catch(error => {
          console.error('Failed to create sessions directory:', error);
        })
        .finally(() => {
          this.ensureDirPromise = null;
        });
    }
    return this.ensureDirPromise;
  }

  private getSessionPath(sid: string): string {
    return path.join(this.sessionsDir, `${sid}.json`);
  }

  override get(sid: string, callback: (err: any, session?: SessionData | null) => void): void {
    (async () => {
      try {
        const sessionPath = this.getSessionPath(sid);
        
        // Check if file exists first
        try {
          await fs.access(sessionPath);
        } catch {
          callback(null, null);
          return;
        }
        
        const data = await fs.readFile(sessionPath, 'utf8');
        
        // Handle empty or invalid JSON
        if (!data || data.trim() === '') {
          this.destroy(sid, () => {});
          callback(null, null);
          return;
        }
        
        const stored: StoredSession = JSON.parse(data);
        
        // Check if session has expired
        if (stored.expires && new Date() > new Date(stored.expires)) {
          this.destroy(sid, () => {});
          callback(null, null);
          return;
        }

        callback(null, stored.data);
      } catch (error) {
        if ((error as any).code === 'ENOENT') {
          callback(null, null);
        } else {
          // Handle JSON parse errors by removing corrupted session
          console.warn(`Corrupted session file detected for ${sid}, removing:`, error);
          this.destroy(sid, () => {});
          callback(null, null);
        }
      }
    })();
  }

  override set(
    sid: string,
    session: SessionData,
    callback?: (err?: any) => void
  ): void {
    this.initializeCleanup(); // Initialize cleanup on first use

    const stored: StoredSession = {
      data: session,
      expires: session.cookie?.expires
    };

    if (this.pendingWrites.has(sid)) {
      const entry = this.pendingWrites.get(sid)!;
      entry.session = stored;
      if (callback) entry.callbacks.push(callback);
    } else {
      this.pendingWrites.set(sid, {
        session: stored,
        callbacks: callback ? [callback] : []
      });
    }

    this.scheduleWrite();
  }

  override destroy(sid: string, callback?: (err?: any) => void): void {
    (async () => {
      try {
        const sessionPath = this.getSessionPath(sid);
        await fs.unlink(sessionPath);
        callback?.();
      } catch (error) {
        if ((error as any).code === 'ENOENT') {
          callback?.();
        } else {
          callback?.(error);
        }
      }
    })();
  }

  override all(callback: (err: any, obj?: { [sid: string]: SessionData } | SessionData[] | null) => void): void {
    (async () => {
      try {
        await this.ensureSessionsDir(); // Ensure sessions directory exists
        const files = await fs.readdir(this.sessionsDir);
        const sessions: SessionData[] = [];
        
        for (const file of files) {
          if (file.endsWith('.json')) {
            try {
              const data = await fs.readFile(path.join(this.sessionsDir, file), 'utf8');
              const stored: StoredSession = JSON.parse(data);
              
              // Skip expired sessions
              if (stored.expires && new Date() > new Date(stored.expires)) {
                continue;
              }
              
              sessions.push(stored.data);
            } catch (error) {
              // Skip corrupted session files
              console.warn(`Skipping corrupted session file: ${file}`);
            }
          }
        }
        
        callback(null, sessions);
      } catch (error) {
        callback(error);
      }
    })();
  }

  override length(callback: (err: any, length?: number) => void): void {
    (async () => {
      try {
        await this.ensureSessionsDir();
        const files = await fs.readdir(this.sessionsDir);
        const validSessions = files.filter(file => file.endsWith('.json'));
        callback(null, validSessions.length);
      } catch (error) {
        callback(error);
      }
    })();
  }

  override clear(callback?: (err?: any) => void): void {
    (async () => {
      try {
        await this.ensureSessionsDir();
        const files = await fs.readdir(this.sessionsDir);
        await Promise.all(
          files
            .filter(file => file.endsWith('.json'))
            .map(file => fs.unlink(path.join(this.sessionsDir, file)))
        );
        callback?.();
      } catch (error) {
        callback?.(error);
      }
    })();
  }

  override touch(sid: string, session: SessionData, callback?: (err?: any) => void): void {
    // Update the session's last access time
    this.set(sid, session, callback);
  }

  // Cleanup expired sessions periodically
  private cleanupExpiredSessions(): void {
    (async () => {
      try {
        await this.ensureSessionsDir();
        const files = await fs.readdir(this.sessionsDir);
        
        for (const file of files) {
          if (file.endsWith('.json')) {
            try {
              const sessionPath = path.join(this.sessionsDir, file);
              const data = await fs.readFile(sessionPath, 'utf8');
              const stored: StoredSession = JSON.parse(data);
              
              // Remove expired sessions
              if (stored.expires && new Date() > new Date(stored.expires)) {
                await fs.unlink(sessionPath);
                console.log(`Cleaned up expired session: ${file}`);
              }
            } catch (error) {
              // Remove corrupted session files
              await fs.unlink(path.join(this.sessionsDir, file));
              console.log(`Cleaned up corrupted session: ${file}`);
            }
          }
        }
      } catch (error) {
        console.warn('Session cleanup error:', error);
      }
    })();
  }

  private scheduleWrite(): void {
    if (!this.writeTimer) {
      this.writeTimer = setTimeout(() => this.flushPendingWrites(), 50);
    }
  }

  private async flushPendingWrites(): Promise<void> {
    if (this.flushInProgress) return;
    this.flushInProgress = true;

    const writes = Array.from(this.pendingWrites.entries());
    this.pendingWrites.clear();
    this.writeTimer = null;

    try {
      await this.ensureSessionsDir();
      await Promise.all(
        writes.map(([sid, entry]) =>
          this.writeSessionFile(sid, entry.session)
        )
      );
      writes.forEach(([, entry]) =>
        entry.callbacks.forEach(cb => cb?.())
      );
    } catch (error) {
      writes.forEach(([, entry]) =>
        entry.callbacks.forEach(cb => cb?.(error))
      );
    } finally {
      this.flushInProgress = false;
      if (this.pendingWrites.size) {
        this.scheduleWrite();
      }
    }
  }

  private async writeSessionFile(
    sid: string,
    stored: StoredSession
  ): Promise<void> {
    const sessionPath = this.getSessionPath(sid);

    // Use a unique temp file to avoid conflicts during concurrent access
    const tempPath = `${sessionPath}.${randomUUID()}.tmp`;
    await fs.writeFile(tempPath, JSON.stringify(stored, null, 2));

    // Remove any existing session file to avoid Windows rename errors
    await fs.rm(sessionPath, { force: true });

    try {
      await fs.rename(tempPath, sessionPath);
    } catch (error: any) {
      // Fallback for Windows EPERM or EXDEV errors
      if (['EXDEV', 'EACCES', 'EPERM'].includes(error.code)) {
        await fs.copyFile(tempPath, sessionPath);
        await fs.unlink(tempPath);
      } else {
        throw error;
      }
    }
  }

  // Initialize cleanup when store is first used
  private cleanupInitialized = false;
  
  private initializeCleanup(): void {
    if (!this.cleanupInitialized) {
      this.cleanupInitialized = true;
      // Clean up expired sessions every hour
      setInterval(() => this.cleanupExpiredSessions(), 60 * 60 * 1000);
      // Run initial cleanup after 5 seconds
      setTimeout(() => this.cleanupExpiredSessions(), 5000);
    }
  }
}