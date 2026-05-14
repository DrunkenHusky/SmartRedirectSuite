import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

const tempDirectory = await fs.mkdtemp(path.join(os.tmpdir(), "srs-login-attempts-"));
const dataDirectory = path.join(tempDirectory, "data");
await fs.mkdir(dataDirectory, { recursive: true });

const legacyBlockedUntil = Date.now() + 60_000;
await fs.writeFile(
  path.join(dataDirectory, "login-attempts.json"),
  JSON.stringify({
    "203.0.113.10": { attempts: 5, blockedUntil: legacyBlockedUntil },
    "203.0.113.20": { attempts: 2 },
    invalid: { attempts: -1 },
  }),
);

process.chdir(tempDirectory);
process.env.DB_DIALECT = "sqlite";
process.env.DB_STORAGE = path.join(dataDirectory, "login-attempts.sqlite");
process.env.LOGIN_MAX_ATTEMPTS = "3";
process.env.LOGIN_BLOCK_DURATION_MS = "60000";

const dbModule = await import("../../server/db");
const bruteForceModule = await import("../../server/middleware/bruteForce");

async function runLoginAttemptDatabaseTests() {
  console.log("Running database login attempt tests...");

  const migratedBlockedIps = await bruteForceModule.getBlockedIps();
  assert.equal(migratedBlockedIps.length, 1, "Only active legacy blocks should be returned");
  assert.equal(migratedBlockedIps[0].ip, "203.0.113.10");
  assert.equal(migratedBlockedIps[0].attempts, 5);
  assert.equal(migratedBlockedIps[0].blockedUntil, legacyBlockedUntil);

  await fs.access(path.join(dataDirectory, "login-attempts.json.bak"));
  await assert.rejects(
    fs.access(path.join(dataDirectory, "login-attempts.json")),
    /ENOENT/,
    "Legacy login-attempts.json must be renamed after migration",
  );

  assert.equal(
    await dbModule.LoginAttemptModel.count(),
    2,
    "Valid legacy login attempts should be stored in database rows",
  );

  await bruteForceModule.recordLoginFailure("198.51.100.1");
  await bruteForceModule.recordLoginFailure("198.51.100.1");
  assert.equal(
    (await bruteForceModule.getBlockedIps()).some((entry) => entry.ip === "198.51.100.1"),
    false,
    "IP must not be blocked before the configured threshold is reached",
  );

  await bruteForceModule.recordLoginFailure("198.51.100.1");
  const blockedAfterThreshold = await bruteForceModule.getBlockedIps();
  const thresholdEntry = blockedAfterThreshold.find((entry) => entry.ip === "198.51.100.1");
  assert.ok(thresholdEntry, "IP must be blocked once the configured threshold is reached");
  assert.equal(thresholdEntry?.attempts, 3);

  await bruteForceModule.blockIp("198.51.100.2");
  assert.ok(
    (await bruteForceModule.getBlockedIps()).some((entry) => entry.ip === "198.51.100.2"),
    "Manual IP blocks must be persisted in the database-backed store",
  );

  await bruteForceModule.resetLoginAttempts("198.51.100.1");
  assert.equal(
    (await bruteForceModule.getBlockedIps()).some((entry) => entry.ip === "198.51.100.1"),
    false,
    "Resetting one IP must remove its database row",
  );

  await bruteForceModule.resetAllLoginAttempts();
  assert.equal(await dbModule.LoginAttemptModel.count(), 0, "Reset-all must clear database-backed login attempts");

  await dbModule.sequelize.close();
  console.log("database login attempt tests passed");
}

runLoginAttemptDatabaseTests().catch(async (error) => {
  console.error(error);
  await dbModule.sequelize.close().catch(() => undefined);
  process.exit(1);
});
