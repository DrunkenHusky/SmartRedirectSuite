import { Store, SessionData } from 'express-session';
import fs from 'fs/promises';
import path from 'path';

interface StoredSession {
  data: SessionData;
  expires?: Date | undefined;
}

const memoryCache = new Map<string, StoredSession>();
let persistTimer: NodeJS.Timeout | null = null;

export class FileSessionStore extends Store {
  private sessionsDir: string;

  constructor(options: { dir?: string } = {}) {
    super();
    this.sessionsDir = options.dir || path.join(process.cwd(), 'data', 'sessions');
    this.loadFromDisk().then(() => {
      this.initializeCleanup();
    })
  }

  private async loadFromDisk(): Promise<void> {
    try {
      await fs.mkdir(this.sessionsDir, { recursive: true });
      const files = await fs.readdir(this.sessionsDir);

      for (const file of files) {
        if (!file.endsWith('.json')) continue;

        try {
          const raw = await fs.readFile(path.join(this.sessionsDir, file), 'utf8');
          const stored: StoredSession = JSON.parse(raw);
          const sid = file.replace('.json', '');

          if (stored.expires && new Date() > new Date(stored.expires)) {
            continue
          };

          memoryCache.set(sid, stored);
        } catch {
          // Skip corrupted files silently
        }
      }

      console.log(`Session store: loaded ${memoryCache.size} session(s) from disk.`);
    } catch (error) {
      console.error('Session store: failed to load from disk:', error);
    }
  }

  private schedulePersist(): void {
    if (persistTimer) return;

    persistTimer = setTimeout(async () => {
      persistTimer = null;

      try {
        await fs.mkdir(this.sessionsDir, { recursive: true });

        const writes: Promise<void>[] = [];

        for (const [sid, stored] of memoryCache.entries()) {
          const filePath = path.join(this.sessionsDir, `${sid}.json`);
          writes.push(fs.writeFile(filePath, JSON.stringify(stored)));
        }

        await Promise.all(writes);
      } catch (error) {
        console.error('Session store: failed to persist to disk:', error);
      }
    }, 2000);
  }

  override get(sid: string, callback: (err: any, session?: SessionData | null) => void): void {
    const stored = memoryCache.get(sid);

    if (!stored) {
      callback(null, null);
      return;
    }

    if (stored.expires && new Date() > new Date(stored.expires)) {
      memoryCache.delete(sid);
      this.schedulePersist();
      callback(null, null);
      return;
    }

    callback(null, stored.data);
  }

  override set(sid: string, session: SessionData, callback?: (err?: any) => void): void {
    const stored: StoredSession = {
      data: session,
      expires: session.cookie?.expires ?? undefined
    };

    memoryCache.set(sid, stored);
    this.schedulePersist();
    callback?.();
  }

  override destroy(sid: string, callback?: (err?: any) => void): void {
    memoryCache.delete(sid);
    this.schedulePersist();

    const filePath = path.join(this.sessionsDir, `${sid}.json`);
    fs.unlink(filePath).catch(() => {});

    callback?.();
  }

  override all(callback: (err: any, obj?: { [sid: string]: SessionData } | SessionData[] | null) => void): void {
    const sessions: SessionData[] = [];

    for (const stored of memoryCache.values()) {
      if (!stored.expires || new Date() <= new Date(stored.expires)) {
        sessions.push(stored.data);
      }
    }

    callback(null, sessions);
  }

  override length(callback: (err: any, length?: number) => void): void {
    callback(null, memoryCache.size);
  }

  override clear(callback?: (err?: any) => void): void {
    memoryCache.clear();
    this.schedulePersist();
    callback?.();
  }

  override touch(sid: string, session: SessionData, callback?: (err?: any) => void): void {
    const existing = memoryCache.get(sid);

    if (existing) {
      existing.expires = session.cookie?.expires ?? undefined;
      existing.data = session;
    }

    callback?.();
  }

  // Cleanup expired sessions periodically
  private cleanupExpiredSessions(): void {
    const now = new Date();
    let removed = 0;

    for (const [sid, stored] of memoryCache.entries()) {
      if (stored.expires && now > new Date(stored.expires)) {
        memoryCache.delete(sid);
        fs.unlink(path.join(this.sessionsDir, `${sid}.json`)).catch(() => {});
        removed++;
      }
    }

    if (removed > 0) {
      console.log(`Session store: cleaned up ${removed} expired session(s).`);
    }
  }

  // Initialize cleanup when store is first used
  private cleanupInitialized = false;
  
  private initializeCleanup(): void {
    if (!this.cleanupInitialized) {
      this.cleanupInitialized = true;
      setInterval(() => this.cleanupExpiredSessions(), 60 * 60 * 1000);
    }
  }
}