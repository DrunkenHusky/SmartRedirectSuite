import { z } from "zod";

/**
 * Enterprise-grade constants and validation patterns
 */

// URL validation patterns
// Updated to allow domains (no leading slash required) and paths
const URL_MATCHER_PATTERN = /^(\/|[a-zA-Z0-9])([a-zA-Z0-9\-._~:/?#[\]@!$&'()*+,;=%]*)$/;

// Icon enums for better type safety and maintainability
export const ICON_OPTIONS = [
  "ArrowLeftRight", "ArrowRightLeft", "AlertTriangle", "XCircle", 
  "AlertCircle", "Info", "Bookmark", "Share2", "Clock", 
  "CheckCircle", "Star", "Heart", "Bell", "none"
] as const;

export const ALERT_ICON_OPTIONS = [
  "AlertTriangle", "XCircle", "AlertCircle", "Info"
] as const;

export const COLOR_OPTIONS = [
  "yellow", "red", "orange", "blue", "gray", "white", "black"
] as const;

export const POPUP_MODES = ["active", "inline", "disabled"] as const;

export const REDIRECT_TYPES = ["wildcard", "partial", "domain"] as const;
export const EXPORT_FORMATS = ["csv", "json", "xlsx"] as const;
export const TIME_RANGES = ["24h", "7d", "all"] as const;

/**
 * Enhanced URL Rule Schema with enterprise validation
 */
export const urlRuleSchema = z.object({
  id: z.string().uuid("Invalid UUID format"),
  matcher: z.string()
    .min(1, "URL matcher cannot be empty")
    .max(500, "URL matcher too long")
    .regex(URL_MATCHER_PATTERN, "Invalid URL matcher format")
    .transform(val => val.toLowerCase().trim()), // Normalize for consistency
  targetUrl: z.string()
    .max(2000, "Target URL too long")
    .optional(),
  infoText: z.string()
    .max(5000, "Info text too long")
    .optional(),
  redirectType: z.enum(REDIRECT_TYPES).default('partial'),
  autoRedirect: z.boolean()
    .default(false),
  discardQueryParams: z.boolean()
    .default(false),
  forwardQueryParams: z.boolean()
    .default(false),
  createdAt: z.string().datetime("Invalid datetime format"),
}).strict(); // Prevent extra properties

export const insertUrlRuleSchema = urlRuleSchema.omit({
  id: true,
  createdAt: true,
});

/**
 * Enhanced URL Tracking Schema with comprehensive validation
 */
export const urlTrackingSchema = z.object({
  id: z.string().uuid("Invalid tracking ID"),
  oldUrl: z.string()
    .max(8000, "Old URL too long"),
  newUrl: z.string()
    .max(8000, "New URL too long")
    .optional(),
  path: z.string()
    .min(1, "Path cannot be empty")
    .max(8000, "Path too long"),
  timestamp: z.string().datetime("Invalid timestamp format"),
  userAgent: z.string()
    .max(2000, "User agent too long")
    .optional(),
  ruleId: z.string()
    .uuid("Invalid rule ID")
    .optional()
    .catch(undefined),
  ruleIds: z.array(z.string().uuid())
    .optional()
    .default([]),
});

export const insertUrlTrackingSchema = urlTrackingSchema.omit({
  id: true,
});

/**
 * Enhanced Admin Authentication Schema with security validation
 */
export const adminAuthSchema = z.object({
  password: z.string()
    .min(8, "Password must be at least 8 characters")
    .max(100, "Password too long")
    .regex(/^(?=.*[A-Za-z])(?=.*\d)/, "Password must contain letters and numbers"),
}).strict();

/**
 * Enhanced Export Schema with validation
 */
export const exportRequestSchema = z.object({
  type: z.enum(['statistics', 'rules', 'settings']),
  format: z.enum(EXPORT_FORMATS).default('json'),
  timeRange: z.enum(TIME_RANGES).optional(),
}).strict();

/**
 * Enhanced Import Schema with comprehensive validation
 */
export const importUrlRuleSchema = z.object({
  id: z.string().uuid().optional(),
  matcher: z.string()
    .min(1, "URL matcher cannot be empty")
    .max(500, "URL matcher too long")
    .regex(URL_MATCHER_PATTERN, "Invalid URL matcher format")
    .transform(val => val.trim()), // Removed toLowerCase to preserve encoding for comparison
  targetUrl: z.string()
    .max(2000, "Target URL too long"),
  redirectType: z.enum(REDIRECT_TYPES).default('partial'),
  infoText: z.string()
    .max(5000, "Info text too long")
    .optional(),
  autoRedirect: z.boolean()
    .default(false),
  discardQueryParams: z.boolean()
    .default(false),
  forwardQueryParams: z.boolean()
    .default(false),
}).strict();

export const importRulesRequestSchema = z.object({
  rules: z.array(importUrlRuleSchema)
    .min(1, "At least one rule required")
    .max(1000, "Too many rules in import"),
}).strict();

/**
 * Enhanced General Settings Schema with comprehensive validation
 */
export const generalSettingsSchema = z.object({
  id: z.string().uuid("Invalid settings ID"),
  
  // Header section with validation
  headerTitle: z.string()
    .min(1, "Header-Titel darf nicht leer sein")
    .max(100, "Header-Titel ist zu lang")
    .trim(),
  headerIcon: z.enum(ICON_OPTIONS).optional(),
  headerLogoUrl: z.string()
    .max(2000, "Logo-URL ist zu lang")
    .optional()
    .nullable()
    .refine((val) => !val || val.startsWith('/objects/') || val.startsWith('/uploads/') || val.startsWith('http'), {
      message: "Logo-URL muss eine gültige HTTP-URL, Object-Storage-Pfad oder lokaler Upload-Pfad sein",
    }),
  headerBackgroundColor: z.string()
    .regex(/^(#([0-9A-Fa-f]{3}){1,2}|[a-zA-Z]+)$/, "Invalid color format")
    .default("white"),

  // Popup display mode
  popupMode: z.enum(POPUP_MODES).default('active'),

  // Main content section
  mainTitle: z.string()
    .min(1, "Haupttitel darf nicht leer sein")
    .max(200, "Haupttitel ist zu lang")
    .trim(),
  mainDescription: z.string()
    .min(1, "Hauptbeschreibung darf nicht leer sein")
    .max(1000, "Hauptbeschreibung ist zu lang")
    .trim(),
  mainBackgroundColor: z.string()
    .regex(/^(#([0-9A-Fa-f]{3}){1,2}|[a-zA-Z]+)$/, "Invalid color format")
    .default("white"),
    
  // Alert styling
  alertIcon: z.enum(ALERT_ICON_OPTIONS),
  alertBackgroundColor: z.enum(COLOR_OPTIONS),
  // URL comparison section
  urlComparisonTitle: z.string()
    .min(1, "URL-Vergleichstitel darf nicht leer sein")
    .max(100, "URL-Vergleichstitel ist zu lang")
    .trim(),
  urlComparisonIcon: z.enum(ICON_OPTIONS).optional(),
  urlComparisonBackgroundColor: z.string()
    .regex(/^(#([0-9A-Fa-f]{3}){1,2}|[a-zA-Z]+)$/, "Invalid color format")
    .default("white"),
  oldUrlLabel: z.string()
    .min(1, "Label für alte URL darf nicht leer sein")
    .max(50, "Label für alte URL ist zu lang")
    .trim(),
  newUrlLabel: z.string()
    .min(1, "Label für neue URL darf nicht leer sein")
    .max(50, "Label für neue URL ist zu lang")
    .trim(),
  defaultNewDomain: z.string()
    .max(500, "Standard-Domain ist zu lang")
    .refine((val) => val.startsWith('http://') || val.startsWith('https://'), {
      message: "Standard-Domain muss eine gültige HTTP/HTTPS-URL sein",
    }),
    
  // Button texts with validation
  copyButtonText: z.string()
    .min(1, "Kopieren-Button-Text darf nicht leer sein")
    .max(50, "Kopieren-Button-Text ist zu lang")
    .trim(),
  openButtonText: z.string()
    .min(1, "Öffnen-Button-Text darf nicht leer sein")
    .max(50, "Öffnen-Button-Text ist zu lang")
    .trim(),
  showUrlButtonText: z.string()
    .min(1, "URL-anzeigen-Button-Text darf nicht leer sein")
    .max(50, "URL-anzeigen-Button-Text ist zu lang")
    .trim(),
  popupButtonText: z.string()
    .min(1, "Popup-Button-Text darf nicht leer sein")
    .max(50, "Popup-Button-Text ist zu lang")
    .trim(),
    
  // Special hints section
  specialHintsTitle: z.string()
    .min(1, "Titel für spezielle Hinweise darf nicht leer sein")
    .max(100, "Titel für spezielle Hinweise ist zu lang")
    .trim(),
  specialHintsDescription: z.string()
    .min(1, "Beschreibung für spezielle Hinweise darf nicht leer sein")
    .max(1000, "Beschreibung für spezielle Hinweise ist zu lang")
    .trim(),
  specialHintsIcon: z.enum(ICON_OPTIONS).optional(),
  
  // Additional info section
  infoTitle: z.string()
    .min(1, "Info-Titel darf nicht leer sein")
    .max(100, "Info-Titel ist zu lang")
    .trim(),
  infoTitleIcon: z.enum(ICON_OPTIONS).optional(),
  infoItems: z.array(z.string().max(200, "Info-Element ist zu lang"))
    .max(10, "Zu viele Info-Elemente"),
  infoIcons: z.array(z.enum(["Bookmark", "Share2", "Clock", "Info", "CheckCircle", "Star", "Heart", "Bell"]))
    .max(10, "Zu viele Info-Icons"),
    
  // Footer
  footerCopyright: z.string()
    .min(1, "Footer-Copyright darf nicht leer sein")
    .max(200, "Footer-Copyright ist zu lang")
    .trim(),

  // Link detection behavior
  caseSensitiveLinkDetection: z.boolean().default(false),

  // Import settings
  encodeImportedUrls: z.boolean().default(true),

  // Auto-redirect functionality
  autoRedirect: z.boolean()
    .default(false),

  // Encode imported URLs
  encodeImportedUrls: z.boolean()
    .default(true),

  // Show link quality gauge
  showLinkQualityGauge: z.boolean()
    .default(true),

  // Match quality explanations
  matchHighExplanation: z.string()
    .min(1, "Text für hohe Übereinstimmung darf nicht leer sein")
    .max(500, "Text für hohe Übereinstimmung ist zu lang")
    .default("Die neue URL entspricht exakt der angeforderten Seite oder ist die Startseite. Höchste Qualität."),

  matchMediumExplanation: z.string()
    .min(1, "Text für mittlere Übereinstimmung darf nicht leer sein")
    .max(500, "Text für mittlere Übereinstimmung ist zu lang")
    .default("Die URL wurde erkannt, weicht aber leicht ab (z.B. zusätzliche Parameter)."),

  matchLowExplanation: z.string()
    .min(1, "Text für niedrige Übereinstimmung darf nicht leer sein")
    .max(500, "Text für niedrige Übereinstimmung ist zu lang")
    .default("Es wurde nur ein Teil der URL erkannt und ersetzt (Partial Match)."),

  matchRootExplanation: z.string()
    .min(1, "Text für Startseiten-Übereinstimmung darf nicht leer sein")
    .max(500, "Text für Startseiten-Übereinstimmung ist zu lang")
    .default("Startseite erkannt. Direkte Weiterleitung auf die neue Domain."),

  matchNoneExplanation: z.string()
    .min(1, "Text für keine Übereinstimmung darf nicht leer sein")
    .max(500, "Text für keine Übereinstimmung ist zu lang")
    .default("Die URL konnte nicht spezifisch zugeordnet werden. Es wird auf die Standard-Seite weitergeleitet."),
    
  updatedAt: z.string().datetime("Invalid update timestamp"),
}).strict(); // Prevent extra properties

export const insertGeneralSettingsSchema = generalSettingsSchema.omit({
  id: true,
  updatedAt: true,
});

// Import-Schema for general settings (must be after insertGeneralSettingsSchema)
export const importSettingsRequestSchema = z.object({
  settings: insertGeneralSettingsSchema,
});

export type UrlRule = z.infer<typeof urlRuleSchema>;
export type InsertUrlRule = z.infer<typeof insertUrlRuleSchema>;
export type UrlTracking = z.infer<typeof urlTrackingSchema>;
export type InsertUrlTracking = z.infer<typeof insertUrlTrackingSchema>;
export type AdminAuth = z.infer<typeof adminAuthSchema>;
export type ExportRequest = z.infer<typeof exportRequestSchema>;
export type ImportUrlRule = z.infer<typeof importUrlRuleSchema>;
export type ImportRulesRequest = z.infer<typeof importRulesRequestSchema>;
export type ImportSettingsRequest = z.infer<typeof importSettingsRequestSchema>;
export type GeneralSettings = z.infer<typeof generalSettingsSchema>;
export type InsertGeneralSettings = z.infer<typeof insertGeneralSettingsSchema>;
