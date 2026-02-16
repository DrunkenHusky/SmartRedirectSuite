import { Router } from "express";
import { ImportExportService } from "../import-export";
import { storage } from "../storage";
import { asyncHandler } from "../middleware/errorHandler";
import path from "path";
import fs from "fs/promises";
import { LocalFileUploadService } from "../localFileUpload";

export const systemRoutes = Router();

// Health check endpoint
systemRoutes.get("/api/health", asyncHandler(async (_req, res) => {
  const startTime = Date.now();
  const uptime = process.uptime();
  const memoryUsage = process.memoryUsage();

  // Check filesystem by verifying data directory exists
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
}));

// Serve sample import file (Dynamic)
const SAMPLE_RULES = [{
  id: "sample-id",
  matcher: "/alte-seite",
  targetUrl: "https://neue-seite.de/ziel",
  redirectType: "partial",
  infoText: "Beispiel Migration",
  autoRedirect: false,
  discardQueryParams: false,
  keptQueryParams: [],
  staticQueryParams: [{ key: "source", value: "import" }],
  forwardQueryParams: true,
  searchAndReplace: [{ search: "alt", replace: "neu", caseSensitive: false }],
  createdAt: new Date().toISOString()
} as any];

systemRoutes.get("/sample-rules-import.json", (_req, res) => {
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Content-Disposition', 'attachment; filename="sample-rules-import.json"');
  res.send(JSON.stringify(SAMPLE_RULES, null, 2));
});

systemRoutes.get("/sample-rules-import.csv", (_req, res) => {
  const csv = ImportExportService.generateCSV(SAMPLE_RULES);
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename="sample-rules-import.csv"');
  res.send(csv);
});

systemRoutes.get("/sample-rules-import.xlsx", (_req, res) => {
  const buffer = ImportExportService.generateExcel(SAMPLE_RULES);
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', 'attachment; filename="sample-rules-import.xlsx"');
  res.send(buffer);
});

// Serve local uploaded files
const localUploadService = new LocalFileUploadService();
systemRoutes.get("/uploads/:filename", (req, res) => {
  const filename = req.params.filename;
  const uploadPath = process.env.LOCAL_UPLOAD_PATH || './data/uploads';
  const filePath = path.join(uploadPath, filename);

  if (localUploadService.fileExists(filename)) {
    res.sendFile(path.resolve(filePath));
  } else {
    res.status(404).json({ error: "File not found" });
  }
});
