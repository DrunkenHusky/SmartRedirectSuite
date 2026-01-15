import type { Express } from "express";
import { createServer, type Server } from "http";
import { createHash, timingSafeEqual } from "crypto";
import { storage } from "./storage";
import {
  insertUrlTrackingSchema,
  exportRequestSchema,
  importSettingsRequestSchema,
  insertGeneralSettingsSchema,
  type InsertGeneralSettings,
  type InsertUrlRule,
} from "@shared/schema";
import { urlRuleSchemaWithValidation, updateUrlRuleSchemaWithValidation } from "@shared/validation";
import { z } from "zod";
import { LocalFileUploadService } from "./localFileUpload";
import { bruteForceProtection, recordLoginFailure, resetLoginAttempts, resetAllLoginAttempts, getBlockedIps, blockIp } from "./middleware/bruteForce";
import { apiRateLimiter, trackingRateLimiter } from "./middleware/rateLimit";
import path from "path";
import { findMatchingRule, findAllMatchingRules } from "@shared/ruleMatching";
import { RULE_MATCHING_CONFIG } from "@shared/constants";
import { APPLICATION_METADATA } from "@shared/appMetadata";
import { ImportExportService } from "./import-export";
import multer from 'multer';
import fs from 'fs';
import { utils, write } from '@e965/xlsx';



// Extend Express Session interface
declare module 'express-session' {
  interface SessionData {
    isAdminAuthenticated?: boolean;
    adminLoginTime?: number;
  }
}

// Admin-Passwort aus Umgebungsvariable oder Standard
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "Password1";

// Import Preview Limit from environment variable (default 1000)
const IMPORT_PREVIEW_LIMIT = parseInt(process.env.IMPORT_PREVIEW_LIMIT || "1000", 10);

// Middleware to check admin authentication
const requireAuth = (req: any, res: any, next: any) => {
  if (!req.session?.isAdminAuthenticated) {
    return res.status(403).json({ error: "Access denied. Please log in to the admin panel." });
  }
  next();
};

export async function registerRoutes(app: Express): Promise<Server> {

  app.use((_, res, next) => {
    res.setHeader("X-App-Name", APPLICATION_METADATA.displayName);
    res.setHeader("X-App-Version", APPLICATION_METADATA.version);
    next();
  });

  // Health check endpoint for monitoring and OpenShift deployment
  app.get("/api/health", async (_req, res) => {
    try {
      const startTime = Date.now();
      const uptime = process.uptime();
      const memoryUsage = process.memoryUsage();
      
      // Check filesystem by verifying data directory exists
      const fs = await import('fs/promises');
      const path = await import('path');
      const dataDir = path.join(process.cwd(), 'data');
      
      let filesystemCheck = { status: "error", responseTime: 0, error: "" };
      const fsStart = Date.now();
      try {
        await fs.access(dataDir);
        filesystemCheck = { status: "ok" as const, responseTime: Date.now() - fsStart, error: "" };
      } catch (error) {
        filesystemCheck = { 
          status: "error" as const, 
          responseTime: Date.now() - fsStart, 
          error: error instanceof Error ? error.message : "Unknown error" 
        };
      }
      
      // Check sessions by verifying session directory
      let sessionsCheck = { status: "error", responseTime: 0, error: "" };
      const sessionsStart = Date.now();
      try {
        const sessionsDir = path.join(dataDir, 'sessions');
        await fs.access(sessionsDir);
        sessionsCheck = { status: "ok" as const, responseTime: Date.now() - sessionsStart, error: "" };
      } catch (error) {
        sessionsCheck = { 
          status: "error" as const, 
          responseTime: Date.now() - sessionsStart, 
          error: error instanceof Error ? error.message : "Sessions directory not accessible" 
        };
      }
      
      // Check storage by attempting to read settings
      let storageCheck = { status: "error", responseTime: 0, error: "" };
      const storageStart = Date.now();
      try {
        await storage.getGeneralSettings();
        storageCheck = { status: "ok" as const, responseTime: Date.now() - storageStart, error: "" };
      } catch (error) {
        storageCheck = { 
          status: "error" as const, 
          responseTime: Date.now() - storageStart, 
          error: error instanceof Error ? error.message : "Storage error" 
        };
      }
      
      const overallStatus = (filesystemCheck.status === "ok" && 
                            sessionsCheck.status === "ok" && 
                            storageCheck.status === "ok") ? "healthy" : "unhealthy";
      
      const healthResponse = {
        status: overallStatus,
        timestamp: new Date().toISOString(),
        uptime: Math.floor(uptime),
        memory: memoryUsage,
        checks: {
          filesystem: filesystemCheck,
          sessions: sessionsCheck,
          storage: storageCheck
        },
        responseTime: Date.now() - startTime
      };
      
      // Return 200 for healthy, 503 for unhealthy
      const statusCode = overallStatus === "healthy" ? 200 : 503;
      res.status(statusCode).json(healthResponse);
    } catch (error) {
      console.error("Health check error:", error);
      res.status(503).json({
        status: "unhealthy",
        timestamp: new Date().toISOString(),
        error: error instanceof Error ? error.message : "Unknown health check error"
      });
    }
  });
  
  // Serve sample import file
  app.get("/sample-rules-import.json", (_req, res) => {
    res.sendFile("sample-rules-import.json", { root: process.cwd() });
  });

  app.get("/sample-rules-import.csv", (_req, res) => {
    res.sendFile("sample-rules-import.csv", { root: process.cwd() });
  });

  app.get("/sample-rules-import.xlsx", (_req, res) => {
    res.sendFile("sample-rules-import.xlsx", { root: process.cwd() });
  });
  
  // URL-Tracking endpoint
  app.post("/api/track", trackingRateLimiter, async (req, res) => {
    try {
      const trackingData = insertUrlTrackingSchema.parse(req.body);
      const tracking = await storage.trackUrlAccess(trackingData);
      res.json(tracking);
    } catch (error) {
      console.error("Tracking error:", error);

      if (error instanceof z.ZodError) {
        const validationErrors = error.errors.map(err => ({
          field: err.path.join('.'),
          message: err.message
        }));

        res.status(400).json({
          error: "Invalid tracking data",
          details: validationErrors
        });
      } else {
        res.status(400).json({ error: "Invalid tracking data" });
      }
    }
  });

  // User Feedback Endpoint
  app.post("/api/feedback", apiRateLimiter, async (req, res) => {
    try {
      const { ruleId, feedback, url, trackingId } = z.object({
        ruleId: z.string().optional(),
        feedback: z.enum(['OK', 'NOK']),
        url: z.string().optional(),
        trackingId: z.string().optional()
      }).parse(req.body);

      if (trackingId) {
        // Update existing tracking entry
        const success = await storage.updateUrlTracking(trackingId, { feedback });
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
        feedback: feedback
      };

      const tracking = await storage.trackUrlAccess(trackingEntry);
      res.json({ success: true, id: tracking.id });
    } catch (error) {
      console.error("Feedback error:", error);
      res.status(400).json({ error: "Invalid feedback data" });
    }
  });

  function extractPath(url: string): string {
    try {
      const u = new URL(url);
      return u.pathname;
    } catch {
      return url.startsWith('/') ? url : '/' + url;
    }
  }

  // URL-Regel Matching endpoint
  app.post("/api/check-rules", apiRateLimiter, async (req, res) => {
    try {
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
    } catch (error) {
      console.error("Rule check error:", error);
      res.status(400).json({ error: "Invalid request" });
    }
  });

  // Admin-Authentifizierung
  app.post("/api/admin/login", bruteForceProtection, async (req, res) => {
    const ip = req.ip || req.connection.remoteAddress || "";
    try {
      // Simple password extraction without validation first
      const { password } = z.object({ password: z.string() }).parse(req.body);

      // Hash both passwords for constant-time comparison
      const inputHash = createHash('sha256').update(password).digest();
      const storedHash = createHash('sha256').update(ADMIN_PASSWORD).digest();

      // Check password match using timingSafeEqual
      if (timingSafeEqual(inputHash, storedHash)) {
        // Check if session exists, if not return error
        if (!req.session) {
          console.error("Session not available during login");
          res.status(500).json({ error: "Session error" });
          return;
        }

        // Regenerate session to prevent fixation
        req.session.regenerate((err) => {
          if (err) {
            console.error("Session regeneration error:", err);
            res.status(500).json({ error: "Session error" });
            return;
          }

          // Set session data and force save for file store
          req.session.isAdminAuthenticated = true;
          req.session.adminLoginTime = Date.now();

          // For file store, explicitly save the session
          req.session.save(async (saveErr) => {
            if (saveErr) {
              console.error("Session save error:", saveErr);
              res.status(500).json({ error: "Session save error" });
              return;
            }
            await resetLoginAttempts(ip);
            res.json({ success: true, sessionId: req.sessionID });
          });
        });
      } else {
        await recordLoginFailure(ip);
        res.status(401).json({ error: "Falsches Passwort" });
      }
    } catch (error) {
      console.error("Login error:", error);
      await recordLoginFailure(ip);

      // Always return "wrong password" for any error during login
      // This prevents exposing validation details to users
      res.status(401).json({ error: "Falsches Passwort" });
    }
  });

  // Check admin authentication status
  app.get("/api/admin/status", (req, res) => {
    res.json({ 
      isAuthenticated: !!req.session?.isAdminAuthenticated,
      loginTime: req.session?.adminLoginTime 
    });
  });

  // Admin logout
  app.post("/api/admin/logout", (req, res) => {
    req.session?.destroy((err) => {
      if (err) {
        res.status(500).json({ error: "Failed to logout" });
      } else {
        res.clearCookie('admin_session'); // Clear correct session name
        res.json({ success: true });
      }
    });
  });

  // Force Cache Rebuild
  app.post("/api/admin/force-cache-rebuild", requireAuth, async (_req, res) => {
    try {
      await storage.forceCacheRebuild();
      res.json({ success: true, message: "Cache rebuild triggered successfully" });
    } catch (error) {
      console.error("Cache rebuild error:", error);
      res.status(500).json({ error: "Failed to rebuild cache" });
    }
  });

  // URL-Regeln verwalten
  app.get("/api/admin/rules", requireAuth, async (_req, res) => {
    try {
      const rules = await storage.getUrlRules();
      res.json(rules);
    } catch (error) {
      console.error("Get rules error:", error);
      res.status(500).json({ error: "Failed to fetch rules" });
    }
  });

  // Get paginated URL rules with search and sort
  app.get("/api/admin/rules/paginated", requireAuth, async (req, res) => {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 50;
      // Handle HPP (HTTP Parameter Pollution): if search is array, take first element
      const rawSearch = req.query.search;
      const search = Array.isArray(rawSearch) ? (rawSearch[0] as string) : (rawSearch as string);

      const sortBy = req.query.sortBy as string || 'createdAt';
      const sortOrder = (req.query.sortOrder as 'asc' | 'desc') || 'desc';
      
      // If search is provided but empty or whitespace only, treat it as undefined
      const cleanSearch = (search && typeof search === 'string' && search.trim().length > 0) ? search.trim() : undefined;

      const result = await storage.getUrlRulesPaginated(page, limit, cleanSearch, sortBy, sortOrder);
      res.json(result);
    } catch (error: any) {
      console.error('Error getting paginated rules:', error);
      res.status(500).json({ error: 'Failed to get rules' });
    }
  });

  app.post("/api/admin/rules", requireAuth, async (req, res) => {
    try {
      const { forceCreate, ...ruleData } = req.body;

      // If forceCreate is true, skip validation and create directly
      if (forceCreate) {
        const rule = await storage.createUrlRule({
          ...ruleData,
          autoRedirect: ruleData.autoRedirect ?? false,
        }, true); // Pass force flag
        res.json(rule);
      } else {
        const validatedData = urlRuleSchemaWithValidation.parse(ruleData);
        const rule = await storage.createUrlRule({
          ...validatedData,
          autoRedirect: ruleData.autoRedirect ?? false,
        });
        res.json(rule);
      }
    } catch (error) {
      console.error("Create rule error:", error instanceof Error ? error.message : String(error));
      if (error instanceof Error) {
        // Extract clean error message from Zod validation errors
        let cleanMessage = error.message;
        
        // Handle Zod validation errors specifically
        if (error.message.includes('[') && error.message.includes('"message"')) {
          try {
            const zodErrors = JSON.parse(error.message);
            if (Array.isArray(zodErrors) && zodErrors.length > 0) {
              cleanMessage = zodErrors[0].message || "Ungültige Eingabedaten";
            }
          } catch (parseError) {
            // If parsing fails, use a generic message
            cleanMessage = "Ungültige Eingabedaten. Bitte überprüfen Sie Ihre Eingaben.";
          }
        }
        
        res.status(400).json({ 
          error: cleanMessage
        });
      } else {
        res.status(400).json({ error: "Ungültige Regel-Daten" });
      }
    }
  });

  app.put("/api/admin/rules/:id", requireAuth, async (req, res) => {
    try {
      const { id } = req.params;
      const { forceUpdate, ...updateData } = req.body as Partial<InsertUrlRule>;
      
      // If forceUpdate is true, skip validation and update directly
      if (forceUpdate) {
        const rule = await storage.updateUrlRule(id, updateData, true); // Pass force flag

        if (!rule) {
          res.status(404).json({ error: "Rule not found" });
          return;
        }

        res.json(rule);
        return;
      }

      const validatedData = updateUrlRuleSchemaWithValidation.parse(updateData);
      const rule = await storage.updateUrlRule(id, validatedData as Partial<InsertUrlRule>);

      if (!rule) {
        res.status(404).json({ error: "Rule not found" });
        return;
      }

      res.json(rule);
    } catch (error) {
      console.error("Update rule error:", error instanceof Error ? error.message : String(error));
      if (error instanceof Error) {
        // Extract clean error message from Zod validation errors
        let cleanMessage = error.message;
        
        // Handle Zod validation errors specifically
        if (error.message.includes('[') && error.message.includes('"message"')) {
          try {
            const zodErrors = JSON.parse(error.message);
            if (Array.isArray(zodErrors) && zodErrors.length > 0) {
              cleanMessage = zodErrors[0].message || "Ungültige Eingabedaten";
            }
          } catch (parseError) {
            // If parsing fails, use a generic message
            cleanMessage = "Ungültige Eingabedaten. Bitte überprüfen Sie Ihre Eingaben.";
          }
        }
        
        res.status(400).json({ 
          error: cleanMessage
        });
      } else {
        res.status(400).json({ error: "Ungültige Regel-Daten" });
      }
    }
  });

  app.delete("/api/admin/rules/:id", requireAuth, async (req, res) => {
    try {
      const { id } = req.params;
      const deleted = await storage.deleteUrlRule(id);

      if (!deleted) {
        res.status(404).json({ error: "Rule not found" });
        return;
      }

      res.json({ success: true });
    } catch (error) {
      console.error("Delete rule error:", error);
      res.status(500).json({ error: "Failed to delete rule" });
    }
  });

  // Bulk delete rules
  app.delete("/api/admin/bulk-delete-rules", requireAuth, async (req, res) => {
    try {
      const { ruleIds } = z.object({ ruleIds: z.array(z.string()) }).parse(req.body);

      if (ruleIds.length === 0) {
        res.status(400).json({ error: "No rule IDs provided" });
        return;
      }

      console.log(`Bulk delete request: ${ruleIds.length} rules`, ruleIds.slice(0, 5));

      // Use atomic bulk delete to prevent race conditions
      const result = await storage.bulkDeleteUrlRules(ruleIds);

      console.log(`Bulk delete completed: ${result.deleted} deleted, ${result.notFound} not found`);

      res.json({
        success: true,
        deletedCount: result.deleted,
        failedCount: 0,
        notFoundCount: result.notFound,
        totalRequested: ruleIds.length
      });
    } catch (error) {
      console.error("Bulk delete rules error:", error);
      res.status(500).json({ error: "Failed to delete rules" });
    }
  });

  // Delete all rules
  app.delete("/api/admin/all-rules", requireAuth, async (_req, res) => {
    try {
      console.log("Deleting all rules request received");
      await storage.clearAllRules();
      // Ensure cache is rebuilt/cleared properly
      await storage.forceCacheRebuild();

      console.log("All rules deleted successfully");
      res.json({ success: true, message: "Alle Regeln wurden erfolgreich gelöscht." });
    } catch (error) {
      console.error("Delete all rules error:", error);
      res.status(500).json({ error: "Fehler beim Löschen aller Regeln" });
    }
  });

  // Delete all statistics
  app.delete("/api/admin/all-stats", requireAuth, async (_req, res) => {
    try {
      console.log("Deleting all statistics request received");
      await storage.clearAllTracking();

      console.log("All statistics deleted successfully");
      res.json({ success: true, message: "Alle Statistiken wurden erfolgreich gelöscht." });
    } catch (error) {
      console.error("Delete all stats error:", error);
      res.status(500).json({ error: "Fehler beim Löschen aller Statistiken" });
    }
  });

  // Get all blocked IPs
  app.get("/api/admin/blocked-ips", requireAuth, async (_req, res) => {
    try {
      const ips = await getBlockedIps();
      res.json(ips);
    } catch (error) {
      console.error("Get blocked IPs error:", error);
      res.status(500).json({ error: "Fehler beim Abrufen der blockierten IP-Adressen" });
    }
  });

  // Manually block an IP
  app.post("/api/admin/blocked-ips", requireAuth, async (req, res) => {
    try {
      // Use regex for IP validation to be compatible with different zod versions
      const ipSchema = z.string().regex(/^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/);
      const { ip } = z.object({ ip: ipSchema }).parse(req.body);
      await blockIp(ip);
      res.json({ success: true, message: `IP ${ip} wurde blockiert.` });
    } catch (error) {
      console.error("Block IP error:", error);
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: "Ungültige IP-Adresse" });
      } else {
        res.status(500).json({ error: "Fehler beim Blockieren der IP-Adresse" });
      }
    }
  });

  // Unblock specific IP
  app.delete("/api/admin/blocked-ips/:ip", requireAuth, async (req, res) => {
    try {
      const { ip } = req.params;
      const ipSchema = z.string().regex(/^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/);
      // Basic IP validation
      if (!ipSchema.safeParse(ip).success) {
         res.status(400).json({ error: "Ungültige IP-Adresse" });
         return;
      }

      await resetLoginAttempts(ip);
      res.json({ success: true, message: `IP ${ip} wurde entsperrt.` });
    } catch (error) {
      console.error("Unblock IP error:", error);
      res.status(500).json({ error: "Fehler beim Entsperren der IP-Adresse" });
    }
  });

  // Export blocked IPs as Excel
  app.get("/api/admin/export/blocked-ips", requireAuth, async (_req, res) => {
    try {
      const ips = await getBlockedIps();

      const data = ips.map(entry => ({
        IP: entry.ip,
        Attempts: entry.attempts,
        BlockedUntil: entry.blockedUntil ? new Date(entry.blockedUntil).toISOString() : ''
      }));

      const workbook = utils.book_new();
      const worksheet = utils.json_to_sheet(data);
      utils.book_append_sheet(workbook, worksheet, 'Blocked IPs');

      const buffer = write(workbook, { type: 'buffer', bookType: 'xlsx' });

      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', 'attachment; filename="blocked_ips.xlsx"');
      res.send(buffer);
    } catch (error) {
      console.error("Export blocked IPs error:", error);
      res.status(500).json({ error: "Fehler beim Exportieren der blockierten IPs" });
    }
  });

  // Clear all blocked IPs
  app.delete("/api/admin/blocked-ips", requireAuth, async (_req, res) => {
    try {
      console.log("Clearing all blocked IPs request received");
      await resetAllLoginAttempts();

      console.log("All blocked IPs cleared successfully");
      res.json({ success: true, message: "Alle blockierten IP-Adressen wurden erfolgreich gelöscht." });
    } catch (error) {
      console.error("Clear blocked IPs error:", error);
      res.status(500).json({ error: "Fehler beim Löschen der blockierten IP-Adressen" });
    }
  });

  // Statistiken
  app.get("/api/admin/stats/all", requireAuth, async (req, res) => {
    try {
      const timeRange = req.query.timeRange as '24h' | '7d' | 'all' | undefined;
      const stats = await storage.getTrackingStats();
      const topUrls = await storage.getTopUrls(10, timeRange);
      
      res.json({
        stats,
        topUrls,
      });
    } catch (error) {
      console.error("Stats error:", error);
      res.status(500).json({ error: "Failed to fetch statistics" });
    }
  });

  // Top 100 URLs
  app.get("/api/admin/stats/top100", requireAuth, async (req, res) => {
    try {
      const timeRange = req.query.timeRange as '24h' | '7d' | 'all' | undefined;
      const topUrls = await storage.getTopUrls(100, timeRange);
      
      res.json(topUrls);
    } catch (error) {
      console.error("Top 100 stats error:", error);
      res.status(500).json({ error: "Failed to fetch top 100 statistics" });
    }
  });

  // Top Referrers
  app.get("/api/admin/stats/top-referrers", requireAuth, async (req, res) => {
    try {
      const timeRange = req.query.timeRange as '24h' | '7d' | 'all' | undefined;
      const topReferrers = await storage.getTopReferrers(10, timeRange);
      res.json(topReferrers);
    } catch (error) {
      console.error("Top referrers stats error:", error);
      res.status(500).json({ error: "Failed to fetch top referrers statistics" });
    }
  });

  // Comprehensive tracking entries with search and sort
  app.get("/api/admin/stats/entries", requireAuth, async (req, res) => {
    try {
      const { query = '', sortBy = 'timestamp', sortOrder = 'desc' } = req.query;
      // Handle HPP for query
      const rawQuery = query;
      const cleanQuery = Array.isArray(rawQuery) ? String(rawQuery[0]) : String(rawQuery);

      const entries = await storage.searchTrackingEntries(
        cleanQuery,
        sortBy as string, 
        sortOrder as 'asc' | 'desc'
      );
      
      res.json(entries);
    } catch (error) {
      console.error("Tracking entries error:", error);
      res.status(500).json({ error: "Failed to fetch tracking entries" });
    }
  });

  // Paginated statistics endpoints for improved performance with large datasets
  app.get("/api/admin/stats/entries/paginated", requireAuth, async (req, res) => {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 50;

      // Handle HPP: if search is array, take first element
      const rawSearch = req.query.search;
      const searchVal = Array.isArray(rawSearch) ? rawSearch[0] : rawSearch;
      const search = (typeof searchVal === 'string' && searchVal.length > 0) ? searchVal : undefined;

      const sortBy = req.query.sortBy as string || 'timestamp';
      const sortOrder = req.query.sortOrder as 'asc' | 'desc' || 'desc';
      
      // Backward compatibility handling:
      // If ruleFilter is provided, use it.
      // If not, check excludeNoRule: true -> 'with_rule', false -> 'all'
      let ruleFilter: 'all' | 'with_rule' | 'no_rule' = 'all';

      if (req.query.ruleFilter && ['all', 'with_rule', 'no_rule'].includes(req.query.ruleFilter as string)) {
        ruleFilter = req.query.ruleFilter as 'all' | 'with_rule' | 'no_rule';
      } else if (req.query.excludeNoRule === 'true') {
        ruleFilter = 'with_rule';
      }

      // Quality filtering - Robust parsing
      let minQuality: number | undefined = undefined;
      if (req.query.minQuality) {
        const parsed = parseInt(req.query.minQuality as string, 10);
        if (!isNaN(parsed)) minQuality = parsed;
      }

      let maxQuality: number | undefined = undefined;
      if (req.query.maxQuality) {
        const parsed = parseInt(req.query.maxQuality as string, 10);
        if (!isNaN(parsed)) maxQuality = parsed;
      }

      // Feedback filter
      let feedbackFilter: 'all' | 'OK' | 'NOK' | 'empty' = 'all';
      if (req.query.feedbackFilter && ['all', 'OK', 'NOK', 'empty'].includes(req.query.feedbackFilter as string)) {
        feedbackFilter = req.query.feedbackFilter as 'all' | 'OK' | 'NOK' | 'empty';
      }

      const result = await storage.getTrackingEntriesPaginated(
        page,
        limit,
        search,
        sortBy,
        sortOrder,
        ruleFilter,
        minQuality,
        maxQuality,
        feedbackFilter
      );
      res.json(result);
    } catch (error) {
      console.error("Paginated tracking entries error:", error);
      res.status(500).json({ error: "Failed to fetch paginated tracking entries" });
    }
  });

  app.get("/api/admin/stats/top100/paginated", requireAuth, async (req, res) => {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 50;
      const timeRange = req.query.timeRange as '24h' | '7d' | 'all' | undefined;

      const result = await storage.getTopUrlsPaginated(page, limit, timeRange);
      res.json(result);
    } catch (error) {
      console.error("Paginated top URLs error:", error);
      res.status(500).json({ error: "Failed to fetch paginated top URLs" });
    }
  });

  // Export-Funktionalität
  app.post("/api/admin/export", requireAuth, async (req, res) => {
    try {
      const exportRequest = exportRequestSchema.parse(req.body);
      const settings = await storage.getGeneralSettings();
      
      if (exportRequest.type === 'statistics') {
        const trackingData = await storage.getTrackingData(exportRequest.timeRange);
        
        if (exportRequest.format === 'csv') {
          const includeReferrer = settings.enableReferrerTracking;
          // CSV-Export
          const csvHeader = includeReferrer
            ? 'ID,Alte URL,Neue URL,Pfad,Referrer,Zeitstempel,User-Agent,Regel ID,Feedback,Qualität\n'
            : 'ID,Alte URL,Neue URL,Pfad,Zeitstempel,User-Agent,Regel ID,Feedback,Qualität\n';

          const csvData = trackingData.map(track => {
            // Prepare new fields
            const ruleId = track.ruleId || (track.ruleIds && track.ruleIds.length > 0 ? track.ruleIds.join(';') : '') || '';
            const feedback = track.feedback || '';
            const quality = track.matchQuality !== undefined ? track.matchQuality : 0;

            if (includeReferrer) {
              return `"${track.id}","${track.oldUrl}","${(track as any).newUrl || ''}","${track.path}","${track.referrer || ''}","${track.timestamp}","${track.userAgent || ''}","${ruleId}","${feedback}","${quality}"`;
            } else {
              return `"${track.id}","${track.oldUrl}","${(track as any).newUrl || ''}","${track.path}","${track.timestamp}","${track.userAgent || ''}","${ruleId}","${feedback}","${quality}"`;
            }
          }).join('\n');
          
          res.setHeader('Content-Type', 'text/csv');
          res.setHeader('Content-Disposition', 'attachment; filename="statistics.csv"');
          res.send(csvHeader + csvData);
        } else {
          // JSON-Export
          res.setHeader('Content-Type', 'application/json');
          res.setHeader('Content-Disposition', 'attachment; filename="statistics.json"');
          res.send(JSON.stringify(trackingData, null, 2));
        }
      } else if (exportRequest.type === 'rules') {
        // Use getCleanUrlRules to ensure internal cache properties are stripped
        const rules = await storage.getCleanUrlRules();
        if (exportRequest.format === 'csv') {
          const csv = ImportExportService.generateCSV(rules);
          res.setHeader('Content-Type', 'text/csv');
          res.setHeader('Content-Disposition', 'attachment; filename="rules.csv"');
          res.send(csv);
        } else if (exportRequest.format === 'xlsx') {
          const buffer = ImportExportService.generateExcel(rules);
          res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
          res.setHeader('Content-Disposition', 'attachment; filename="rules.xlsx"');
          res.send(buffer);
        } else {
          res.setHeader('Content-Type', 'application/json');
          res.setHeader('Content-Disposition', 'attachment; filename="rules.json"');
          res.send(JSON.stringify(rules, null, 2));
        }
      } else if (exportRequest.type === 'settings') {
        const settings = await storage.getGeneralSettings();
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Content-Disposition', 'attachment; filename="settings.json"');
        res.send(JSON.stringify(settings, null, 2));
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error("Export error:", errorMessage);
      res.status(400).json({ error: "Invalid export request" });
    }
  });

  // Import-Funktionalität
  app.post("/api/admin/import/rules", requireAuth, async (req, res) => {
    try {
      const { rules } = req.body;
      if (!Array.isArray(rules)) {
        res.status(400).json({ error: "Invalid rules format" });
        return;
      }

      const result = await storage.importUrlRules(rules);

      res.json({
        success: result.errors.length === 0,
        imported: result.imported,
        updated: result.updated,
        total: result.imported + result.updated,
        errors: result.errors
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error("Import error:", errorMessage);
      res.status(400).json({ error: "Invalid import request" });
    }
  });

  // Import general settings
  app.post("/api/admin/import/settings", requireAuth, async (req, res) => {
    try {
      const importRequest = importSettingsRequestSchema.parse(req.body);
      const updatedSettings = await storage.updateGeneralSettings(importRequest.settings);
      
      res.json({
        success: true,
        settings: updatedSettings
      });
    } catch (error) {
      console.error("Settings import error:", error);
      res.status(400).json({ error: "Invalid settings import request" });
    }
  });

  // Import rules (Old route kept for compatibility but it clears all rules)
  app.post("/api/admin/import", requireAuth, async (req, res) => {
    try {
      const { rules } = req.body;
      if (!Array.isArray(rules)) {
        res.status(400).json({ error: "Invalid rules format" });
        return;
      }

      // Prepare rules for import (without validation)
      const rulesForImport = rules.map(rule => ({
        matcher: rule.matcher,
        targetUrl: rule.targetUrl || "",
        infoText: rule.infoText || "",
        redirectType: rule.redirectType || "partial",
        autoRedirect: rule.autoRedirect ?? false,
      }));

      // Clear existing rules and import new ones
      await storage.clearAllRules();
      for (const rule of rulesForImport) {
        await storage.createUrlRule(rule);
      }

      res.json({ success: true, imported: rulesForImport.length });
    } catch (error) {
      console.error("Import error:", error);
      if (error instanceof Error) {
        res.status(400).json({ error: error.message });
      } else {
        res.status(500).json({ error: "Import fehlgeschlagen" });
      }
    }
  });

  // Export settings
  app.post("/api/admin/export-settings", requireAuth, async (_req, res) => {
    try {
      const settings = await storage.getGeneralSettings();
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', 'attachment; filename="settings.json"');
      res.send(JSON.stringify(settings, null, 2));
    } catch (error) {
      console.error("Settings export error:", error);  
      res.status(500).json({ error: "Settings Export fehlgeschlagen" });
    }
  });

  // Import settings
  app.post("/api/admin/import-settings", requireAuth, async (req, res) => {
    try {
      const settings = req.body;
      await storage.updateGeneralSettings(settings);
      res.json({ success: true });
    } catch (error) {
      console.error("Settings import error:", error);
      res.status(500).json({ error: "Settings Import fehlgeschlagen" });
    }
  });

  // General Settings (accessible for UI configuration)
  // Move settings endpoint outside admin middleware since it doesn't need auth
  app.get("/api/settings", async (_req, res) => {
    try {
      const settings = await storage.getGeneralSettings();
      res.json(settings);
    } catch (error) {
      console.error("Get settings error:", error);
      res.status(500).json({ error: "Failed to fetch settings" });
    }
  });

  app.put("/api/admin/settings", requireAuth, async (req, res) => {
    try {
      const settingsData = insertGeneralSettingsSchema.parse(req.body);
      const settings = await storage.updateGeneralSettings(settingsData);
      res.json(settings);
    } catch (error) {
      console.error("Update settings error:", error);
      
      // If it's a Zod validation error, return the specific validation messages
      if (error instanceof z.ZodError) {
        const zodValidationErrors = (error.errors || []).map(err => ({
          field: err.path.join('.'),
          message: err.message
        }));
        
        res.status(400).json({ 
          error: "Validierungsfehler",
          validationErrors: zodValidationErrors,
          details: zodValidationErrors.map(e => `${e.field}: ${e.message}`).join(', ')
        });
      } else {
        res.status(400).json({ error: "Ungültige Einstellungsdaten" });
      }
    }
  });

  // Local File Upload Route for Logo
  const localUploadService = new LocalFileUploadService();
  const upload = localUploadService.getMulterConfig();
  
  // Custom upload config for imports (JSON, CSV, Excel)
  const uploadDir = process.env.LOCAL_UPLOAD_PATH || './data/uploads';

  // Ensure upload directory exists for imports
  if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
  }

  const importUpload = multer({
    storage: multer.diskStorage({
      destination: (_req, _file, cb) => cb(null, uploadDir),
      filename: (_req, file, cb) => cb(null, `${createHash('md5').update(Math.random().toString()).digest('hex')}${path.extname(file.originalname)}`)
    }),
    limits: { fileSize: 50 * 1024 * 1024 }, // 50MB
    fileFilter: (_req, file, cb) => {
      // Allow specific MIME types or extensions
      const allowedTypes = [
        'application/json',
        'text/csv',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // xlsx
        'application/vnd.ms-excel', // xls
        'application/csv',
        'text/plain' // often used for csv
      ];
      // Also check extensions as fallback since MIME types can vary
      const allowedExts = ['.json', '.csv', '.xlsx', '.xls'];
      const ext = path.extname(file.originalname).toLowerCase();

      if (allowedTypes.includes(file.mimetype) || allowedExts.includes(ext)) {
        cb(null, true);
      } else {
        cb(new Error('Invalid file type. Only JSON, CSV and Excel files are allowed.'));
      }
    }
  });

  app.post("/api/admin/logo/upload", requireAuth, upload.single('file'), async (req, res) => {
    try {
      if (!req.file) {
        res.status(400).json({ error: "No file uploaded" });
        return;
      }

      // Explicitly register file in cache (if optimization enabled)
      localUploadService.registerFile(req.file.filename);

      const fileUrl = localUploadService.getFileUrl(req.file.filename);
      console.log("File uploaded successfully:", fileUrl);

      res.json({
        uploadURL: fileUrl,
        filename: req.file.filename,
        originalName: req.file.originalname
      });
    } catch (error) {
      console.error("Local file upload error:", error);
      res.status(500).json({ error: "Failed to upload file", details: error instanceof Error ? error.message : String(error) });
    }
  });

  app.put("/api/admin/logo", requireAuth, async (req, res) => {
    try {
      if (!req.body.logoUrl) {
        res.status(400).json({ error: "logoUrl is required" });
        return;
      }

      const logoPath = req.body.logoUrl; // Use the URL directly for local files

      console.log("Logo update - received logoUrl:", req.body.logoUrl);
      console.log("Logo update - using logoPath:", logoPath);

      // Get current settings to check for existing logo file
      const currentSettings = await storage.getGeneralSettings();
      const oldLogoUrl = currentSettings.headerLogoUrl;

      // If there's an old logo file, delete it before setting the new one
      if (oldLogoUrl && oldLogoUrl.startsWith('/uploads/') && oldLogoUrl !== logoPath) {
        const oldFilename = oldLogoUrl.replace('/uploads/', '');
        const oldFileDeleted = localUploadService.deleteFile(oldFilename);
        console.log(`Old logo file deletion attempt for ${oldFilename}:`, oldFileDeleted ? 'success' : 'failed');
      }

      console.log("Logo update - current settings has headerLogoUrl:", !!currentSettings.headerLogoUrl);

      const updatedSettings = await storage.updateGeneralSettings({
        headerLogoUrl: logoPath,
      } as InsertGeneralSettings);

      console.log("Logo update - updated settings has headerLogoUrl:", !!updatedSettings.headerLogoUrl);

      res.json({
        success: true,
        logoPath: logoPath,
        settings: updatedSettings
      });
    } catch (error) {
      console.error("Logo update error:", error);
      res.status(500).json({ error: "Failed to update logo" });
    }
  });

  // Delete logo endpoint
  app.delete("/api/admin/logo", requireAuth, async (_req, res) => {
    try {
      // Get current settings to find the logo file
      const currentSettings = await storage.getGeneralSettings();
      const logoUrl = currentSettings.headerLogoUrl;

      // If there's no logo URL, just return success - nothing to delete
      if (!logoUrl) {
        console.log("No logo to delete - headerLogoUrl is already empty");
        res.json({
          success: true,
          message: "Logo already deleted"
        });
        return;
      }

      // Only try to delete the physical file if it's a local upload
      if (logoUrl.startsWith('/uploads/')) {
        const filename = logoUrl.replace('/uploads/', '');
        console.log(`Attempting to delete logo file: ${filename} from URL: ${logoUrl}`);
        
        // Try to delete the file - success or failure doesn't matter for the API response
        // as the important thing is removing the logo URL from settings
        const fileDeleted = localUploadService.deleteFile(filename);
        console.log(`Logo file deletion attempt for ${filename}:`, fileDeleted ? 'success' : 'file not found (already deleted)');
      } else {
        console.log(`Logo URL is not a local file: ${logoUrl}`);
      }

      // Update settings to explicitly remove the logo URL by setting it to null
      const updatedSettings = await storage.updateGeneralSettings({
        headerLogoUrl: null
      } as any);
      
      console.log("Logo deletion - settings updated, headerLogoUrl removed:", !updatedSettings.headerLogoUrl);

      res.json({
        success: true,
        message: "Logo successfully deleted"
      });
    } catch (error) {
      console.error("Logo delete error:", error);
      res.status(500).json({ error: "Failed to delete logo" });
    }
  });

  // Serve local uploaded files
  app.get("/uploads/:filename", (req, res) => {
    const filename = req.params.filename;
    const uploadPath = process.env.LOCAL_UPLOAD_PATH || './data/uploads';
    const filePath = path.join(uploadPath, filename);
    
    if (localUploadService.fileExists(filename)) {
      res.sendFile(path.resolve(filePath));
    } else {
      res.status(404).json({ error: "File not found" });
    }
  });

  // --- New Import/Export Routes ---

  // Preview import file
  app.post("/api/admin/import/preview", requireAuth, importUpload.single('file'), async (req, res) => {
    try {
      if (!req.file) {
        res.status(400).json({ error: "No file uploaded" });
        return;
      }

      const buffer = await import('fs/promises').then(fs => fs.readFile(req.file!.path));
      const rawRules = ImportExportService.parseFile(buffer, req.file.originalname);

      const settings = await storage.getGeneralSettings();
      // Use getCleanUrlRules to avoid passing internal cache properties, although UrlRule type is compatible
      const existingRules = await storage.getCleanUrlRules();

      const parsedResults = ImportExportService.normalizeRules(
        rawRules,
        { encodeImportedUrls: settings.encodeImportedUrls },
        existingRules
      );

      // Clean up temp file
      await import('fs/promises').then(fs => fs.unlink(req.file!.path)).catch(console.error);

      // If "all" query param is set, return all results, otherwise limit
      const showAll = req.query.all === 'true';
      const limit = showAll ? parsedResults.length : IMPORT_PREVIEW_LIMIT;
      const previewResults = parsedResults.slice(0, limit);

      res.json({
        total: parsedResults.length,
        limit: limit,
        isLimited: parsedResults.length > limit,
        preview: previewResults, // Limited subset for UI (or full if requested)
        all: showAll ? parsedResults : undefined, // Full set for import logic (only if requested)
        counts: {
          new: parsedResults.filter(r => r.status === 'new').length,
          update: parsedResults.filter(r => r.status === 'update').length,
          invalid: parsedResults.filter(r => r.status === 'invalid').length
        }
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error("Import preview error:", errorMessage);
      res.status(400).json({ error: errorMessage });
    }
  });

  // Export rules as CSV/Excel
  app.get("/api/admin/export/rules", requireAuth, async (req, res) => {
    try {
      const format = (req.query.format as string || 'json').toLowerCase();
      // Use getCleanUrlRules to ensure internal cache properties are stripped
      const rules = await storage.getCleanUrlRules();

      if (format === 'csv') {
        const csv = ImportExportService.generateCSV(rules);
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', 'attachment; filename="rules.csv"');
        res.send(csv);
      } else if (format === 'xlsx' || format === 'excel') {
        const buffer = ImportExportService.generateExcel(rules);
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', 'attachment; filename="rules.xlsx"');
        res.send(buffer);
      } else {
        // Default to JSON
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Content-Disposition', 'attachment; filename="rules.json"');
        res.send(JSON.stringify(rules, null, 2));
      }
    } catch (error) {
      console.error("Export error:", error instanceof Error ? error.message : "Unknown error");
      res.status(500).json({ error: "Failed to export rules" });
    }
  });


  const httpServer = createServer(app);
  return httpServer;
}
