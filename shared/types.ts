/**
 * Enterprise-grade TypeScript type definitions
 * Comprehensive type safety for the application
 */

import type { 
  UrlRule, 
  UrlTracking, 
  GeneralSettings, 
  InsertUrlRule, 
  InsertUrlTracking, 
  InsertGeneralSettings 
} from './schema';

// API Response types with consistent structure
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
  timestamp: string;
  requestId?: string;
}

export interface PaginatedResponse<T = unknown> {
  data: T[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrevious: boolean;
  };
}

// Error handling types
export interface ValidationError {
  field: string;
  message: string;
  code: string;
}

export interface ApiError {
  code: string;
  message: string;
  details?: ValidationError[];
  stack?: string;
  timestamp: string;
}

// Authentication and session types
export interface AdminUser {
  id: string;
  isAuthenticated: boolean;
  loginTime: string;
  lastActivity: string;
  permissions: string[];
}

export interface SessionData {
  userId: string;
  isAuthenticated: boolean;
  loginTime: string;
  lastActivity: string;
  ipAddress?: string;
  userAgent?: string;
}

// Statistics and analytics types
export interface UrlStatistics {
  total: number;
  today: number;
  week: number;
  month: number;
  topUrls: Array<{
    url: string;
    count: number;
    percentage: number;
  }>;
}

export interface SystemMetrics {
  uptime: number;
  memoryUsage: {
    used: number;
    total: number;
    percentage: number;
  };
  requestCount: {
    total: number;
    perSecond: number;
    perMinute: number;
  };
  errorRate: number;
  responseTime: {
    average: number;
    p95: number;
    p99: number;
  };
}

// File upload and object storage types
export interface UploadMetadata {
  originalName: string;
  mimeType: string;
  size: number;
  uploadedAt: string;
  uploadedBy?: string;
}

export interface ObjectStorageFile {
  id: string;
  url: string;
  path: string;
  metadata: UploadMetadata;
}

// Form and UI state types
export interface FormState<T = Record<string, unknown>> {
  data: T;
  errors: Record<string, string>;
  isSubmitting: boolean;
  isDirty: boolean;
  isValid: boolean;
}

export interface TableState {
  sort: {
    field: string;
    direction: 'asc' | 'desc';
  };
  filter: Record<string, unknown>;
  pagination: {
    page: number;
    pageSize: number;
  };
  selection: string[];
}

// Configuration types
export interface AppConfig {
  apiBaseUrl: string;
  version: string;
  environment: 'development' | 'production' | 'test';
  features: {
    analytics: boolean;
    objectStorage: boolean;
    adminPanel: boolean;
    exportImport: boolean;
  };
  security: {
    enforceHttps: boolean;
    enableCors: boolean;
    rateLimiting: boolean;
  };
}

// Utility types for better type safety
export type Prettify<T> = {
  [K in keyof T]: T[K];
} & {};

export type NonEmptyArray<T> = [T, ...T[]];

export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};

export type RequiredFields<T, K extends keyof T> = T & Required<Pick<T, K>>;

export type OptionalFields<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;

// Event and action types
export interface AuditLog {
  id: string;
  userId?: string;
  action: string;
  resource: string;
  resourceId?: string;
  details?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
  timestamp: string;
}

export interface NotificationEvent {
  id: string;
  type: 'info' | 'success' | 'warning' | 'error';
  title: string;
  message: string;
  duration?: number;
  actions?: Array<{
    label: string;
    action: () => void;
  }>;
  timestamp: string;
}

// Re-export main types for convenience
export type {
  UrlRule,
  UrlTracking,
  GeneralSettings,
  InsertUrlRule,
  InsertUrlTracking,
  InsertGeneralSettings,
};