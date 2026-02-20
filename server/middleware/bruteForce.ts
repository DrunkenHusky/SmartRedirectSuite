import type { Request, Response, NextFunction } from "express";
import fs from "fs/promises";
import path from "path";

// Configurable settings with defaults
export const LOGIN_MAX_ATTEMPTS = parseInt(process.env.LOGIN_MAX_ATTEMPTS || "5", 10);
export const LOGIN_BLOCK_DURATION_MS = parseInt(
  process.env.LOGIN_BLOCK_DURATION_MS || String(24 * 60 * 60 * 1000),
  10
);

const storePath = path.join(process.cwd(), "data", "login-attempts.json");

interface AttemptInfo {
  attempts: number;
  blockedUntil?: number;
}

const memoryStore = new Map<string, AttemptInfo>();
let persistTimer: NodeJS.Timeout | null = null;

async function loadStoreFromDisk(): Promise<void> {
  try {
    const data = await fs.readFile(storePath, "utf8");
    const parsed = JSON.parse(data) as Record<string, AttemptInfo>;

    for (const [ip, info] of Object.entries(parsed)) {
      memoryStore.set(ip, info);
    }
  } 
  catch {

  }
}

function schedulePersist(): void {
  if (persistTimer) {
    return;
  }

  persistTimer = setTimeout(async () => {
    persistTimer = null;

    try {
      await fs.mkdir(path.dirname(storePath), { recursive: true });

      const record: Record<string, AttemptInfo> = {};

      for (const [ip, info] of memoryStore.entries()) {
        record[ip] = info;
      }

      await fs.writeFile(storePath, JSON.stringify(record));
    } 
    catch (error) {
      console.error("Failed to persist login-attempts store:", error);
    }
  }, 2000);
}

loadStoreFromDisk().catch((error) => {
  console.error("Failed to load login-attempts store on startup:", error);
});

export async function bruteForceProtection(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const ip = req.ip || req.connection.remoteAddress || "";
  const entry = memoryStore.get(ip);
  const now = Date.now();

  if (entry?.blockedUntil && entry.blockedUntil > now) {
    res.status(429).json({ error: "Too many failed login attempts. Try again later." });
    return;
  }

  // Cleanup expired blocks
  if (entry?.blockedUntil && entry.blockedUntil <= now) {
    memoryStore.delete(ip);
    schedulePersist();
  }

  next();
}

export async function recordLoginFailure(ip: string): Promise<void> {
  const entry = memoryStore.get(ip) || { attempts: 0 };
  entry.attempts += 1;

  if (entry.attempts >= LOGIN_MAX_ATTEMPTS) {
    entry.blockedUntil = Date.now() + LOGIN_BLOCK_DURATION_MS;
  }

  memoryStore.set(ip, entry)
  schedulePersist();
}

export async function resetLoginAttempts(ip: string): Promise<void> {
  if(memoryStore.has(ip)) {
    memoryStore.delete(ip);
    schedulePersist();
  }
}

export async function resetAllLoginAttempts(): Promise<void> {
  memoryStore.clear();
  schedulePersist();
}

export async function getBlockedIps(): Promise<Array<{ ip: string; attempts: number; blockedUntil?: number }>> {
  const now = Date.now();
  const result: Array<{ ip: string; attempts: number; blockedUntil?: number }> = [];

  for (const [ip, entry] of memoryStore.entries()) {
    if (entry.blockedUntil && entry.blockedUntil > now) {
      result.push({ ip, attempts: entry.attempts, blockedUntil: entry.blockedUntil });
    }
  }

  return result;
}

export async function blockIp(ip: string): Promise<void> {
  const entry = memoryStore.get(ip) || { attempts: 0 };
  entry.blockedUntil = Date.now() + LOGIN_BLOCK_DURATION_MS;
  memoryStore.set(ip, entry);
  schedulePersist();
}
