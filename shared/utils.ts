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
   * Robustly extracts hostname from URL, handling missing protocol
   */
  extractHostname(url: string): string | null {
    if (!url || !url.trim()) return null;
    const trimmedUrl = url.trim();
    try {
      // Try parsing as is (e.g. http://example.com/foo)
      return new URL(trimmedUrl).hostname;
    } catch {
      try {
        // Try adding protocol (e.g. example.com/foo)
        return new URL('http://' + trimmedUrl).hostname;
      } catch {
        return null;
      }
    }
  },
};
