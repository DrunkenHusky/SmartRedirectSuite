
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
