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

async function readStore(): Promise<Record<string, AttemptInfo>> {
  try {
    const data = await fs.readFile(storePath, "utf8");
    return JSON.parse(data) as Record<string, AttemptInfo>;
  } catch {
    return {};
  }
}

async function writeStore(store: Record<string, AttemptInfo>): Promise<void> {
  await fs.mkdir(path.dirname(storePath), { recursive: true });
  await fs.writeFile(storePath, JSON.stringify(store));
}

export async function bruteForceProtection(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const ip = req.ip || req.connection.remoteAddress || "";
  const store = await readStore();
  const entry = store[ip];
  const now = Date.now();

  if (entry?.blockedUntil && entry.blockedUntil > now) {
    res.status(429).json({ error: "Too many failed login attempts. Try again later." });
    return;
  }

  // Cleanup expired blocks
  if (entry?.blockedUntil && entry.blockedUntil <= now) {
    delete store[ip];
    await writeStore(store);
  }

  next();
}

export async function recordLoginFailure(ip: string): Promise<void> {
  const store = await readStore();
  const entry = store[ip] || { attempts: 0 };
  entry.attempts += 1;

  if (entry.attempts >= LOGIN_MAX_ATTEMPTS) {
    entry.blockedUntil = Date.now() + LOGIN_BLOCK_DURATION_MS;
  }

  store[ip] = entry;
  await writeStore(store);
}

export async function resetLoginAttempts(ip: string): Promise<void> {
  const store = await readStore();
  if (store[ip]) {
    delete store[ip];
    await writeStore(store);
  }
}
