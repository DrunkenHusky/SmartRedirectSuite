
import type { Request, Response, NextFunction } from 'express';

class RateLimiter {
  private requests: Map<string, { count: number; resetTime: number }> = new Map();
  private readonly maxRequests: number;
  private readonly windowMs: number;

  constructor(maxRequests = 100, windowMs = 15 * 60 * 1000) {
    this.maxRequests = maxRequests;
    this.windowMs = windowMs;

    // Clean up expired entries every minute
    setInterval(() => this.cleanup(), 60000).unref();
  }

  private cleanup(): void {
    const now = Date.now();
    for (const [key, data] of this.requests.entries()) {
      if (now > data.resetTime) {
        this.requests.delete(key);
      }
    }
  }

  isAllowed(identifier: string): { allowed: boolean; limit: number; remaining: number; resetTime: number } {
    const now = Date.now();
    const data = this.requests.get(identifier);

    if (!data || now > data.resetTime) {
      // New window or expired
      this.requests.set(identifier, {
        count: 1,
        resetTime: now + this.windowMs,
      });
      return {
        allowed: true,
        limit: this.maxRequests,
        remaining: this.maxRequests - 1,
        resetTime: now + this.windowMs,
      };
    }

    data.count++;
    const allowed = data.count <= this.maxRequests;
    
    return {
      allowed,
      limit: this.maxRequests,
      remaining: Math.max(0, this.maxRequests - data.count),
      resetTime: data.resetTime,
    };
  }
}

// Separate limiters for general API and Admin routes
const globalRateLimiter = new RateLimiter(300, 1 * 60 * 1000); // 300 per minute globally
const adminRateLimiter = new RateLimiter(60, 1 * 60 * 1000); // 60 per minute for admin actions

export function rateLimitMiddleware(req: Request, res: Response, next: NextFunction): void {
  // Skip for internal/localhost if needed, or keeping it strict
  const identifier = req.ip || req.connection.remoteAddress || 'unknown';
  const result = globalRateLimiter.isAllowed(identifier);

  res.set({
    'X-RateLimit-Limit': result.limit.toString(),
    'X-RateLimit-Remaining': result.remaining.toString(),
    'X-RateLimit-Reset': new Date(result.resetTime).toISOString(),
  });

  if (!result.allowed) {
    res.status(429).json({
      error: 'Too many requests',
      retryAfter: Math.ceil((result.resetTime - Date.now()) / 1000),
    });
    return;
  }
  next();
}

/**
 * CSRF Protection Middleware
 * Verifies that state-changing requests originate from the same origin.
 * This is a mitigation for CSRF attacks in cookie-authenticated APIs.
 */
export function csrfCheck(req: Request, res: Response, next: NextFunction): void {
  // Skip check for safe methods
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
    return next();
  }

  const origin = req.headers.origin;
  const referer = req.headers.referer;
  const host = req.get('host');

  // Logic:
  // 1. If Origin is present, it must match the host
  // 2. If Origin is missing but Referer is present, it must match the host
  // 3. If both are missing, block the request (unsafe for state changes)

  if (origin) {
    try {
      const originUrl = new URL(origin);
      const originHostname = originUrl.hostname;
      const requestHostname = host?.split(':')[0]; // Host header might have port

      if (originHostname !== requestHostname) {
        res.status(403).json({ error: 'CSRF Check Failed: Origin mismatch' });
        return;
      }
    } catch (e) {
      // If Origin is 'null' or invalid URL, block it for safety
      res.status(403).json({ error: 'CSRF Check Failed: Invalid Origin' });
      return;
    }
  } else if (referer) {
    // referer is a full URL
    try {
      const refererUrl = new URL(referer);
      const refererHost = refererUrl.hostname; // .hostname does not include port
      const requestHost = host?.split(':')[0]; // Strip port

      if (refererHost !== requestHost) {
        res.status(403).json({ error: 'CSRF Check Failed: Referer mismatch' });
        return;
      }
    } catch (e) {
      res.status(403).json({ error: 'CSRF Check Failed: Invalid referer' });
      return;
    }
  } else {
    // Neither header present - suspicious for a browser request
    // Allow non-browser agents (like curl) if they don't send Origin/Referer?
    // BUT this middleware is for admin routes which are session-based.
    // So blocking is safer.
    res.status(403).json({ error: 'CSRF Check Failed: Missing Origin/Referer' });
    return;
  }

  next();
}

export function adminRateLimitMiddleware(req: Request, res: Response, next: NextFunction): void {
  const identifier = req.ip || req.connection.remoteAddress || 'unknown';
  // Use session ID if available for more granular control, otherwise IP
  const key = req.session?.id ? `session:${req.session.id}` : identifier;

  const result = adminRateLimiter.isAllowed(key);

  if (!result.allowed) {
    res.status(429).json({
      error: 'Too many admin requests',
      retryAfter: Math.ceil((result.resetTime - Date.now()) / 1000),
    });
    return;
  }
  next();
}
