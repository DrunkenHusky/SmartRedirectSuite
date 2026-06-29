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
