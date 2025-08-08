/**
 * Enterprise-grade application constants
 * Centralized configuration for better maintainability
 */

// Performance and limits
export const PERFORMANCE_LIMITS = {
  MAX_URL_RULES: 1000,
  MAX_TRACKING_ENTRIES: 100000,
  MAX_FILE_SIZE: 5 * 1024 * 1024, // 5MB
  CACHE_TTL: 5 * 60 * 1000, // 5 minutes
  SESSION_TIMEOUT: 7 * 24 * 60 * 60 * 1000, // 7 days
  RATE_LIMIT_WINDOW: 15 * 60 * 1000, // 15 minutes
  RATE_LIMIT_MAX_REQUESTS: 100,
} as const;

// Security configuration
export const SECURITY_CONFIG = {
  MIN_PASSWORD_LENGTH: 8,
  MAX_PASSWORD_LENGTH: 100,
  PASSWORD_REGEX: /^(?=.*[A-Za-z])(?=.*\d)/,
  BCRYPT_ROUNDS: 12,
  SESSION_SECRET_LENGTH: 64,
  CSRF_TOKEN_LENGTH: 32,
} as const;

// File handling
export const FILE_CONFIG = {
  ALLOWED_IMAGE_TYPES: ['image/png', 'image/jpeg', 'image/jpg', 'image/webp'],
  ALLOWED_IMPORT_TYPES: ['application/json', 'text/csv'],
  UPLOAD_TIMEOUT: 30000, // 30 seconds
  MAX_CONCURRENT_UPLOADS: 3,
} as const;

// API configuration
export const API_CONFIG = {
  DEFAULT_PAGE_SIZE: 20,
  MAX_PAGE_SIZE: 100,
  REQUEST_TIMEOUT: 30000,
  MAX_EXPORT_RECORDS: 50000,
} as const;

// Monitoring and logging
export const MONITORING_CONFIG = {
  LOG_RETENTION_DAYS: 30,
  METRICS_COLLECTION_INTERVAL: 60000, // 1 minute
  HEALTH_CHECK_INTERVAL: 30000, // 30 seconds
  ERROR_SAMPLE_RATE: 1.0, // 100% error tracking
} as const;

// Frontend performance
export const FRONTEND_CONFIG = {
  DEBOUNCE_DELAY: 300, // ms
  QUERY_STALE_TIME: 5 * 60 * 1000, // 5 minutes
  QUERY_CACHE_TIME: 10 * 60 * 1000, // 10 minutes
  VIRTUAL_LIST_OVERSCAN: 5,
  MAX_TOAST_COUNT: 3,
} as const;

// Environment-specific configurations
export const ENV_CONFIG = {
  DEVELOPMENT: {
    LOG_LEVEL: 'debug',
    ENABLE_DEVTOOLS: true,
    HOT_RELOAD: true,
  },
  PRODUCTION: {
    LOG_LEVEL: 'warn',
    ENABLE_DEVTOOLS: false,
    HOT_RELOAD: false,
    MINIFY: true,
    COMPRESSION: true,
  },
} as const;