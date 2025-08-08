/**
 * Enterprise-grade security middleware
 * Comprehensive security measures including rate limiting, CORS, and headers
 */

import type { Request, Response, NextFunction } from 'express';
import { logSecurityEvent } from './logging';

/**
 * Rate limiting with memory store (replace with Redis in production)
 */
class RateLimiter {
  private requests: Map<string, { count: number; resetTime: number }> = new Map();
  private readonly maxRequests: number;
  private readonly windowMs: number;

  constructor(maxRequests = 100, windowMs = 15 * 60 * 1000) {
    this.maxRequests = maxRequests;
    this.windowMs = windowMs;

    // Clean up expired entries every minute
    setInterval(() => this.cleanup(), 60000);
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

const globalRateLimiter = new RateLimiter();
const authRateLimiter = new RateLimiter(5, 15 * 60 * 1000); // 5 attempts per 15 minutes

/**
 * Global rate limiting middleware
 */
export function rateLimitMiddleware(req: Request, res: Response, next: NextFunction): void {
  const identifier = req.ip || req.connection.remoteAddress || 'unknown';
  const result = globalRateLimiter.isAllowed(identifier);

  // Set rate limit headers
  res.set({
    'X-RateLimit-Limit': result.limit.toString(),
    'X-RateLimit-Remaining': result.remaining.toString(),
    'X-RateLimit-Reset': new Date(result.resetTime).toISOString(),
  });

  if (!result.allowed) {
    console.warn('Rate limit exceeded:', {
      ip: identifier,
      path: req.path,
      method: req.method,
      timestamp: new Date().toISOString(),
    });

    return res.status(429).json({
      success: false,
      error: 'Too many requests',
      code: 'RATE_LIMIT_EXCEEDED',
      retryAfter: Math.ceil((result.resetTime - Date.now()) / 1000),
      timestamp: new Date().toISOString(),
    });
  }

  next();
}

/**
 * Authentication rate limiting
 */
export function authRateLimitMiddleware(req: Request, res: Response, next: NextFunction): void {
  const identifier = req.ip || req.connection.remoteAddress || 'unknown';
  const result = authRateLimiter.isAllowed(identifier);

  if (!result.allowed) {
    logSecurityEvent('login_attempt', {
      ip: identifier,
      success: false,
      reason: 'Rate limit exceeded',
    });

    return res.status(429).json({
      success: false,
      error: 'Too many authentication attempts',
      code: 'AUTH_RATE_LIMIT_EXCEEDED',
      retryAfter: Math.ceil((result.resetTime - Date.now()) / 1000),
      timestamp: new Date().toISOString(),
    });
  }

  next();
}

/**
 * Security headers middleware
 */
export function securityHeaders(req: Request, res: Response, next: NextFunction): void {
  // Prevent XSS attacks
  res.set('X-XSS-Protection', '1; mode=block');
  
  // Prevent MIME type sniffing
  res.set('X-Content-Type-Options', 'nosniff');
  
  // Prevent clickjacking
  res.set('X-Frame-Options', 'DENY');
  
  // Force HTTPS in production
  if (process.env.NODE_ENV === 'production') {
    res.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  }
  
  // Content Security Policy
  res.set('Content-Security-Policy', [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: https:",
    "font-src 'self'",
    "connect-src 'self'",
    "frame-ancestors 'none'",
  ].join('; '));

  // Remove server information
  res.removeHeader('X-Powered-By');

  next();
}

/**
 * CORS configuration with security considerations
 */
export function corsMiddleware(req: Request, res: Response, next: NextFunction): void {
  const origin = req.get('Origin');
  const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:5000'];

  // Check if origin is allowed
  if (origin && allowedOrigins.includes(origin)) {
    res.set('Access-Control-Allow-Origin', origin);
  } else if (!origin) {
    // Allow same-origin requests
    res.set('Access-Control-Allow-Origin', '*');
  }

  res.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
  res.set('Access-Control-Allow-Credentials', 'true');
  res.set('Access-Control-Max-Age', '86400'); // 24 hours

  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  next();
}

/**
 * Input sanitization middleware
 */
export function sanitizeInput(req: Request, res: Response, next: NextFunction): void {
  function sanitizeObject(obj: any): any {
    if (typeof obj === 'string') {
      // Basic XSS prevention
      return obj
        .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
        .replace(/javascript:/gi, '')
        .replace(/on\w+\s*=/gi, '');
    }
    
    if (Array.isArray(obj)) {
      return obj.map(sanitizeObject);
    }
    
    if (obj && typeof obj === 'object') {
      const sanitized: any = {};
      for (const [key, value] of Object.entries(obj)) {
        sanitized[key] = sanitizeObject(value);
      }
      return sanitized;
    }
    
    return obj;
  }

  if (req.body) {
    req.body = sanitizeObject(req.body);
  }

  if (req.query) {
    req.query = sanitizeObject(req.query);
  }

  next();
}

/**
 * Request size limiting
 */
export function requestSizeLimit(maxSizeBytes = 10 * 1024 * 1024) { // 10MB default
  return (req: Request, res: Response, next: NextFunction): void => {
    const contentLength = req.get('Content-Length');
    
    if (contentLength && parseInt(contentLength) > maxSizeBytes) {
      return res.status(413).json({
        success: false,
        error: 'Request too large',
        code: 'REQUEST_TOO_LARGE',
        maxSize: maxSizeBytes,
        timestamp: new Date().toISOString(),
      });
    }

    next();
  };
}