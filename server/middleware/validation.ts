/**
 * Enterprise-grade validation middleware
 * Comprehensive request validation with detailed error reporting
 */

import type { Request, Response, NextFunction } from 'express';
import { z, ZodSchema, ZodError } from 'zod';
import { createError } from './errorHandler';

/**
 * Validation middleware factory
 */
export function validateRequest<T extends ZodSchema>(schema: {
  body?: T;
  query?: T;
  params?: T;
}) {
  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      // Validate request body
      if (schema.body && req.body) {
        req.body = schema.body.parse(req.body);
      }

      // Validate query parameters
      if (schema.query && req.query) {
        req.query = schema.query.parse(req.query);
      }

      // Validate route parameters
      if (schema.params && req.params) {
        req.params = schema.params.parse(req.params);
      }

      next();
    } catch (error) {
      if (error instanceof ZodError) {
        const validationErrors = error.errors.map(err => ({
          field: err.path.join('.'),
          message: err.message,
          code: err.code,
          received: err.input,
        }));

        return res.status(400).json({
          success: false,
          error: 'Validation failed',
          code: 'VALIDATION_ERROR',
          details: validationErrors,
          timestamp: new Date().toISOString(),
        });
      }

      next(error);
    }
  };
}

/**
 * Common validation schemas
 */
export const commonSchemas = {
  // Pagination parameters
  pagination: z.object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
    sort: z.string().optional(),
    order: z.enum(['asc', 'desc']).default('desc'),
  }),

  // ID parameter
  id: z.object({
    id: z.string().uuid('Invalid ID format'),
  }),

  // Date range query
  dateRange: z.object({
    startDate: z.string().datetime().optional(),
    endDate: z.string().datetime().optional(),
    timeRange: z.enum(['24h', '7d', '30d', 'all']).optional(),
  }),

  // Search query
  search: z.object({
    q: z.string().min(1).max(100).optional(),
    fields: z.array(z.string()).optional(),
  }),

  // File upload metadata
  fileUpload: z.object({
    filename: z.string().min(1).max(255),
    mimetype: z.string().min(1),
    size: z.number().int().min(1).max(10 * 1024 * 1024), // 10MB max
  }),
};

/**
 * Content type validation
 */
export function validateContentType(allowedTypes: string[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const contentType = req.get('Content-Type');
    
    if (!contentType) {
      return res.status(400).json({
        success: false,
        error: 'Content-Type header is required',
        code: 'MISSING_CONTENT_TYPE',
        allowedTypes,
        timestamp: new Date().toISOString(),
      });
    }

    const baseType = contentType.split(';')[0].trim();
    
    if (!allowedTypes.includes(baseType)) {
      return res.status(415).json({
        success: false,
        error: 'Unsupported media type',
        code: 'UNSUPPORTED_MEDIA_TYPE',
        received: baseType,
        allowedTypes,
        timestamp: new Date().toISOString(),
      });
    }

    next();
  };
}

/**
 * Custom validation for URL rules overlap
 */
export function validateUrlRuleOverlap(existingRules: Array<{ id: string; matcher: string }>) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const { matcher, id } = req.body;
    
    if (!matcher) {
      return next();
    }

    // Check for overlaps with existing rules
    const normalizedMatcher = matcher.toLowerCase().replace(/\/+$/, '');
    
    for (const rule of existingRules) {
      if (rule.id === id) continue; // Skip self when updating
      
      const existingMatcher = rule.matcher.toLowerCase().replace(/\/+$/, '');
      
      if (areMatchersOverlapping(normalizedMatcher, existingMatcher)) {
        return res.status(409).json({
          success: false,
          error: 'URL matcher conflicts with existing rule',
          code: 'MATCHER_CONFLICT',
          conflictingRule: {
            id: rule.id,
            matcher: rule.matcher,
          },
          timestamp: new Date().toISOString(),
        });
      }
    }

    next();
  };
}

/**
 * Helper function to check matcher overlap
 */
function areMatchersOverlapping(matcher1: string, matcher2: string): boolean {
  if (matcher1 === matcher2) return true;
  
  const segments1 = matcher1.split('/').filter(Boolean);
  const segments2 = matcher2.split('/').filter(Boolean);
  
  const minLength = Math.min(segments1.length, segments2.length);
  
  for (let i = 0; i < minLength; i++) {
    if (segments1[i] !== segments2[i]) return false;
  }
  
  return segments1.length !== segments2.length;
}

/**
 * File validation middleware
 */
export function validateFile(options: {
  maxSize?: number;
  allowedTypes?: string[];
  required?: boolean;
}) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const file = req.file;
    const { maxSize = 5 * 1024 * 1024, allowedTypes = [], required = false } = options;

    if (required && !file) {
      return res.status(400).json({
        success: false,
        error: 'File is required',
        code: 'FILE_REQUIRED',
        timestamp: new Date().toISOString(),
      });
    }

    if (!file) {
      return next();
    }

    // Check file size
    if (file.size > maxSize) {
      return res.status(413).json({
        success: false,
        error: 'File too large',
        code: 'FILE_TOO_LARGE',
        maxSize,
        receivedSize: file.size,
        timestamp: new Date().toISOString(),
      });
    }

    // Check file type
    if (allowedTypes.length > 0 && !allowedTypes.includes(file.mimetype)) {
      return res.status(415).json({
        success: false,
        error: 'Unsupported file type',
        code: 'UNSUPPORTED_FILE_TYPE',
        allowedTypes,
        receivedType: file.mimetype,
        timestamp: new Date().toISOString(),
      });
    }

    next();
  };
}

/**
 * Environment-specific validation
 */
export function validateEnvironment(allowedEnvironments: string[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const environment = process.env.NODE_ENV || 'development';
    
    if (!allowedEnvironments.includes(environment)) {
      return res.status(403).json({
        success: false,
        error: 'Operation not allowed in current environment',
        code: 'ENVIRONMENT_RESTRICTED',
        currentEnvironment: environment,
        allowedEnvironments,
        timestamp: new Date().toISOString(),
      });
    }

    next();
  };
}