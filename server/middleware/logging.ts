/**
 * Enterprise-grade logging middleware
 * Structured logging with performance metrics and request tracking
 */

import type { Request, Response, NextFunction } from 'express';
import { randomUUID } from 'crypto';

interface LogContext {
  requestId: string;
  method: string;
  url: string;
  ip: string;
  userAgent?: string;
  startTime: number;
  userId?: string;
}

/**
 * Request logging middleware with performance tracking
 */
export function requestLogger(req: Request, res: Response, next: NextFunction): void {
  const requestId = randomUUID();
  const startTime = Date.now();

  // Attach request ID to response locals for error handling
  res.locals.requestId = requestId;

  const logContext: LogContext = {
    requestId,
    method: req.method,
    url: req.url,
    ip: req.ip || req.connection.remoteAddress || 'unknown',
    userAgent: req.get('User-Agent'),
    startTime,
  };

  // Log request start
  console.log('Request started:', {
    requestId,
    method: req.method,
    url: req.url,
    ip: logContext.ip,
    timestamp: new Date().toISOString(),
  });

  // Intercept response to log completion
  const originalSend = res.send;
  res.send = function(body: any) {
    const duration = Date.now() - startTime;
    const statusCode = res.statusCode;

    // Log request completion
    console.log('Request completed:', {
      requestId,
      method: req.method,
      url: req.url,
      statusCode,
      duration: `${duration}ms`,
      contentLength: res.get('Content-Length') || 0,
      timestamp: new Date().toISOString(),
    });

    // Track performance metrics
    if (duration > 1000) {
      console.warn('Slow request detected:', {
        requestId,
        method: req.method,
        url: req.url,
        duration: `${duration}ms`,
      });
    }

    return originalSend.call(this, body);
  };

  next();
}

/**
 * Security logging for authentication events
 */
export function logSecurityEvent(
  event: 'login_attempt' | 'login_success' | 'login_failure' | 'logout' | 'password_change',
  details: {
    userId?: string;
    ip?: string;
    userAgent?: string;
    success?: boolean;
    reason?: string;
  }
): void {
  console.log('Security event:', {
    event,
    ...details,
    timestamp: new Date().toISOString(),
    severity: event.includes('failure') ? 'warning' : 'info',
  });
}

/**
 * Performance monitoring logger
 */
export class PerformanceMonitor {
  private static instance: PerformanceMonitor;
  private metrics: Map<string, number[]> = new Map();

  static getInstance(): PerformanceMonitor {
    if (!PerformanceMonitor.instance) {
      PerformanceMonitor.instance = new PerformanceMonitor();
    }
    return PerformanceMonitor.instance;
  }

  recordMetric(name: string, value: number): void {
    if (!this.metrics.has(name)) {
      this.metrics.set(name, []);
    }
    const values = this.metrics.get(name)!;
    values.push(value);

    // Keep only last 1000 values
    if (values.length > 1000) {
      values.shift();
    }
  }

  getMetrics(name: string): {
    count: number;
    average: number;
    min: number;
    max: number;
    p95: number;
  } | null {
    const values = this.metrics.get(name);
    if (!values || values.length === 0) return null;

    const sorted = [...values].sort((a, b) => a - b);
    const count = values.length;
    const sum = values.reduce((a, b) => a + b, 0);
    const average = sum / count;
    const min = sorted[0];
    const max = sorted[count - 1];
    const p95Index = Math.floor(count * 0.95);
    const p95 = sorted[p95Index];

    return { count, average, min, max, p95 };
  }

  getAllMetrics(): Record<string, ReturnType<PerformanceMonitor['getMetrics']>> {
    const result: Record<string, ReturnType<PerformanceMonitor['getMetrics']>> = {};
    for (const [name] of this.metrics) {
      result[name] = this.getMetrics(name);
    }
    return result;
  }
}
