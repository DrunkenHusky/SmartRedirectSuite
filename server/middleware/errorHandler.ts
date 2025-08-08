/**
 * Enterprise-grade error handling middleware
 * Comprehensive error processing with logging and monitoring
 */

import type { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';

export interface ErrorWithCode extends Error {
  code?: string;
  statusCode?: number;
  details?: unknown;
}

/**
 * Central error handler with structured logging
 */
export function errorHandler(
  error: ErrorWithCode,
  req: Request,
  res: Response,
  next: NextFunction
): void {
  // Log error with context
  const errorContext = {
    method: req.method,
    url: req.url,
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    timestamp: new Date().toISOString(),
    requestId: res.locals.requestId,
  };

  console.error('Request error:', {
    message: error.message,
    stack: error.stack,
    context: errorContext,
  });

  // Handle different error types
  if (error instanceof ZodError) {
    return res.status(400).json({
      success: false,
      error: 'Validation failed',
      code: 'VALIDATION_ERROR',
      details: error.errors.map(err => ({
        field: err.path.join('.'),
        message: err.message,
        code: err.code,
      })),
      timestamp: new Date().toISOString(),
    });
  }

  // Handle known application errors
  const statusCode = error.statusCode || 500;
  const isProduction = process.env.NODE_ENV === 'production';

  res.status(statusCode).json({
    success: false,
    error: error.message || 'Internal server error',
    code: error.code || 'INTERNAL_ERROR',
    ...(isProduction ? {} : { stack: error.stack }),
    timestamp: new Date().toISOString(),
    requestId: res.locals.requestId,
  });
}

/**
 * 404 handler for unmatched routes
 */
export function notFoundHandler(req: Request, res: Response): void {
  res.status(404).json({
    success: false,
    error: 'Resource not found',
    code: 'NOT_FOUND',
    path: req.path,
    method: req.method,
    timestamp: new Date().toISOString(),
  });
}

/**
 * Async wrapper to catch promise rejections
 */
export function asyncHandler<T extends Request, U extends Response>(
  fn: (req: T, res: U, next: NextFunction) => Promise<void>
) {
  return (req: T, res: U, next: NextFunction): void => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

/**
 * Create application-specific error
 */
export function createError(
  message: string,
  statusCode = 500,
  code?: string,
  details?: unknown
): ErrorWithCode {
  const error = new Error(message) as ErrorWithCode;
  error.statusCode = statusCode;
  error.code = code;
  error.details = details;
  return error;
}

/**
 * Validation error helper
 */
export function createValidationError(field: string, message: string): ErrorWithCode {
  return createError(`Validation failed for ${field}: ${message}`, 400, 'VALIDATION_ERROR', {
    field,
    message,
  });
}