import type { Request, Response, NextFunction } from "express";
import fs from "fs/promises";
import path from "path";
import { initDb, LoginAttemptModel } from "../db";

// Configurable settings with defaults
export const LOGIN_MAX_ATTEMPTS = parseInt(process.env.LOGIN_MAX_ATTEMPTS || "5", 10);
export const LOGIN_BLOCK_DURATION_MS = parseInt(
  process.env.LOGIN_BLOCK_DURATION_MS || String(24 * 60 * 60 * 1000),
  10
);

const loginAttemptsStorePath = path.join(process.cwd(), "data", "login-attempts.json");

export interface AttemptInfo {
  attempts: number;
  blockedUntil?: number;
}

export interface BlockedIpEntry extends AttemptInfo {
  ip: string;
}

let migrationPromise: Promise<void> | null = null;

function normalizeAttemptInfo(value: unknown): AttemptInfo | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const rawEntry = value as Record<string, unknown>;
  const attempts = Number(rawEntry.attempts ?? 0);
  const blockedUntil = rawEntry.blockedUntil === undefined ? undefined : Number(rawEntry.blockedUntil);

  if (!Number.isFinite(attempts) || attempts < 0) {
    return null;
  }

  return {
    attempts,
    ...(Number.isFinite(blockedUntil) && blockedUntil > 0 ? { blockedUntil } : {}),
  };
}

function toAttemptInfo(row: { getDataValue(key: string): unknown }): AttemptInfo {
  const blockedUntil = row.getDataValue("blockedUntil") as number | null | undefined;

  return {
    attempts: Number(row.getDataValue("attempts") ?? 0),
    ...(blockedUntil ? { blockedUntil: Number(blockedUntil) } : {}),
  };
}

async function migrateLoginAttemptsJsonToDb(): Promise<void> {
  try {
    const data = await fs.readFile(loginAttemptsStorePath, "utf8");
    const parsed = JSON.parse(data) as Record<string, unknown>;

    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      for (const [ip, rawEntry] of Object.entries(parsed)) {
        const normalizedEntry = normalizeAttemptInfo(rawEntry);
        if (!ip || !normalizedEntry) {
          continue;
        }

        const existing = await LoginAttemptModel.findByPk(ip);
        if (!existing) {
          await LoginAttemptModel.create({ ip, ...normalizedEntry });
        }
      }
    }

    await fs.rename(loginAttemptsStorePath, `${loginAttemptsStorePath}.bak`);
  } catch (error: unknown) {
    if (!(error instanceof Error && "code" in error && error.code === "ENOENT")) {
      console.error("Failed to migrate login-attempts.json to database", error);
    }
  }
}

async function ensureLoginAttemptStoreReady(): Promise<void> {
  if (!migrationPromise) {
    migrationPromise = (async () => {
      await initDb();
      await migrateLoginAttemptsJsonToDb();
    })();
  }

  await migrationPromise;
}

async function findAttempt(ip: string): Promise<AttemptInfo | undefined> {
  await ensureLoginAttemptStoreReady();
  const row = await LoginAttemptModel.findByPk(ip);
  return row ? toAttemptInfo(row) : undefined;
}

async function upsertAttempt(ip: string, entry: AttemptInfo): Promise<void> {
  await ensureLoginAttemptStoreReady();
  await LoginAttemptModel.upsert({
    ip,
    attempts: entry.attempts,
    blockedUntil: entry.blockedUntil ?? null,
  });
}

async function deleteAttempt(ip: string): Promise<void> {
  await ensureLoginAttemptStoreReady();
  await LoginAttemptModel.destroy({ where: { ip } });
}

export async function bruteForceProtection(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const ip = req.ip || req.connection.remoteAddress || "";
  const entry = await findAttempt(ip);
  const now = Date.now();

  if (entry?.blockedUntil && entry.blockedUntil > now) {
    res.status(429).json({ error: "Too many failed login attempts. Try again later." });
    return;
  }

  // Cleanup expired blocks so successful future logins start from a clean slate.
  if (entry?.blockedUntil && entry.blockedUntil <= now) {
    await deleteAttempt(ip);
  }

  next();
}

export async function recordLoginFailure(ip: string): Promise<void> {
  const entry = (await findAttempt(ip)) || { attempts: 0 };
  const updatedEntry: AttemptInfo = {
    ...entry,
    attempts: entry.attempts + 1,
  };

  if (updatedEntry.attempts >= LOGIN_MAX_ATTEMPTS) {
    updatedEntry.blockedUntil = Date.now() + LOGIN_BLOCK_DURATION_MS;
  }

  await upsertAttempt(ip, updatedEntry);
}

export async function resetLoginAttempts(ip: string): Promise<void> {
  await deleteAttempt(ip);
}

export async function resetAllLoginAttempts(): Promise<void> {
  await ensureLoginAttemptStoreReady();
  await LoginAttemptModel.destroy({ where: {} });
}

export async function getBlockedIps(): Promise<BlockedIpEntry[]> {
  await ensureLoginAttemptStoreReady();
  const now = Date.now();
  const rows = await LoginAttemptModel.findAll();

  const blockedIps: BlockedIpEntry[] = [];
  for (const row of rows) {
    const ip = row.getDataValue("ip") as string;
    const entry = toAttemptInfo(row);

    if (entry.blockedUntil && entry.blockedUntil > now) {
      blockedIps.push({ ip, ...entry });
    }
  }

  return blockedIps;
}

export async function blockIp(ip: string): Promise<void> {
  const entry = (await findAttempt(ip)) || { attempts: 0 };
  await upsertAttempt(ip, {
    attempts: entry.attempts,
    blockedUntil: Date.now() + LOGIN_BLOCK_DURATION_MS,
  });
}
