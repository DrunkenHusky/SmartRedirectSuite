/**
 * Enterprise-grade utility functions
 * Comprehensive, well-tested utility functions for the application
 */

// Enterprise-grade utility functions - comprehensive and well-tested

/**
 * URL utilities with comprehensive validation and normalization
 */
export const urlUtils = {
  /**
   * Validates if a string is a valid URL
   */
  isValidUrl(url: string): boolean {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  },

  /**
   * Normalizes a URL for consistent comparison
   */
  normalizeUrl(url: string): string {
    try {
      const urlObj = new URL(url);
      // Remove trailing slash, normalize case
      const normalized = `${urlObj.protocol}//${urlObj.host.toLowerCase()}${urlObj.pathname.replace(/\/$/, "")}${urlObj.search}${urlObj.hash}`;
      return normalized;
    } catch {
      return url;
    }
  },

  /**
   * Extracts domain from URL
   */
  extractDomain(url: string): string | null {
    try {
      return new URL(url).hostname;
    } catch {
      return null;
    }
  },

  /**
   * Validates URL matcher pattern
   */
  isValidMatcher(matcher: string): boolean {
    const pattern = /^\/[a-zA-Z0-9\-._~:/?#[\]@!$&'()*+,;=%]*$/;
    return pattern.test(matcher);
  },

  /**
   * Checks if two URL matchers overlap. A matcher can appear at any position
   * within a path, therefore we test if their segment patterns can align at
   * any offset.
   */
  areMatchersOverlapping(matcher1: string, matcher2: string): boolean {
    const normalize = (m: string) =>
      m.toLowerCase().split("?")[0].replace(/\/+$/, "");
    const m1 = normalize(matcher1);
    const m2 = normalize(matcher2);

    const segs1 = m1.split("/").filter(Boolean);
    const segs2 = m2.split("/").filter(Boolean);
    const len1 = segs1.length;
    const len2 = segs2.length;

    const segmentsCompatible = (a: string, b: string) => {
      if (a === b) return true;
      if (a === "*" || a.startsWith(":")) return true;
      if (b === "*" || b.startsWith(":")) return true;
      return false;
    };

    for (let offset = -(len1 - 1); offset <= len2 - 1; offset++) {
      let overlap = false;
      let ok = true;
      for (let i = 0; i < len1; i++) {
        const j = i + offset;
        if (j < 0 || j >= len2) continue;
        overlap = true;
        if (!segmentsCompatible(segs1[i], segs2[j])) {
          ok = false;
          break;
        }
      }
      if (ok && overlap) return true;
    }
    return false;
  },
};

/**
 * String utilities with performance optimizations
 */
export const stringUtils = {
  /**
   * Safely truncates text with ellipsis
   */
  truncate(text: string, maxLength: number, suffix = "..."): string {
    if (text.length <= maxLength) return text;
    return text.slice(0, maxLength - suffix.length) + suffix;
  },

  /**
   * Escapes HTML to prevent XSS
   */
  escapeHtml(text: string): string {
    const div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
  },

  /**
   * Generates a random string with specified length
   */
  generateRandomString(length: number): string {
    const chars =
      "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
    let result = "";
    for (let i = 0; i < length; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  },

  /**
   * Validates if string is not empty after trimming
   */
  isNotEmpty(value: string): boolean {
    return value.trim().length > 0;
  },

  /**
   * Capitalizes first letter of each word
   */
  toTitleCase(text: string): string {
    return text.replace(
      /\w\S*/g,
      (txt) => txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase(),
    );
  },
};

/**
 * Date utilities with timezone handling
 */
export const dateUtils = {
  /**
   * Formats date for consistent display
   */
  formatDate(
    date: string | Date,
    format: "short" | "long" | "iso" = "short",
  ): string {
    const d = new Date(date);

    switch (format) {
      case "short":
        return d.toLocaleDateString();
      case "long":
        return d.toLocaleString();
      case "iso":
        return d.toISOString();
      default:
        return d.toString();
    }
  },

  /**
   * Gets relative time description
   */
  getRelativeTime(date: string | Date): string {
    const now = new Date();
    const target = new Date(date);
    const diffMs = now.getTime() - target.getTime();

    const seconds = Math.floor(diffMs / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) return `${days} day${days > 1 ? "s" : ""} ago`;
    if (hours > 0) return `${hours} hour${hours > 1 ? "s" : ""} ago`;
    if (minutes > 0) return `${minutes} minute${minutes > 1 ? "s" : ""} ago`;
    return "Just now";
  },

  /**
   * Checks if date is within specified range
   */
  isWithinRange(date: string | Date, range: "24h" | "7d" | "30d"): boolean {
    const now = new Date();
    const target = new Date(date);
    const diffMs = now.getTime() - target.getTime();

    switch (range) {
      case "24h":
        return diffMs <= 24 * 60 * 60 * 1000;
      case "7d":
        return diffMs <= 7 * 24 * 60 * 60 * 1000;
      case "30d":
        return diffMs <= 30 * 24 * 60 * 60 * 1000;
      default:
        return false;
    }
  },
};

/**
 * Performance utilities for optimization
 */
export const performanceUtils = {
  /**
   * Debounces function calls
   */
  debounce<T extends (...args: unknown[]) => unknown>(
    func: T,
    wait: number,
  ): (...args: Parameters<T>) => void {
    let timeout: NodeJS.Timeout;
    return (...args: Parameters<T>) => {
      clearTimeout(timeout);
      timeout = setTimeout(() => func(...args), wait);
    };
  },

  /**
   * Throttles function calls
   */
  throttle<T extends (...args: unknown[]) => unknown>(
    func: T,
    limit: number,
  ): (...args: Parameters<T>) => void {
    let inThrottle: boolean;
    return (...args: Parameters<T>) => {
      if (!inThrottle) {
        func(...args);
        inThrottle = true;
        setTimeout(() => (inThrottle = false), limit);
      }
    };
  },

  /**
   * Chunks array into smaller arrays
   */
  chunkArray<T>(array: T[], size: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size));
    }
    return chunks;
  },

  /**
   * Measures execution time of a function
   */
  measureTime<T>(func: () => T): { result: T; duration: number } {
    const start = performance.now();
    const result = func();
    const duration = performance.now() - start;
    return { result, duration };
  },
};

/**
 * Validation utilities with enterprise-grade checks
 */
export const validationUtils = {
  /**
   * Validates email format
   */
  isValidEmail(email: string): boolean {
    const pattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return pattern.test(email);
  },

  /**
   * Validates password strength
   */
  isStrongPassword(password: string): {
    isValid: boolean;
    score: number;
    feedback: string[];
  } {
    const feedback: string[] = [];
    let score = 0;

    if (password.length >= 8) score += 1;
    else feedback.push("Password must be at least 8 characters long");

    if (/[a-z]/.test(password)) score += 1;
    else feedback.push("Password must contain lowercase letters");

    if (/[A-Z]/.test(password)) score += 1;
    else feedback.push("Password must contain uppercase letters");

    if (/\d/.test(password)) score += 1;
    else feedback.push("Password must contain numbers");

    if (/[^a-zA-Z\d]/.test(password)) score += 1;
    else feedback.push("Password should contain special characters");

    return {
      isValid: score >= 3,
      score,
      feedback,
    };
  },

  /**
   * Validates file size and type
   */
  validateFile(
    file: File,
    allowedTypes: string[],
    maxSize: number,
  ): {
    isValid: boolean;
    errors: string[];
  } {
    const errors: string[] = [];

    if (!allowedTypes.includes(file.type)) {
      errors.push(`File type ${file.type} is not allowed`);
    }

    if (file.size > maxSize) {
      errors.push(`File size ${file.size} exceeds maximum of ${maxSize} bytes`);
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  },
};

/**
 * Error handling utilities
 */
export const errorUtils = {
  /**
   * Safely extracts error message
   */
  getErrorMessage(error: unknown): string {
    if (error instanceof Error) return error.message;
    if (typeof error === "string") return error;
    return "An unknown error occurred";
  },

  /**
   * Creates structured error response
   */
  createErrorResponse(message: string, code?: string, details?: unknown) {
    return {
      success: false,
      error: message,
      code,
      details,
      timestamp: new Date().toISOString(),
    };
  },

  /**
   * Logs error with context
   */
  logError(error: unknown, context?: Record<string, unknown>): void {
    const message = this.getErrorMessage(error);
    console.error("Error:", message, context);

    // In production, send to error tracking service
    if (process.env.NODE_ENV === "production") {
      // Example: Sentry.captureException(error, { extra: context });
    }
  },
};

/**
 * Data formatting utilities
 */
export const formatUtils = {
  /**
   * Formats file size in human-readable format
   */
  formatFileSize(bytes: number): string {
    const units = ["B", "KB", "MB", "GB", "TB"];
    let size = bytes;
    let unitIndex = 0;

    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex++;
    }

    return `${size.toFixed(1)} ${units[unitIndex]}`;
  },

  /**
   * Formats number with locale-specific formatting
   */
  formatNumber(num: number, locale = "en-US"): string {
    return new Intl.NumberFormat(locale).format(num);
  },

  /**
   * Formats percentage
   */
  formatPercentage(value: number, total: number): string {
    if (total === 0) return "0%";
    const percentage = (value / total) * 100;
    return `${percentage.toFixed(1)}%`;
  },
};
