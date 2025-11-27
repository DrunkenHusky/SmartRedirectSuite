import 'dotenv/config';
import express, { type Request, Response, NextFunction } from "express";
import session from "express-session";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { FileSessionStore } from "./fileSessionStore";

const app = express();
app.disable('etag');
app.disable('x-powered-by'); // Hide Express header for security

app.use('/api', (_req, res, next) => {
  res.set('Cache-Control', 'no-store');
  next();
});

// Trust proxy settings for production deployment behind reverse proxies
// This is essential for proper HTTPS detection and secure cookies
app.set('trust proxy', true);

// Configure body parsers with specific limits
const defaultLimit = '1mb';
const importLimit = '500mb'; // Increased to 500mb as requested

// Middleware to select limit based on path
const jsonMiddleware = express.json({ limit: defaultLimit });
const largeJsonMiddleware = express.json({ limit: importLimit });
const urlEncodedMiddleware = express.urlencoded({ extended: false, limit: defaultLimit });
const largeUrlEncodedMiddleware = express.urlencoded({ extended: false, limit: importLimit });

app.use((req, res, next) => {
  // Apply larger limit for import routes
  if (req.path.startsWith('/api/admin/import') || req.path.startsWith('/api/admin/logo/upload')) {
    if (req.is('json')) {
      largeJsonMiddleware(req, res, next);
    } else {
      largeUrlEncodedMiddleware(req, res, next);
    }
  } else {
    // Default strict limit for all other routes
    if (req.is('json')) {
      jsonMiddleware(req, res, next);
    } else {
      urlEncodedMiddleware(req, res, next);
    }
  }
});

// Session configuration with improved file-based store
const sessionMiddleware = session({
  store: new FileSessionStore(),
  secret: process.env.SESSION_SECRET || 'url-migration-secret-key-change-in-production',
  resave: false, // Don't save session if unmodified
  saveUninitialized: false, // Don't create session until needed
  name: 'admin_session', // Use specific name for admin sessions
  cookie: {
    secure: process.env.NODE_ENV === 'production', // Secure in production
    httpOnly: true, // Prevent XSS attacks
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    sameSite: 'lax', // Use lax for better compatibility in development
    path: '/', // Ensure cookie is available for all paths
    // Add domain setting for production if needed
    ...(process.env.NODE_ENV === 'production' && process.env.COOKIE_DOMAIN && {
      domain: process.env.COOKIE_DOMAIN,
      sameSite: 'none' // Enable cross-origin in production
    })
  },
  rolling: true // Extend session on each request
});

// Security headers middleware for production
if (process.env.NODE_ENV === 'production') {
  app.use((req, res, next) => {
    // Force HTTPS in production
    if (req.header('x-forwarded-proto') !== 'https') {
      res.redirect(`https://${req.header('host')}${req.url}`);
      return;
    }
    
    // Set security headers
    res.set({
      'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
      'X-Frame-Options': 'SAMEORIGIN',
      'X-Content-Type-Options': 'nosniff',
      'Referrer-Policy': 'strict-origin-when-cross-origin',
      'Content-Security-Policy': "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https:; font-src 'self' data:; connect-src 'self';"
    });
    
    next();
  });
}

// Apply session middleware to all admin routes
app.use('/api/admin', sessionMiddleware);

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;

      // Sanitize logged body - remove sensitive fields and truncate large payloads
      if (capturedJsonResponse) {
        // Create a shallow copy to avoid modifying the original response
        const safeLogBody = { ...capturedJsonResponse };

        // Remove sensitive fields
        if (safeLogBody.sessionId) safeLogBody.sessionId = '***';
        if (safeLogBody.password) safeLogBody.password = '***';
        if (safeLogBody.token) safeLogBody.token = '***';

        // Don't log potentially huge rule lists
        if (Array.isArray(safeLogBody.rules) && safeLogBody.rules.length > 5) {
          safeLogBody.rules = `[${safeLogBody.rules.length} items]`;
        }

        const logString = JSON.stringify(safeLogBody);
        // Limit log length to prevent log flooding
        logLine += ` :: ${logString.length > 1000 ? logString.substring(0, 1000) + '...' : logString}`;
      }

      if (logLine.length > 150) { // Increased log limit slightly
        logLine = logLine.slice(0, 149) + "…";
      }

      log(logLine);
    }
  });

  next();
});

(async () => {
  const server = await registerRoutes(app);

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    // Only send response if headers haven't been sent yet
    if (!res.headersSent) {
      res.status(status).json({ message });
    }
    
    console.error('Server error:', err);
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  // ALWAYS serve the app on the port specified in the environment variable PORT
  // Other ports are firewalled. Default to 5000 if not specified.
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = parseInt(process.env.PORT || '5000', 10);
  server.listen({
    port,
    host: "0.0.0.0",
    reusePort: false,
  }, () => {
    log(`serving on port ${port}`);
  });
})();
