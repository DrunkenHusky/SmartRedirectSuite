import { Express } from "express";
import { createServer, type Server } from "http";
import { adminRoutes } from "./admin";
import { publicRoutes } from "./public";
import { systemRoutes } from "./system";
import { APPLICATION_METADATA } from "@shared/appMetadata";

export async function registerRoutes(app: Express): Promise<Server> {
  // Global Headers
  app.use((_, res, next) => {
    res.setHeader("X-App-Name", APPLICATION_METADATA.displayName);
    res.setHeader("X-App-Version", APPLICATION_METADATA.version);
    next();
  });

  // Mount routes
  // Admin routes (prefixed with /api/admin)
  app.use("/api/admin", adminRoutes);

  // Public routes (prefixed with /api)
  app.use("/api", publicRoutes);

  // System routes (mixed prefixes, so mounted at root)
  app.use("/", systemRoutes);

  const httpServer = createServer(app);
  return httpServer;
}
