import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import type { SessionData } from "express-session";

const tempDirectory = await fs.mkdtemp(path.join(os.tmpdir(), "srs-session-store-"));
process.chdir(tempDirectory);
process.env.DB_DIALECT = "sqlite";
process.env.DB_STORAGE = path.join(tempDirectory, "data", "sessions.sqlite");

const { DatabaseSessionStore } = await import("../../server/databaseSessionStore");
const { AdminSessionModel, sequelize } = await import("../../server/db");

type StoreInstance = InstanceType<typeof DatabaseSessionStore>;

function setSession(store: StoreInstance, sessionId: string, session: Partial<SessionData>): Promise<void> {
  return new Promise((resolve, reject) => {
    store.set(sessionId, session as SessionData, error => (error ? reject(error) : resolve()));
  });
}

function getSession(store: StoreInstance, sessionId: string): Promise<SessionData | null | undefined> {
  return new Promise((resolve, reject) => {
    store.get(sessionId, (error, session) => (error ? reject(error) : resolve(session)));
  });
}

function getLength(store: StoreInstance): Promise<number> {
  return new Promise((resolve, reject) => {
    store.length((error, length) => (error ? reject(error) : resolve(length ?? 0)));
  });
}

async function runDatabaseSessionStoreTests() {
  console.log("Running database session store tests...");
  const legacyDirectory = path.join(tempDirectory, "data", "sessions");
  await fs.mkdir(legacyDirectory, { recursive: true });

  const store = new DatabaseSessionStore({ legacySessionsDir: legacyDirectory, cleanupIntervalMs: 0 });
  const expires = new Date(Date.now() + 60_000);

  await setSession(store, "admin-session-1", {
    cookie: { expires } as SessionData["cookie"],
    isAdminAuthenticated: true,
    adminLoginTime: 123,
  });

  const persistedRow = await AdminSessionModel.findByPk("admin-session-1");
  assert.ok(persistedRow, "session must be persisted in the database");
  assert.equal(persistedRow?.getDataValue("expiresAt"), expires.toISOString());

  const restoredSession = await getSession(store, "admin-session-1");
  assert.equal(restoredSession?.isAdminAuthenticated, true);
  assert.equal(restoredSession?.adminLoginTime, 123);
  assert.equal(await getLength(store), 1);

  await setSession(store, "expired-session", {
    cookie: { expires: new Date(Date.now() - 60_000) } as SessionData["cookie"],
    isAdminAuthenticated: true,
  });
  assert.equal(await getSession(store, "expired-session"), null, "expired sessions must be removed on read");
  assert.equal(await AdminSessionModel.findByPk("expired-session"), null);

  await fs.writeFile(path.join(legacyDirectory, "legacy-session.json"), JSON.stringify({ data: {}, expires: expires.toISOString() }));
  await setSession(store, "session-cleared-on-startup", {
    cookie: { expires } as SessionData["cookie"],
    isAdminAuthenticated: true,
  });

  await new Promise<void>((resolve, reject) => {
    store.clear(error => (error ? reject(error) : resolve()));
  });

  assert.equal(await getLength(store), 0, "startup cleanup must remove DB-backed sessions");
  await assert.rejects(
    () => fs.access(path.join(legacyDirectory, "legacy-session.json")),
    /ENOENT/,
    "startup cleanup must delete legacy JSON sessions instead of importing them",
  );

  await store.close();
  await sequelize.close();
  console.log("database session store tests passed");
}

runDatabaseSessionStoreTests().catch(async error => {
  console.error(error);
  await sequelize.close().catch(() => undefined);
  process.exit(1);
});
