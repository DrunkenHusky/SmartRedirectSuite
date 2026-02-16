import { Router } from "express";
import { bruteForceProtection, recordLoginFailure, resetLoginAttempts, resetAllLoginAttempts, getBlockedIps, blockIp } from "../middleware/bruteForce";
import { storage } from "../storage";
import { z } from "zod";
import { createHash, timingSafeEqual } from "crypto";
import { requireAuth } from "../middleware/auth";
import { asyncHandler } from "../middleware/errorHandler";
import {
  insertGeneralSettingsSchema,
  type InsertUrlRule,
  exportRequestSchema,
  importSettingsRequestSchema,
  type InsertGeneralSettings,
} from "@shared/schema";
import { urlRuleSchemaWithValidation, updateUrlRuleSchemaWithValidation } from "@shared/validation";
import { ImportExportService } from "../import-export";
import { LocalFileUploadService } from "../localFileUpload";
import multer from "multer";
import fsSync from "fs";
import fs from "fs/promises";
import { utils, write } from '@e965/xlsx';
import path from "path";
import { findMatchingRule } from "@shared/ruleMatching";
import { traceUrlGeneration } from "@shared/url-trace";
import { RULE_MATCHING_CONFIG } from "@shared/constants";

export const adminRoutes = Router();

// Admin-Passwort aus Umgebungsvariable oder Standard
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "Password1";

// Import Preview Limit from environment variable (default 1000)
const IMPORT_PREVIEW_LIMIT = parseInt(process.env.IMPORT_PREVIEW_LIMIT || "1000", 10);

const localUploadService = new LocalFileUploadService();
const upload = localUploadService.getMulterConfig();

const uploadDir = process.env.LOCAL_UPLOAD_PATH || './data/uploads';

// Ensure upload directory exists for imports
if (!fsSync.existsSync(uploadDir)) {
  fsSync.mkdirSync(uploadDir, { recursive: true });
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

// Admin-Authentifizierung
adminRoutes.post("/login", bruteForceProtection, asyncHandler(async (req, res) => {
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
      await new Promise<void>((resolve, reject) => {
          req.session.regenerate((err) => {
              if (err) reject(err);
              else resolve();
          });
      });

      // Set session data and force save for file store
      req.session.isAdminAuthenticated = true;
      req.session.adminLoginTime = Date.now();

      // For file store, explicitly save the session
      await new Promise<void>((resolve, reject) => {
        req.session.save(async (saveErr) => {
          if (saveErr) {
            reject(saveErr);
            return;
          }
          await resetLoginAttempts(ip);
          res.json({ success: true, sessionId: req.sessionID });
          resolve();
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
}));

// Check admin authentication status
adminRoutes.get("/status", (req, res) => {
  res.json({
    isAuthenticated: !!req.session?.isAdminAuthenticated,
    loginTime: req.session?.adminLoginTime
  });
});

// Admin logout
adminRoutes.post("/logout", (req, res) => {
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
adminRoutes.post("/force-cache-rebuild", requireAuth, asyncHandler(async (_req, res) => {
  await storage.forceCacheRebuild();
  res.json({ success: true, message: "Cache rebuild triggered successfully" });
}));

// URL-Regeln verwalten
adminRoutes.get("/rules", requireAuth, asyncHandler(async (_req, res) => {
  const rules = await storage.getUrlRules();
  res.json(rules);
}));

// Get paginated URL rules with search and sort
adminRoutes.get("/rules/paginated", requireAuth, asyncHandler(async (req, res) => {
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
}));

adminRoutes.post("/rules", requireAuth, asyncHandler(async (req, res) => {
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
}));

adminRoutes.put("/rules/:id", requireAuth, asyncHandler(async (req, res) => {
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
}));

adminRoutes.delete("/rules/:id", requireAuth, asyncHandler(async (req, res) => {
    const { id } = req.params;
    const deleted = await storage.deleteUrlRule(id);

    if (!deleted) {
      res.status(404).json({ error: "Rule not found" });
      return;
    }

    res.json({ success: true });
}));

// Bulk delete rules
adminRoutes.delete("/bulk-delete-rules", requireAuth, asyncHandler(async (req, res) => {
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
}));

// Delete all rules
adminRoutes.delete("/all-rules", requireAuth, asyncHandler(async (_req, res) => {
    console.log("Deleting all rules request received");
    await storage.clearAllRules();
    // Ensure cache is rebuilt/cleared properly
    await storage.forceCacheRebuild();

    console.log("All rules deleted successfully");
    res.json({ success: true, message: "Alle Regeln wurden erfolgreich gelöscht." });
}));

// Delete all statistics
adminRoutes.delete("/all-stats", requireAuth, asyncHandler(async (_req, res) => {
    console.log("Deleting all statistics request received");
    await storage.clearAllTracking();

    console.log("All statistics deleted successfully");
    res.json({ success: true, message: "Alle Statistiken wurden erfolgreich gelöscht." });
}));

// Get all blocked IPs
adminRoutes.get("/blocked-ips", requireAuth, asyncHandler(async (_req, res) => {
    const ips = await getBlockedIps();
    res.json(ips);
}));

// Manually block an IP
adminRoutes.post("/blocked-ips", requireAuth, asyncHandler(async (req, res) => {
    // Use regex for IP validation to be compatible with different zod versions
    const ipSchema = z.string().regex(/^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/);
    const { ip } = z.object({ ip: ipSchema }).parse(req.body);
    await blockIp(ip);
    res.json({ success: true, message: `IP ${ip} wurde blockiert.` });
}));

// Unblock specific IP
adminRoutes.delete("/blocked-ips/:ip", requireAuth, asyncHandler(async (req, res) => {
    const { ip } = req.params;
    const ipSchema = z.string().regex(/^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/);
    // Basic IP validation
    if (!ipSchema.safeParse(ip).success) {
        res.status(400).json({ error: "Ungültige IP-Adresse" });
        return;
    }

    await resetLoginAttempts(ip);
    res.json({ success: true, message: `IP ${ip} wurde entsperrt.` });
}));

// Export blocked IPs as Excel
adminRoutes.get("/export/blocked-ips", requireAuth, asyncHandler(async (_req, res) => {
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
}));

// Clear all blocked IPs
adminRoutes.delete("/blocked-ips", requireAuth, asyncHandler(async (_req, res) => {
    console.log("Clearing all blocked IPs request received");
    await resetAllLoginAttempts();

    console.log("All blocked IPs cleared successfully");
    res.json({ success: true, message: "Alle blockierten IP-Adressen wurden erfolgreich gelöscht." });
}));

// Statistiken
adminRoutes.get("/stats/all", requireAuth, asyncHandler(async (req, res) => {
    const timeRange = req.query.timeRange as '24h' | '7d' | 'all' | undefined;
    const stats = await storage.getTrackingStats();
    const topUrls = await storage.getTopUrls(10, timeRange);

    res.json({
      stats,
      topUrls,
    });
}));

// Top 100 URLs
adminRoutes.get("/stats/top100", requireAuth, asyncHandler(async (req, res) => {
    const timeRange = req.query.timeRange as '24h' | '7d' | 'all' | undefined;
    const topUrls = await storage.getTopUrls(100, timeRange);

    res.json(topUrls);
}));

// Top Referrers
adminRoutes.get("/stats/top-referrers", requireAuth, asyncHandler(async (req, res) => {
    const timeRange = req.query.timeRange as '24h' | '7d' | 'all' | undefined;
    const topReferrers = await storage.getTopReferrers(10, timeRange);
    res.json(topReferrers);
}));

// Satisfaction Trend
adminRoutes.get("/stats/trend", requireAuth, asyncHandler(async (req, res) => {
    const days = parseInt(req.query.days as string) || 30;
    const aggregation = (req.query.aggregation as 'day' | 'week' | 'month') || 'day';
    const trend = await storage.getSatisfactionTrend(days, aggregation);
    res.json(trend);
}));

// Comprehensive tracking entries with search and sort
adminRoutes.get("/stats/entries", requireAuth, asyncHandler(async (req, res) => {
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
}));

// Paginated statistics endpoints for improved performance with large datasets
adminRoutes.get("/stats/entries/paginated", requireAuth, asyncHandler(async (req, res) => {
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
    let feedbackFilter: 'all' | 'OK' | 'NOK' | 'auto-redirect' | 'empty' = 'all';
    if (req.query.feedbackFilter && ['all', 'OK', 'NOK', 'auto-redirect', 'empty'].includes(req.query.feedbackFilter as string)) {
      feedbackFilter = req.query.feedbackFilter as 'all' | 'OK' | 'NOK' | 'auto-redirect' | 'empty';
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
}));

adminRoutes.get("/stats/top100/paginated", requireAuth, asyncHandler(async (req, res) => {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 50;
    const timeRange = req.query.timeRange as '24h' | '7d' | 'all' | undefined;

    const result = await storage.getTopUrlsPaginated(page, limit, timeRange);
    res.json(result);
}));

// Export-Funktionalität
adminRoutes.post("/export", requireAuth, asyncHandler(async (req, res) => {
    const exportRequest = exportRequestSchema.parse(req.body);
    const settings = await storage.getGeneralSettings();

    if (exportRequest.type === 'statistics') {
      const trackingData = await storage.getTrackingData(exportRequest.timeRange);

      if (exportRequest.format === 'csv') {
        const includeReferrer = settings.enableReferrerTracking;
        // CSV-Export
        const csvHeader = includeReferrer
          ? 'ID,Alte URL,Neue URL,Pfad,Referrer,Zeitstempel,User-Agent,Regel ID,Feedback,Qualität,Benutzervorschlag,Strategie,Globale Regeln\n'
          : 'ID,Alte URL,Neue URL,Pfad,Zeitstempel,User-Agent,Regel ID,Feedback,Qualität,Benutzervorschlag,Strategie,Globale Regeln\n';

        const csvData = trackingData.map(track => {
          // Prepare new fields
          const ruleId = track.ruleId || (track.ruleIds && track.ruleIds.length > 0 ? track.ruleIds.join(';') : '') || '';
          const feedback = track.feedback || '';
          const quality = track.matchQuality !== undefined ? track.matchQuality : 0;
          const userProposedUrl = track.userProposedUrl || '';
          const strategy = track.redirectStrategy || '';
          const globalRules = (track.appliedGlobalRules || []).map(r => r.description).join('; ');

          if (includeReferrer) {
            return `"${track.id}","${track.oldUrl}","${(track as any).newUrl || ''}","${track.path}","${track.referrer || ''}","${track.timestamp}","${track.userAgent || ''}","${ruleId}","${feedback}","${quality}","${userProposedUrl}"`;
          } else {
            return `"${track.id}","${track.oldUrl}","${(track as any).newUrl || ''}","${track.path}","${track.timestamp}","${track.userAgent || ''}","${ruleId}","${feedback}","${quality}","${userProposedUrl}"`;
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
}));

// Import-Funktionalität
adminRoutes.post("/import/rules", requireAuth, asyncHandler(async (req, res) => {
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
}));

// Import general settings
adminRoutes.post("/import/settings", requireAuth, asyncHandler(async (req, res) => {
    const importRequest = importSettingsRequestSchema.parse(req.body);
    const updatedSettings = await storage.updateGeneralSettings(importRequest.settings);

    res.json({
      success: true,
      settings: updatedSettings
    });
}));

// Import rules (Old route kept for compatibility but it clears all rules)
adminRoutes.post("/import", requireAuth, asyncHandler(async (req, res) => {
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
      discardQueryParams: rule.discardQueryParams ?? false,
      forwardQueryParams: rule.forwardQueryParams ?? false,
      keptQueryParams: rule.keptQueryParams || [],
      staticQueryParams: rule.staticQueryParams || [],
      searchAndReplace: rule.searchAndReplace || [],
    }));

    // Clear existing rules and import new ones
    await storage.clearAllRules();
    for (const rule of rulesForImport) {
      await storage.createUrlRule(rule);
    }

    res.json({ success: true, imported: rulesForImport.length });
}));

// Export settings
adminRoutes.post("/export-settings", requireAuth, asyncHandler(async (_req, res) => {
    const settings = await storage.getGeneralSettings();
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', 'attachment; filename="settings.json"');
    res.send(JSON.stringify(settings, null, 2));
}));

// Import settings
adminRoutes.post("/import-settings", requireAuth, asyncHandler(async (req, res) => {
    const settings = req.body;
    await storage.updateGeneralSettings(settings);
    res.json({ success: true });
}));

adminRoutes.put("/settings", requireAuth, asyncHandler(async (req, res) => {
    const settingsData = insertGeneralSettingsSchema.parse(req.body);
    const settings = await storage.updateGeneralSettings(settingsData);
    res.json(settings);
}));

adminRoutes.post("/logo/upload", requireAuth, upload.single('file'), asyncHandler(async (req, res) => {
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
}));

adminRoutes.put("/logo", requireAuth, asyncHandler(async (req, res) => {
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
}));

// Delete logo endpoint
adminRoutes.delete("/logo", requireAuth, asyncHandler(async (_req, res) => {
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
}));

// Preview import file
adminRoutes.post("/import/preview", requireAuth, importUpload.single('file'), asyncHandler(async (req, res) => {
    if (!req.file) {
      res.status(400).json({ error: "No file uploaded" });
      return;
    }

    const buffer = await fs.readFile(req.file!.path);
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
    await fs.unlink(req.file!.path).catch(console.error);

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
}));

// Extract URLs tool endpoint
adminRoutes.post("/tools/extract-urls", requireAuth, importUpload.single('file'), asyncHandler(async (req, res) => {
    if (!req.file) {
      res.status(400).json({ error: "No file uploaded" });
      return;
    }

    const buffer = await fs.readFile(req.file!.path);

    const result = ImportExportService.extractUrls(buffer, req.file.originalname, 1000);

    await fs.unlink(req.file!.path).catch(console.error);

    res.json(result);
}));

// Export rules as CSV/Excel
adminRoutes.get("/export/rules", requireAuth, asyncHandler(async (req, res) => {
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
}));

// Validation Endpoint
adminRoutes.post("/validate-urls", requireAuth, asyncHandler(async (req, res) => {
    const { urls } = z.object({ urls: z.array(z.string()) }).parse(req.body);
    const settings = await storage.getGeneralSettings();
    const config = { ...RULE_MATCHING_CONFIG, CASE_SENSITIVITY_PATH: settings.caseSensitiveLinkDetection };
    const rules = await storage.getProcessedUrlRules(config);

    const results = urls.map(url => {
        let matchDetails = null;
        try {
          matchDetails = findMatchingRule(url, rules, config);
        } catch (e) {
          // Ignore error, treat as no match or invalid URL
        }

        let traceResult;
        if (matchDetails?.rule) {
            traceResult = traceUrlGeneration(url, matchDetails.rule, settings.defaultNewDomain, settings);
        } else {
             const dummyRule = {
                 id: 0, matcher: '', targetUrl: '', redirectType: 'fallback',
                 order: 0, autoRedirect: false, createdAt: ''
             };
             traceResult = traceUrlGeneration(url, dummyRule, settings.defaultNewDomain, settings);
        }

        return {
            url,
            traceResult,
            matchDetails: matchDetails ? {
                quality: matchDetails.quality,
                level: matchDetails.level,
                score: matchDetails.score,
                ruleId: matchDetails.rule.id,
                rule: matchDetails.rule
            } : null
        };
    });

    res.json(results);
}));
