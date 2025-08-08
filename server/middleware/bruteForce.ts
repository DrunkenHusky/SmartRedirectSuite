import type { Request, Response, NextFunction } from 'express';
import { SECURITY_CONFIG } from '../../shared/constants';

interface AttemptData {
  count: number;
  blockedUntil: number;
}

/**
 * Simple IP-based login attempt tracker.
 * Uses in-memory store by default; can be replaced with Redis if needed.
 */
class LoginAttemptTracker {
  private attempts = new Map<string, AttemptData>();
  private readonly maxAttempts: number;
  private readonly blockDuration: number;

  constructor(maxAttempts: number, blockDuration: number) {
    this.maxAttempts = maxAttempts;
    this.blockDuration = blockDuration;

    // Cleanup expired entries periodically
    setInterval(() => this.cleanup(), 60 * 1000);
  }

  private cleanup(): void {
    const now = Date.now();
    for (const [ip, data] of this.attempts.entries()) {
      if (data.blockedUntil < now && data.count === 0) {
        this.attempts.delete(ip);
      }
    }
  }

  isBlocked(ip: string): boolean {
    const data = this.attempts.get(ip);
    return data ? data.blockedUntil > Date.now() : false;
  }

  recordFailure(ip: string): void {
    const now = Date.now();
    const data = this.attempts.get(ip) || { count: 0, blockedUntil: 0 };

    if (data.blockedUntil > now) {
      // still blocked, nothing to do
      this.attempts.set(ip, data);
      return;
    }

    data.count += 1;
    if (data.count >= this.maxAttempts) {
      data.blockedUntil = now + this.blockDuration;
      data.count = 0; // reset count to save memory
    }

    this.attempts.set(ip, data);
  }

  reset(ip: string): void {
    this.attempts.delete(ip);
  }
}

export const loginAttemptTracker = new LoginAttemptTracker(
  SECURITY_CONFIG.LOGIN_MAX_ATTEMPTS,
  SECURITY_CONFIG.LOGIN_BLOCK_DURATION_MS
);

export function bruteForceMiddleware(req: Request, res: Response, next: NextFunction): void {
  const ip = req.ip || req.connection.remoteAddress || 'unknown';
  if (loginAttemptTracker.isBlocked(ip)) {
    return res.status(429).json({ error: 'Zu viele fehlgeschlagene Login-Versuche. Bitte später erneut versuchen.' });
  }
  next();
}
