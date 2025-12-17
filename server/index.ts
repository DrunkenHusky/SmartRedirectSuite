import 'dotenv/config';
import express, { type Request, Response, NextFunction } from "express";
import session from "express-session";
import helmet from "helmet";
import { randomBytes } from "crypto";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { FileSessionStore } from "./fileSessionStore";
import { rateLimitMiddleware, adminRateLimitMiddleware, csrfCheck } from "./middleware/security";

const app = express();

// Security Warnings
if (!process.env.ADMIN_PASSWORD || process.env.ADMIN_PASSWORD === "Password1") {
  console.warn("WARNUNG: Sie verwenden das Standard-Passwort 'Password1'. Bitte setzen Sie die Umgebungsvariable ADMIN_PASSWORD.");
}

// Session Secret Configuration
const sessionSecret = process.env.SESSION_SECRET || randomBytes(64).toString('hex');

if (!process.env.SESSION_SECRET) {
  console.warn("WARNUNG: Keine SESSION_SECRET Umgebungsvariable gesetzt. Ein zufälliger Schlüssel wurde generiert.");
}

// Helmet Configuration
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "blob:", "https:"],
      fontSrc: ["'self'", "data:"],
      connectSrc: ["'self'"],
    },
  },
  crossOriginEmbedderPolicy: false,
}));

app.disable('etag');

app.use('/api', (_req, res, next) => {
  res.set('Cache-Control', 'no-store');
  next();
});

// Trust proxy settings for production
app.set('trust proxy', true);

// Logger middleware - MUST be before rate limiters to log blocked requests
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

      if (capturedJsonResponse) {
        const safeLogBody = { ...capturedJsonResponse };
        if (safeLogBody.sessionId) safeLogBody.sessionId = '***';
        if (safeLogBody.password) safeLogBody.password = '***';
        if (safeLogBody.token) safeLogBody.token = '***';
        if (Array.isArray(safeLogBody.rules) && safeLogBody.rules.length > 5) {
          safeLogBody.rules = `[${safeLogBody.rules.length} items]`;
        }

        const logString = JSON.stringify(safeLogBody);
        logLine += ` :: ${logString.length > 1000 ? logString.substring(0, 1000) + '...' : logString}`;
      }

      if (logLine.length > 150) {
        logLine = logLine.slice(0, 149) + "…";
      }

      log(logLine);
    }
  });

  next();
});

// Global API Rate Limiting
app.use('/api', rateLimitMiddleware);

// Configure body parsers
const defaultLimit = '1mb';
const importLimit = '500mb';

const jsonMiddleware = express.json({ limit: defaultLimit });
const largeJsonMiddleware = express.json({ limit: importLimit });
const urlEncodedMiddleware = express.urlencoded({ extended: false, limit: defaultLimit });
const largeUrlEncodedMiddleware = express.urlencoded({ extended: false, limit: importLimit });

app.use((req, res, next) => {
  if (req.path.startsWith('/api/admin/import') || req.path.startsWith('/api/admin/logo/upload')) {
    if (req.is('json')) {
      largeJsonMiddleware(req, res, next);
    } else {
      largeUrlEncodedMiddleware(req, res, next);
    }
  } else {
    if (req.is('json')) {
      jsonMiddleware(req, res, next);
    } else {
      urlEncodedMiddleware(req, res, next);
    }
  }
});

// Session configuration
const sessionStore = new FileSessionStore();
sessionStore.clear(() => {
  console.log("INFO: Alle existierenden Sitzungen wurden bereinigt.");
});

const sessionMiddleware = session({
  store: sessionStore,
  secret: sessionSecret,
  resave: false,
  saveUninitialized: false,
  name: 'admin_session',
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    sameSite: 'lax',
    path: '/',
    ...(process.env.NODE_ENV === 'production' && process.env.COOKIE_DOMAIN && {
      domain: process.env.COOKIE_DOMAIN,
      sameSite: 'none'
    })
  },
  rolling: true
});

// Force HTTPS in production
if (process.env.NODE_ENV === 'production' && !process.env.DISABLE_HTTPS_REDIRECT) {
  app.use((req, res, next) => {
    if (req.header('x-forwarded-proto') !== 'https') {
      res.redirect(`https://${req.header('host')}${req.url}`);
      return;
    }
    next();
  });
}

// Apply session middleware to all admin routes
app.use('/api/admin', sessionMiddleware);

// Apply extra rate limiting to admin routes (auth + brute force handled separately, this is for general admin actions)
app.use('/api/admin', adminRateLimitMiddleware);

// Apply CSRF protection to admin routes
app.use('/api/admin', csrfCheck);

(async () => {
  const server = await registerRoutes(app);

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";
    if (!res.headersSent) {
      res.status(status).json({ message });
    }
    console.error('Server error:', err);
  });

  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  const port = parseInt(process.env.PORT || '5000', 10);
  server.listen({
    port,
    host: "0.0.0.0",
    reusePort: false,
  }, () => {
    log(`serving on port ${port}`);
  });
})();
