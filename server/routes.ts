import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { bruteForceMiddleware, loginAttemptTracker } from "./middleware/bruteForce";
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
import path from "path";



// Extend Express Session interface
declare module 'express-session' {
  interface SessionData {
    isAdminAuthenticated?: boolean;
    adminLoginTime?: number;
  }
}

// Admin-Passwort aus Umgebungsvariable oder Standard
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "Password1";

// Middleware to check admin authentication
const requireAuth = (req: any, res: any, next: any) => {
  if (!req.session?.isAdminAuthenticated) {
    return res.status(403).json({ error: "Access denied. Please log in to the admin panel." });
  }
  next();
};

export async function registerRoutes(app: Express): Promise<Server> {
  
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
  
  // URL-Tracking endpoint
  app.post("/api/track", async (req, res) => {
    try {
      const trackingData = insertUrlTrackingSchema.parse(req.body);
      const tracking = await storage.trackUrlAccess(trackingData);
      res.json(tracking);
    } catch (error) {
      console.error("Tracking error:", error);
      res.status(400).json({ error: "Invalid tracking data" });
    }
  });

  // URL-Regel Matching endpoint
  app.post("/api/check-rules", async (req, res) => {
    try {
      const { path } = z.object({ path: z.string() }).parse(req.body);
      const rules = await storage.getUrlRules();
      
      // Find matching rule (case-insensitive) - match most specific first
      // Sort rules by matcher length in descending order to prioritize more specific matches
      const sortedRules = [...rules].sort((a, b) => b.matcher.length - a.matcher.length);
      const matchingRule = sortedRules.find(rule => 
        path.toLowerCase().includes(rule.matcher.toLowerCase())
      );
      
      res.json({
        rule: matchingRule || null,
        hasMatch: !!matchingRule,
      });
    } catch (error) {
      console.error("Rule check error:", error);
      res.status(400).json({ error: "Invalid request" });
    }
  });

  // Admin-Authentifizierung
  app.post("/api/admin/login", bruteForceMiddleware, async (req, res) => {
    const ip = req.ip || req.connection.remoteAddress || "unknown";
    try {
      // Simple password extraction without validation first
      const { password } = z.object({ password: z.string() }).parse(req.body);

      // Check password match first
      if (password === ADMIN_PASSWORD) {
        // Check if session exists, if not return error
        if (!req.session) {
          console.error("Session not available during login");
          res.status(500).json({ error: "Session error" });
          return;
        }

        // Set session data and force save for file store
        req.session.isAdminAuthenticated = true;
        req.session.adminLoginTime = Date.now();

        // Successful login: reset failed attempts
        loginAttemptTracker.reset(ip);

        // For file store, explicitly save the session
        req.session.save((err) => {
          if (err) {
            console.error("Session save error:", err);
            res.status(500).json({ error: "Session save error" });
            return;
          }
          res.json({ success: true, sessionId: req.sessionID });
        });
      } else {
        // Record failed attempt
        loginAttemptTracker.recordFailure(ip);
        res.status(401).json({ error: "Falsches Passwort" });
      }
    } catch (error) {
      console.error("Login error:", error);
      // Record failure for any error during login
      loginAttemptTracker.recordFailure(ip);

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
      const search = req.query.search as string;
      const sortBy = req.query.sortBy as string || 'createdAt';
      const sortOrder = (req.query.sortOrder as 'asc' | 'desc') || 'desc';
      
      const result = await storage.getUrlRulesPaginated(page, limit, search, sortBy, sortOrder);
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
      console.error("Create rule error:", error);
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
      console.error("Update rule error:", error);
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

  // Comprehensive tracking entries with search and sort
  app.get("/api/admin/stats/entries", requireAuth, async (req, res) => {
    try {
      const { query = '', sortBy = 'timestamp', sortOrder = 'desc' } = req.query;
      const entries = await storage.searchTrackingEntries(
        query as string, 
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
      const search = req.query.search as string || undefined;
      const sortBy = req.query.sortBy as string || 'timestamp';
      const sortOrder = req.query.sortOrder as 'asc' | 'desc' || 'desc';
      
      const result = await storage.getTrackingEntriesPaginated(page, limit, search, sortBy, sortOrder);
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
      
      if (exportRequest.type === 'statistics') {
        const trackingData = await storage.getTrackingData(exportRequest.timeRange);
        
        if (exportRequest.format === 'csv') {
          // CSV-Export without referrer
          const csvHeader = 'ID,Alte URL,Neue URL,Pfad,Zeitstempel,User-Agent\n';
          const csvData = trackingData.map(track =>
            `"${track.id}","${track.oldUrl}","${(track as any).newUrl || ''}","${track.path}","${track.timestamp}","${track.userAgent || ''}"`
          ).join('\n');
          
          res.setHeader('Content-Type', 'text/csv');
          res.setHeader('Content-Disposition', 'attachment; filename="statistics.csv"');
          res.send(csvHeader + csvData);
        } else {
          // JSON-Export
          res.setHeader('Content-Type', 'application/json');
          res.setHeader('Content-Disposition', 'attachment; filename="statistics.json"');
          res.json(trackingData);
        }
      } else if (exportRequest.type === 'rules') {
        const rules = await storage.getUrlRules();
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Content-Disposition', 'attachment; filename="rules.json"');
        res.json(rules);
      } else if (exportRequest.type === 'settings') {
        const settings = await storage.getGeneralSettings();
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Content-Disposition', 'attachment; filename="settings.json"');
        res.json(settings);
      }
    } catch (error) {
      console.error("Export error:", error);
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
      console.error("Import error:", error);
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

  // Import rules
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
      res.json(settings);
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
        const validationErrors = error.errors.map(err => ({
          field: err.path.join('.'),
          message: err.message
        }));
        
        res.status(400).json({ 
          error: "Validierungsfehler",
          validationErrors: validationErrors,
          details: validationErrors.map(e => `${e.field}: ${e.message}`).join(', ')
        });
      } else {
        res.status(400).json({ error: "Ungültige Einstellungsdaten" });
      }
    }
  });

  // Local File Upload Route for Logo
  const localUploadService = new LocalFileUploadService();
  const upload = localUploadService.getMulterConfig();
  
  app.post("/api/admin/logo/upload", requireAuth, upload.single('file'), async (req, res) => {
    try {
      if (!req.file) {
        res.status(400).json({ error: "No file uploaded" });
        return;
      }

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



  const httpServer = createServer(app);
  return httpServer;
}
