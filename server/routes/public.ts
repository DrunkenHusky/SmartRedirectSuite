import { Router } from "express";
import { trackingRateLimiter, apiRateLimiter } from "../middleware/rateLimit";
import { insertUrlTrackingSchema } from "@shared/schema";
import { storage } from "../storage";
import { z } from "zod";
import { findMatchingRule } from "@shared/ruleMatching";
import { RULE_MATCHING_CONFIG } from "@shared/constants";
import { asyncHandler } from "../middleware/errorHandler";

export const publicRoutes = Router();

function extractPath(url: string): string {
  try {
    const u = new URL(url);
    return u.pathname;
  } catch {
    return url.startsWith('/') ? url : '/' + url;
  }
}

// URL-Tracking endpoint
publicRoutes.post("/track", trackingRateLimiter, asyncHandler(async (req, res) => {
  const trackingData = insertUrlTrackingSchema.parse(req.body);
  const tracking = await storage.trackUrlAccess(trackingData);
  res.json(tracking);
}));

// User Feedback Endpoint
publicRoutes.post("/feedback", apiRateLimiter, asyncHandler(async (req, res) => {
  const { ruleId, feedback, url, trackingId, userProposedUrl } = z.object({
    ruleId: z.string().optional(),
    feedback: z.enum(['OK', 'NOK', 'auto-redirect']),
    url: z.string().optional(),
    trackingId: z.string().optional(),
    userProposedUrl: z.string()
      .refine((val) => !val || val.startsWith('http://') || val.startsWith('https://'), {
        message: "Proposed URL must be a valid HTTP/HTTPS URL",
      })
      .optional()
  }).parse(req.body);

  if (trackingId) {
    // Update existing tracking entry
    const success = await storage.updateUrlTracking(trackingId, { feedback, userProposedUrl });
    if (success) {
        res.json({ success: true, id: trackingId });
        return;
    }
    // If update failed (e.g. ID not found), fall back to creating new entry or error?
    // Let's fall back to creating a new entry to ensure feedback isn't lost,
    // but log a warning.
    console.warn(`Feedback update failed for trackingId: ${trackingId}, creating new entry.`);
  }

  // Create a tracking entry representing the feedback (Fallback or Legacy)
  // We look up the rule to get context if possible
  const rule = ruleId ? await storage.getUrlRule(ruleId) : undefined;

  const trackingEntry: any = {
    oldUrl: url || "Manual Feedback",
    path: rule ? rule.matcher : (url ? extractPath(url) : "unknown"),
    ruleId: ruleId || undefined,
    matchQuality: 100, // Explicit manual match
    timestamp: new Date().toISOString(),
    userAgent: "Manual Verification",
    feedback: feedback,
    userProposedUrl: userProposedUrl
  };

  const tracking = await storage.trackUrlAccess(trackingEntry);
  res.json({ success: true, id: tracking.id });
}));

// URL-Regel Matching endpoint
publicRoutes.post("/check-rules", apiRateLimiter, asyncHandler(async (req, res) => {
  const { path, url } = z.object({
    path: z.string(),
    url: z.string().optional()
  }).parse(req.body);
  // Removed direct getUrlRules call to use processed version below
  const settings = await storage.getGeneralSettings();

  const config = {
    ...RULE_MATCHING_CONFIG,
    CASE_SENSITIVITY_PATH: settings.caseSensitiveLinkDetection,
  };

  // Rules loaded from storage with pre-processing (server/storage.ts#getProcessedUrlRules)
  const rules = await storage.getProcessedUrlRules(config);

  // Normalization and specificity prioritization handled by findMatchingRule
  // We prefer the full URL to enable domain matching, but fallback to path if not provided
  const matchDetails = findMatchingRule(url || path, rules, config);

  res.json({
    rule: matchDetails?.rule || null,
    hasMatch: !!matchDetails,
    matchQuality: matchDetails?.quality || 0,
    matchLevel: matchDetails?.level || 'red'
  });
}));

// General Settings (accessible for UI configuration)
// Move settings endpoint outside admin middleware since it doesn't need auth
publicRoutes.get("/settings", asyncHandler(async (_req, res) => {
  const settings = await storage.getGeneralSettings();
  res.json(settings);
}));
