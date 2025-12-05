/**
 * Custom validation functions for URL rules
 */

import { z } from 'zod';

/**
 * Validates target URL based on redirect type
 * - "wildcard": Must be a full HTTP/HTTPS URL
 * - "partial": Can be a path fragment or full URL
 * - "domain": Must be a full HTTP/HTTPS URL (to extract domain) and contain no path
 */
export function validateTargetUrl(targetUrl: string, redirectType: 'wildcard' | 'partial' | 'domain'): boolean {
  if (!targetUrl) return false;
  
  if (redirectType === 'wildcard') {
    // Wildcard requires full URL
    return targetUrl.startsWith('http://') || targetUrl.startsWith('https://');
  } else if (redirectType === 'domain') {
    // Domain requires full URL and no path segments
    if (!targetUrl.startsWith('http://') && !targetUrl.startsWith('https://')) {
      return false;
    }
    try {
      const url = new URL(targetUrl);
      return url.pathname === '/' || url.pathname === '';
    } catch {
      return false;
    }
  } else {
    // Partial allows path fragments or full URLs
    return targetUrl.startsWith('/') || targetUrl.startsWith('http://') || targetUrl.startsWith('https://');
  }
}

/**
 * Enhanced URL rule schema with context-aware validation and German messages
 */
export const urlRuleSchemaWithValidation = z.object({
  id: z.string().uuid("Ungültige UUID").optional(),
  matcher: z.string()
    .min(1, "URL-Muster darf nicht leer sein")
    .max(500, "URL-Muster ist zu lang")
    .regex(/^\/[a-zA-Z0-9\-._~:/?#[\]@!$&'()*+,;=%]*$/, "URL-Muster muss mit '/' beginnen und gültige Zeichen enthalten")
    .transform(val => val.toLowerCase().trim()),
  targetUrl: z.string()
    .max(2000, "Ziel-URL ist zu lang")
    .optional(),
  infoText: z.string()
    .max(5000, "Info-Text ist zu lang")
    .optional(),
  redirectType: z.enum(['wildcard', 'partial', 'domain']).default('partial'),
  createdAt: z.string().datetime("Ungültiges Datumsformat").optional(),
}).transform((data) => {
  // Validate targetUrl based on redirectType with German error messages
  if (data.targetUrl) {
    if (data.redirectType === 'wildcard') {
      if (!data.targetUrl.startsWith('http://') && !data.targetUrl.startsWith('https://')) {
        throw new Error("Bei Typ 'Vollständig' muss die Ziel-URL eine vollständige URL mit http:// oder https:// sein (z.B. https://beispiel.com)");
      }
    } else if (data.redirectType === 'partial') {
      if (!data.targetUrl.startsWith('/') && 
          !data.targetUrl.startsWith('http://') && 
          !data.targetUrl.startsWith('https://')) {
        throw new Error("Bei Typ 'Teilweise' muss die Ziel-URL mit '/' beginnen (z.B. /neue-sektion/) oder eine vollständige URL sein");
      }
    } else if (data.redirectType === 'domain') {
      if (!data.targetUrl.startsWith('http://') && !data.targetUrl.startsWith('https://')) {
        throw new Error("Bei Typ 'Domain-Ersatz' muss die Ziel-URL eine vollständige URL mit http:// oder https:// sein (z.B. https://neue-domain.com)");
      }
      try {
        const url = new URL(data.targetUrl);
        if (url.pathname !== '/' && url.pathname !== '') {
          throw new Error("Bei Typ 'Domain-Ersatz' darf die Ziel-URL keine Unterordner enthalten (nur https://domain.com)");
        }
      } catch (e) {
        if (e instanceof Error && e.message.includes("keine Unterordner")) throw e;
        // Ignore URL parsing errors if startsWith passed, though technically unlikely
      }
    }
  }
  return data;
});

/**
 * Enhanced validation that works with existing rules during updates
 */
export const updateUrlRuleSchemaWithValidation = z.object({
  id: z.string().uuid("Ungültige UUID").optional(),
  matcher: z.string()
    .min(1, "URL-Muster darf nicht leer sein")
    .max(500, "URL-Muster ist zu lang")
    .regex(/^\/[a-zA-Z0-9\-._~:/?#[\]@!$&'()*+,;=%]*$/, "Ungültiges URL-Muster Format")
    .transform(val => val.toLowerCase().trim())
    .optional(),
  targetUrl: z.string()
    .max(2000, "Ziel-URL ist zu lang")
    .optional(),
  infoText: z.string()
    .max(5000, "Info-Text ist zu lang")
    .optional(),
  redirectType: z.enum(['wildcard', 'partial', 'domain']).optional(),
  autoRedirect: z.boolean().optional(),
  createdAt: z.string().datetime("Ungültiges Datumsformat").optional(),
}).transform((data) => {
  // Pre-validation transformation
  if (data.targetUrl && data.redirectType) {
    // For update operations, be more lenient - just validate the format
    if (data.redirectType === 'wildcard') {
      if (!data.targetUrl.startsWith('http://') && !data.targetUrl.startsWith('https://')) {
        throw new Error("Bei 'Vollständig' muss die Ziel-URL mit http:// oder https:// beginnen");
      }
    } else if (data.redirectType === 'partial') {
      if (!data.targetUrl.startsWith('/') && 
          !data.targetUrl.startsWith('http://') && 
          !data.targetUrl.startsWith('https://')) {
        throw new Error("Bei 'Teilweise' muss die Ziel-URL mit '/' beginnen oder eine vollständige URL sein");
      }
    } else if (data.redirectType === 'domain') {
      if (!data.targetUrl.startsWith('http://') && !data.targetUrl.startsWith('https://')) {
        throw new Error("Bei 'Domain-Ersatz' muss die Ziel-URL mit http:// oder https:// beginnen");
      }
      try {
        const url = new URL(data.targetUrl);
        if (url.pathname !== '/' && url.pathname !== '') {
          throw new Error("Bei 'Domain-Ersatz' darf die Ziel-URL keine Unterordner enthalten");
        }
      } catch (e) {
        if (e instanceof Error && e.message.includes("keine Unterordner")) throw e;
      }
    }
  }
  return data;
});

/**
 * Validation schema for import rules with German error messages
 */
export const importUrlRuleSchemaWithValidation = z.object({
  id: z.string().uuid("Ungültige UUID").optional(),
  matcher: z.string()
    .min(1, "URL-Muster darf nicht leer sein")
    .max(500, "URL-Muster ist zu lang")
    .regex(/^\/[a-zA-Z0-9\-._~:/?#[\]@!$&'()*+,;=%]*$/, "URL-Muster muss mit '/' beginnen")
    .transform(val => val.toLowerCase().trim()),
  targetUrl: z.string()
    .max(2000, "Ziel-URL ist zu lang"),
  redirectType: z.enum(['wildcard', 'partial', 'domain']).default('partial'),
  infoText: z.string()
    .max(5000, "Info-Text ist zu lang")
    .optional(),
}).transform((data) => {
  // Validate targetUrl based on redirectType with German error messages
  if (data.redirectType === 'wildcard') {
    if (!data.targetUrl.startsWith('http://') && !data.targetUrl.startsWith('https://')) {
      throw new Error("Bei Typ 'Vollständig' muss die Ziel-URL eine vollständige URL mit http:// oder https:// sein");
    }
  } else if (data.redirectType === 'partial') {
    if (!data.targetUrl.startsWith('/') && 
        !data.targetUrl.startsWith('http://') && 
        !data.targetUrl.startsWith('https://')) {
      throw new Error("Bei Typ 'Teilweise' muss die Ziel-URL mit '/' beginnen oder eine vollständige URL sein");
    }
  } else if (data.redirectType === 'domain') {
    if (!data.targetUrl.startsWith('http://') && !data.targetUrl.startsWith('https://')) {
      throw new Error("Bei Typ 'Domain-Ersatz' muss die Ziel-URL eine vollständige URL mit http:// oder https:// sein");
    }
    try {
      const url = new URL(data.targetUrl);
      if (url.pathname !== '/' && url.pathname !== '') {
        throw new Error("Bei Typ 'Domain-Ersatz' darf die Ziel-URL keine Unterordner enthalten");
      }
    } catch (e) {
      if (e instanceof Error && e.message.includes("keine Unterordner")) throw e;
    }
  }
  return data;
});
