import type { Request, Response, NextFunction } from "express";

interface RateLimitConfig {
  windowMs: number;
  max: number;
  message?: string;
  keyGenerator?: (req: Request) => string;
}

// Simple in-memory rate limiter
export function rateLimit(config: RateLimitConfig) {
  const hits = new Map<string, { count: number; resetTime: number }>();

  // Clean up expired entries periodically (every 10 minutes)
  setInterval(() => {
    const now = Date.now();
    for (const [key, record] of hits.entries()) {
      if (record.resetTime <= now) {
        hits.delete(key);
      }
    }
  }, 10 * 60 * 1000).unref(); // unref so it doesn't block process exit

  return (req: Request, res: Response, next: NextFunction) => {
    const key = config.keyGenerator ? config.keyGenerator(req) : (req.ip || req.connection.remoteAddress || "unknown");
    const now = Date.now();

    let record = hits.get(key);

    // If no record or expired, start new window
    if (!record || record.resetTime <= now) {
      record = { count: 0, resetTime: now + config.windowMs };
      hits.set(key, record);
    }

    record.count++;

    if (record.count > config.max) {
      res.status(429).json({ error: config.message || "Too many requests, please try again later." });
      return;
    }

    // Add rate limit headers
    res.setHeader('X-RateLimit-Limit', config.max);
    res.setHeader('X-RateLimit-Remaining', Math.max(0, config.max - record.count));
    res.setHeader('X-RateLimit-Reset', Math.ceil(record.resetTime / 1000));

    next();
  };
}

// Configured limiters
export const apiRateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 100, // 100 requests per minute
  message: "Too many API requests from this IP, please try again after a minute"
});

// Stricter limiter for tracking to prevent flooding
export const trackingRateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 300, // 300 requests per minute (higher than API because legitimate traffic can be high)
  message: "Too many tracking requests"
});
