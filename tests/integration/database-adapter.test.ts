import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

const tempDirectory = await fs.mkdtemp(path.join(os.tmpdir(), "srs-db-adapter-"));
process.chdir(tempDirectory);
process.env.DB_DIALECT = "sqlite";
process.env.DB_STORAGE = path.join(tempDirectory, "data", "adapter.sqlite");

const dbModule = await import("../../server/db");
const { storage } = await import("../../server/storage");

async function runDatabaseAdapterTests() {
  console.log("Running database adapter tests...");

  assert.equal(dbModule.normalizeDatabaseDialect("postgresql"), "postgres");
  assert.equal(dbModule.normalizeDatabaseDialect("mariadb"), "mariadb");
  assert.throws(
    () => dbModule.normalizeDatabaseDialect("oracle"),
    /Unsupported DB_DIALECT/,
    "Unsupported dialects must fail during configuration validation",
  );

  const postgresConfig = dbModule.loadDatabaseConfig({
    DB_DIALECT: "postgresql",
    DB_NAME: "smartredirect",
    DB_USER: "redirectuser",
    DB_PASSWORD: "redirectpass",
    DB_HOST: "db",
    DB_SSL: "true",
  });
  assert.equal(postgresConfig.dialect, "postgres");
  assert.equal(postgresConfig.port, 5432);
  assert.equal(postgresConfig.ssl, true);

  const mariadbConfig = dbModule.loadDatabaseConfig({
    DB_DIALECT: "mariadb",
    DB_NAME: "smartredirect",
    DB_USER: "redirectuser",
    DB_PASSWORD: "redirectpass",
    DB_HOST: "db",
  });
  assert.equal(mariadbConfig.dialect, "mariadb");
  assert.equal(mariadbConfig.port, 3306);

  await storage.clearAllRules();
  await storage.clearAllTracking();

  await storage.createUrlRule({
    matcher: "/MixedCase-Rule",
    targetUrl: "https://example.com/target",
    redirectType: "partial",
    autoRedirect: false,
  });

  const paginatedRules = await storage.getUrlRulesPaginated(1, 10, "mixedcase", "not-a-column", "sideways" as "asc");
  assert.equal(paginatedRules.total, 1, "Rule search must be case-insensitive across supported SQL dialects");
  assert.equal(paginatedRules.rules[0].matcher, "/MixedCase-Rule");

  await storage.importUrlRules([
    {
      matcher: "/caf%C3%A9",
      targetUrl: "https://example.com/cafe",
      redirectType: "partial",
      autoRedirect: false,
    } as any,
  ]);
  await storage.importUrlRules([
    {
      matcher: "/café",
      targetUrl: "https://example.com/cafe-updated",
      redirectType: "partial",
      autoRedirect: true,
    } as any,
  ]);

  const importedRules = await storage.getUrlRulesPaginated(1, 20, "café", "matcher", "asc");
  assert.equal(importedRules.total, 1, "Encoded and decoded imports must upsert the same matcher");
  assert.equal(importedRules.rules[0].targetUrl, "https://example.com/cafe-updated");

  const trackedWithRule = await storage.trackUrlAccess({
    oldUrl: "https://old.example.com/MixedCase-Rule",
    newUrl: "https://example.com/target",
    path: "/MixedCase-Rule",
    ruleId: paginatedRules.rules[0].id,
    ruleIds: [paginatedRules.rules[0].id],
    matchQuality: 100,
    feedback: "OK",
    referrer: "https://Referrer.example.com/start",
  });
  await storage.trackUrlAccess({
    oldUrl: "https://old.example.com/no-rule",
    path: "/no-rule",
    ruleIds: [],
    matchQuality: 25,
    feedback: null,
    referrer: "https://other.example.com/start",
  });

  const combinedFilter = await storage.getTrackingEntriesPaginated(
    1,
    10,
    "referrer.example.com",
    "not-a-column",
    "desc",
    "with_rule",
    90,
    100,
    "OK",
  );
  assert.equal(combinedFilter.total, 1, "Search, rule, quality, and feedback filters must be combined with AND");
  assert.equal(combinedFilter.entries[0].id, trackedWithRule.id);
  assert.equal(combinedFilter.entries[0].rule?.id, paginatedRules.rules[0].id);

  const noRuleFilter = await storage.getTrackingEntriesPaginated(1, 10, undefined, "timestamp", "desc", "no_rule");
  assert.equal(noRuleFilter.total, 1, "No-rule filter must include entries with empty ruleIds JSON arrays");
  assert.equal(noRuleFilter.entries[0].path, "/no-rule");

  const allTrackingEntries = await storage.getTrackingData("all");
  assert.equal(allTrackingEntries.length, 2, "Raw tracking export must return full tracking entries, not grouped top-URL rows");
  assert.ok(allTrackingEntries.every((entry) => entry.id && entry.oldUrl && entry.timestamp));

  const topUrls = await storage.getTopUrls(10, "all");
  assert.deepEqual(
    topUrls.map((entry) => entry.path).sort(),
    ["/MixedCase-Rule", "/no-rule"].sort(),
    "Top URL aggregation must stay available for dashboards",
  );

  await dbModule.sequelize.close();
  console.log("database adapter tests passed");
}

runDatabaseAdapterTests().catch(async (error) => {
  console.error(error);
  await dbModule.sequelize.close().catch(() => undefined);
  process.exit(1);
});
