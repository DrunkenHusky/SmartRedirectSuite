import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import express from 'express';
import session from 'express-session';

// Prepare isolated working directory with required data files
const repoDataDir = new URL('./data', import.meta.url);
const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'srs-test-'));
fs.mkdirSync(path.join(tempDir, 'data'), { recursive: true });
// Copy existing data files to temp directory
fs.cpSync(repoDataDir, path.join(tempDir, 'data'), { recursive: true });
// Ensure sessions directory exists for health check
fs.mkdirSync(path.join(tempDir, 'data', 'sessions'), { recursive: true });

process.chdir(tempDir);

// Dynamic imports after changing working directory so storage uses temp data path
const { registerRoutes } = await import('./server/routes.ts');
const { FileSessionStore } = await import('./server/fileSessionStore.ts');

// Helper to start server on random port
async function startServer() {
  const app = express();
  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ extended: false, limit: '50mb' }));
  const sessionMiddleware = session({
    store: new FileSessionStore(),
    secret: 'test-secret',
    resave: false,
    saveUninitialized: false,
    cookie: { maxAge: 60000 }
  });
  app.use('/api/admin', sessionMiddleware);
  const httpServer = await registerRoutes(app);
  await new Promise(resolve => httpServer.listen(0, resolve));
  const port = httpServer.address().port;
  return { httpServer, port };
}

const { httpServer, port } = await startServer();

async function request(pathname, options = {}) {
  const res = await fetch(`http://localhost:${port}${pathname}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
  });
  let body = null;
  const text = await res.text();
  try { body = JSON.parse(text); } catch {}
  return { res, body };
}

try {
  // Health check should report healthy
  {
    const { res, body } = await request('/api/health');
    assert.equal(res.status, 200);
    assert.equal(body.status, 'healthy');
  }

  // Accessing admin route without auth should fail
  {
    const { res } = await request('/api/admin/rules');
    assert.equal(res.status, 403);
  }

  // Successful login
  const login = await request('/api/admin/login', {
    method: 'POST',
    body: JSON.stringify({ password: 'Password1' }),
  });
  assert.equal(login.res.status, 200);
  assert.ok(login.body.success);
  const rawCookie = login.res.headers.get('set-cookie');
  assert.ok(rawCookie);
  const cookie = rawCookie.split(';')[0];

  // Authenticated status check
  {
    const { res, body } = await request('/api/admin/status', { headers: { cookie } });
    assert.equal(res.status, 200);
    assert.equal(body.isAuthenticated, true);
  }

  // Create a new URL rule
  {
    const newRule = { matcher: '/test-rule', targetUrl: '/new-url', redirectType: 'partial' };
    const { res, body } = await request('/api/admin/rules', {
      method: 'POST',
      headers: { cookie },
      body: JSON.stringify(newRule),
    });
    assert.equal(res.status, 200);
    assert.equal(body.matcher, newRule.matcher);
  }

  console.log('Server feature tests passed');
  await new Promise(resolve => httpServer.close(resolve));
  process.exit(0);
} catch (error) {
  await new Promise(resolve => httpServer.close(resolve));
  console.error(error);
  process.exit(1);
}
